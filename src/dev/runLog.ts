import type { Action, World } from '../core/types'

/**
 * Dev-only: stream every action to the Vite plugin over the HMR WebSocket.
 * Buffers entries and flushes every BATCH_MS (or on buffer saturation) so
 * a 5x-speed run doesn't fire dozens of tiny messages per second.
 * No-op when disabled, or in production (tree-shaken via import.meta.env.DEV).
 */

const ENABLED: boolean = import.meta.env.DEV
const BATCH_MS = 250
const BATCH_MAX = 100

let currentRunId: string | null = null
let streamingEnabled = false
let buffer: unknown[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

export function setRunId(id: string): void {
  currentRunId = id
}

export function setStreamingEnabled(v: boolean): void {
  streamingEnabled = v
}

export function getRunId(): string | null {
  return currentRunId
}

export function resetDevLog(runId?: string): void {
  if (!ENABLED) return
  const id = runId ?? currentRunId
  if (!id) return
  // Drop any in-flight batch for a prior run.
  buffer = []
  if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null }
  import.meta.hot?.send('skull-log:reset', { runId: id })
}

export function appendDevLog(action: Action, state: World, idx: number, source: 'runtime' | 'replay' = 'runtime'): void {
  if (!ENABLED || !streamingEnabled || !currentRunId) return
  enqueue({
    idx,
    tick: state.tick,
    phase: state.phase,
    depth: state.run.depth,
    heroHp: state.actors[state.heroId]?.hp,
    source,
    action,
  })
}

export function logDevEvent(kind: string, detail: Record<string, unknown>): void {
  if (!ENABLED || !streamingEnabled || !currentRunId) return
  enqueue({ kind, ...detail, at: Date.now() })
}

function enqueue(entry: unknown): void {
  buffer.push(entry)
  if (buffer.length >= BATCH_MAX) {
    flush()
  } else if (flushTimer === null) {
    flushTimer = setTimeout(flush, BATCH_MS)
  }
}

function flush(): void {
  if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null }
  if (buffer.length === 0 || !currentRunId) return
  const entries = buffer
  buffer = []
  import.meta.hot?.send('skull-log:batch', { runId: currentRunId, entries })
}

// Best-effort flush on page unload so the last batch isn't lost.
if (ENABLED && typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { flush() })
}
