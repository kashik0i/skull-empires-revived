import type { Action, World } from '../core/types'

/**
 * Dev-only: stream every action to the Vite `/_dev/event` middleware,
 * which appends to `.debug/run.jsonl` on disk. Fire-and-forget.
 * No-op in production (tree-shaken via import.meta.env.DEV).
 */

const ENABLED: boolean = import.meta.env.DEV

export function resetDevLog(): void {
  if (!ENABLED) return
  void fetch('/_dev/reset', { method: 'POST' }).catch(() => {})
}

export function appendDevLog(action: Action, state: World, idx: number, source: 'runtime' | 'replay' = 'runtime'): void {
  if (!ENABLED) return
  const entry = {
    idx,
    tick: state.tick,
    phase: state.phase,
    depth: state.run.depth,
    heroHp: state.actors[state.heroId]?.hp,
    source,
    action,
  }
  void fetch('/_dev/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => {})
}
