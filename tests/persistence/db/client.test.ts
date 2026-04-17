import { describe, test, expect } from 'bun:test'
import { createDbClient } from '../../../src/persistence/db/client'

// ---------------------------------------------------------------------------
// Mock Worker
// ---------------------------------------------------------------------------

class MockWorker extends EventTarget {
  posted: unknown[] = []
  onmessage: ((ev: MessageEvent) => void) | null = null
  postMessage(msg: unknown): void {
    this.posted.push(msg)
  }
  terminate(): void {}
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'message') {
      this.onmessage = listener as (ev: MessageEvent) => void
    }
  }
  override removeEventListener(): void {}
  /** Simulate a message coming from the worker. */
  _respond(resp: unknown): void {
    const ev = new MessageEvent('message', { data: resp })
    this.onmessage?.(ev)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(debounceMs = 50) {
  const w = new MockWorker()
  const client = createDbClient({ worker: w as unknown as Worker, debounceMs })
  return { client, w }
}

function ready(w: MockWorker): void {
  w._respond({ kind: 'ready' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DbClient', () => {
  test('1. appendEvent does NOT postMessage immediately', () => {
    const { client, w } = makeClient()
    ready(w)
    // appendEvent is synchronous and fire-and-forget
    client.appendEvent('run-1', 0, 10, '{}')
    // nothing should have been posted yet (debounce pending)
    expect(w.posted.length).toBe(0)
    client.dispose()
  })

  test('2. after debounce, postMessage contains the queued event', async () => {
    const { client, w } = makeClient(30)
    ready(w)
    client.appendEvent('run-1', 0, 10, '{"a":1}')
    // wait longer than debounce
    await new Promise((r) => setTimeout(r, 60))
    expect(w.posted.length).toBe(1)
    const msg = w.posted[0] as { kind: string; runId: string; events: unknown[] }
    expect(msg.kind).toBe('append-event')
    expect(msg.runId).toBe('run-1')
    expect(msg.events).toHaveLength(1)
    expect((msg.events[0] as { idx: number }).idx).toBe(0)
    client.dispose()
  })

  test('3. multiple appendEvent calls → single flush message', async () => {
    const { client, w } = makeClient(30)
    ready(w)
    client.appendEvent('run-1', 0, 10, '{}')
    client.appendEvent('run-1', 1, 20, '{}')
    client.appendEvent('run-1', 2, 30, '{}')
    await new Promise((r) => setTimeout(r, 60))
    // Only one append-event message, containing all 3 events
    const appends = (w.posted as Array<{ kind: string; events?: unknown[] }>).filter((m) => m.kind === 'append-event')
    expect(appends).toHaveLength(1)
    expect(appends[0].events).toHaveLength(3)
    client.dispose()
  })

  test('4. flush() forces immediate send without waiting for debounce', async () => {
    const { client, w } = makeClient(5000) // very long debounce
    ready(w)
    client.appendEvent('run-1', 0, 10, '{}')
    // should still be 0 — debounce hasn't fired
    expect(w.posted.length).toBe(0)
    // flush manually (respond with ok so it resolves)
    const flushP = client.flush()
    // tick microtasks
    await Promise.resolve()
    // now the message should be in posted
    const appends = (w.posted as Array<{ kind: string }>).filter((m) => m.kind === 'append-event')
    expect(appends.length).toBeGreaterThanOrEqual(1)
    // respond so flush resolves
    const msg = w.posted[w.posted.length - 1] as { kind: string; reqId: number }
    w._respond({ kind: 'ok', for: 'append-event', reqId: msg.reqId })
    await flushP
    client.dispose()
  })

  test('5. endRun flushes pending appends BEFORE sending end-run', async () => {
    const { client, w } = makeClient(5000)
    ready(w)
    client.appendEvent('run-1', 0, 10, '{}')

    // Start endRun — don't await yet
    const endP = client.endRun('run-1', 'win', 99)
    await Promise.resolve()
    await Promise.resolve()

    // First posted message should be append-event
    const first = w.posted[0] as { kind: string; reqId: number }
    expect(first.kind).toBe('append-event')
    // Respond to flush
    w._respond({ kind: 'ok', for: 'append-event', reqId: first.reqId })
    await Promise.resolve()
    await Promise.resolve()

    // Second posted message should be end-run
    const second = w.posted[1] as { kind: string; reqId: number }
    expect(second.kind).toBe('end-run')
    w._respond({ kind: 'ok', for: 'end-run', reqId: second.reqId })
    await endP
    client.dispose()
  })

  test('6. getLatestUnended resolves with null run', async () => {
    const { client, w } = makeClient()
    ready(w)

    const p = client.getLatestUnended()
    await Promise.resolve()
    await Promise.resolve()
    // find the posted get-latest-unended
    const msg = (w.posted as Array<{ kind: string; reqId: number }>).find(
      (m) => m.kind === 'get-latest-unended'
    )!
    w._respond({ kind: 'latest-unended', reqId: msg.reqId, run: null })
    const result = await p
    expect(result).toBeNull()
    client.dispose()
  })

  test('7. request/response correlation: two concurrent getLatestUnended calls', async () => {
    const { client, w } = makeClient()
    ready(w)

    const p1 = client.getLatestUnended()
    const p2 = client.getLatestUnended()
    await Promise.resolve()
    await Promise.resolve()

    const posted = w.posted as Array<{ kind: string; reqId: number }>
    const msgs = posted.filter((m) => m.kind === 'get-latest-unended')
    expect(msgs.length).toBe(2)
    // Respond in reverse order — correlation should still match
    const runA = { runId: 'run-A', seed: '42', log: [] }
    w._respond({ kind: 'latest-unended', reqId: msgs[1].reqId, run: runA })
    w._respond({ kind: 'latest-unended', reqId: msgs[0].reqId, run: null })

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBeNull()
    expect(r2).not.toBeNull()
    expect(r2?.runId).toBe('run-A')
    client.dispose()
  })

  test('8. error response rejects request promise and calls onError', async () => {
    const errors: Error[] = []
    const { client, w } = makeClient()
    const clientWithErr = createDbClient({
      worker: w as unknown as Worker,
      onError: (e) => errors.push(e),
    })
    ready(w)

    const p = clientWithErr.getLatestUnended()
    await Promise.resolve()
    await Promise.resolve()

    const msg = (w.posted as Array<{ kind: string; reqId: number }>).find(
      (m) => m.kind === 'get-latest-unended'
    )!
    w._respond({ kind: 'error', message: 'DB exploded', reqId: msg.reqId })

    await expect(p).rejects.toThrow('DB exploded')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('DB exploded')
    client.dispose()
    clientWithErr.dispose()
  })
})
