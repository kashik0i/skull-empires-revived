import type { Action, World } from '../core/types'

/**
 * Dev-only: stream every action to the Vite `/_dev/event` middleware,
 * which appends to `.debug/{runId}.jsonl` on disk. Fire-and-forget.
 * No-op when disabled, or when ENABLED=false (prod build tree-shakes).
 */

const ENABLED: boolean = import.meta.env.DEV

let currentRunId: string | null = null
let streamingEnabled = false

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
  void fetch('/_dev/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: id }),
  }).catch(() => {})
}

export function appendDevLog(action: Action, state: World, idx: number, source: 'runtime' | 'replay' = 'runtime'): void {
  if (!ENABLED || !streamingEnabled || !currentRunId) return
  const entry = {
    idx,
    tick: state.tick,
    phase: state.phase,
    depth: state.run.depth,
    heroHp: state.actors[state.heroId]?.hp,
    source,
    action,
  }
  postEntry(entry)
}

export function logDevEvent(kind: string, detail: Record<string, unknown>): void {
  if (!ENABLED || !streamingEnabled || !currentRunId) return
  postEntry({ kind, ...detail, at: Date.now() })
}

function postEntry(entry: unknown): void {
  if (!currentRunId) return
  void fetch('/_dev/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: currentRunId, entry }),
    keepalive: true,
  }).catch(() => {})
}
