// ---------------------------------------------------------------------------
// DbClient — thin wrapper around the SQLite worker with batched append-event
// ---------------------------------------------------------------------------

export type DbEvent = { idx: number; tick: number; actionJson: string }

export type LatestUnended = { runId: string; seed: string; log: DbEvent[] } | null

export type DbClient = {
  startRun(runId: string, seed: string): Promise<void>
  /** fire-and-forget, batched with debounce */
  appendEvent(runId: string, idx: number, tick: number, actionJson: string): void
  /** flushes pending appends first */
  endRun(runId: string, outcome: 'win' | 'loss', finalTick: number): Promise<void>
  getLatestUnended(): Promise<LatestUnended>
  deleteRun(runId: string): Promise<void>
  /** force-drain the pending append buffer */
  flush(): Promise<void>
  dispose(): void
}

export type DbClientOptions = {
  /** inject a worker for tests */
  worker?: Worker
  /** debounce for batched appends, default 50ms */
  debounceMs?: number
  onError?: (err: Error) => void
}

// ---------------------------------------------------------------------------
// Internal types mirroring worker protocol
// ---------------------------------------------------------------------------

type WorkerMsg =
  | { kind: 'start-run'; runId: string; seed: string; reqId: number }
  | {
      kind: 'append-event'
      runId: string
      events: Array<{ idx: number; tick: number; actionJson: string }>
      reqId: number
    }
  | { kind: 'end-run'; runId: string; outcome: 'win' | 'loss'; finalTick: number; reqId: number }
  | { kind: 'get-latest-unended'; reqId: number }
  | { kind: 'delete-run'; runId: string; reqId: number }

type WorkerResp =
  | { kind: 'ready' }
  | { kind: 'ok'; for: string; reqId?: number }
  | {
      kind: 'latest-unended'
      reqId?: number
      run: null | { runId: string; seed: string; log: DbEvent[] }
    }
  | { kind: 'error'; message: string; reqId?: number }

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDbClient(opts?: DbClientOptions): DbClient {
  const debounceMs = opts?.debounceMs ?? 50
  const onError = opts?.onError ?? ((err: Error) => console.error('[db-client]', err))

  const worker: Worker =
    opts?.worker ?? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

  // --- request/response correlation ---
  let nextReqId = 1
  const pending = new Map<number, { resolve: (v: WorkerResp) => void; reject: (e: Error) => void }>()

  // --- ready handshake ---
  let readyResolve!: () => void
  const readyPromise = new Promise<void>((res) => {
    readyResolve = res
  })

  // --- append buffer ---
  let pendingRunId: string | null = null
  let pendingEvents: DbEvent[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // --- message handler ---
  function onMessage(ev: MessageEvent<WorkerResp>): void {
    const resp = ev.data
    if (resp.kind === 'ready') {
      readyResolve()
      return
    }
    const reqId = resp.reqId
    if (reqId === undefined) return
    const entry = pending.get(reqId)
    if (!entry) return
    pending.delete(reqId)
    if (resp.kind === 'error') {
      const err = new Error(resp.message)
      onError(err)
      entry.reject(err)
    } else {
      entry.resolve(resp)
    }
  }

  worker.addEventListener('message', onMessage as (ev: MessageEvent) => void)

  // --- post with correlation ---
  function post(msg: WorkerMsg): Promise<WorkerResp> {
    return new Promise((resolve, reject) => {
      pending.set(msg.reqId, { resolve, reject })
      try {
        worker.postMessage(msg)
      } catch (err) {
        pending.delete(msg.reqId)
        const e = err instanceof Error ? err : new Error(String(err))
        onError(e)
        reject(e)
      }
    })
  }

  function allocReqId(): number {
    return nextReqId++
  }

  // --- flush implementation (no ready-await — callers do that) ---
  async function flushNow(): Promise<void> {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (pendingEvents.length === 0) return

    const runId = pendingRunId!
    const events = pendingEvents
    pendingEvents = []
    pendingRunId = null

    await post({ kind: 'append-event', runId, events, reqId: allocReqId() })
  }

  // --- beforeunload: best-effort sync fire ---
  function onBeforeUnload(): void {
    if (pendingEvents.length === 0 || pendingRunId === null) return
    // Synchronous fire — can't await; worker may be killed with the page
    const msg: WorkerMsg = {
      kind: 'append-event',
      runId: pendingRunId,
      events: pendingEvents,
      reqId: allocReqId(),
    }
    try {
      worker.postMessage(msg)
    } catch {
      // swallow — page is unloading
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    async startRun(runId: string, seed: string): Promise<void> {
      await readyPromise
      await post({ kind: 'start-run', runId, seed, reqId: allocReqId() })
    },

    appendEvent(runId: string, idx: number, tick: number, actionJson: string): void {
      // If switching runIds and have pending data, fire a best-effort flush first
      if (pendingRunId !== null && pendingRunId !== runId && pendingEvents.length > 0) {
        const capturedRunId = pendingRunId
        const capturedEvents = pendingEvents
        pendingEvents = []
        pendingRunId = null
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }
        // fire-and-forget (readyPromise may resolve before the message lands)
        readyPromise.then(() => {
          worker.postMessage({
            kind: 'append-event',
            runId: capturedRunId,
            events: capturedEvents,
            reqId: allocReqId(),
          } satisfies WorkerMsg)
        }).catch(() => { /* swallow */ })
      }

      pendingRunId = runId
      pendingEvents.push({ idx, tick, actionJson })

      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        readyPromise.then(() => flushNow()).catch((err: unknown) => {
          onError(err instanceof Error ? err : new Error(String(err)))
        })
      }, debounceMs)
    },

    async flush(): Promise<void> {
      await readyPromise
      await flushNow()
    },

    async endRun(runId: string, outcome: 'win' | 'loss', finalTick: number): Promise<void> {
      await readyPromise
      await flushNow()
      await post({ kind: 'end-run', runId, outcome, finalTick, reqId: allocReqId() })
    },

    async getLatestUnended(): Promise<LatestUnended> {
      await readyPromise
      const resp = await post({ kind: 'get-latest-unended', reqId: allocReqId() })
      if (resp.kind === 'latest-unended') return resp.run
      throw new Error(`Unexpected response: ${resp.kind}`)
    },

    async deleteRun(runId: string): Promise<void> {
      await readyPromise
      await post({ kind: 'delete-run', runId, reqId: allocReqId() })
    },

    dispose(): void {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      worker.removeEventListener('message', onMessage as (ev: MessageEvent) => void)
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', onBeforeUnload)
      }
      worker.terminate()
    },
  }
}
