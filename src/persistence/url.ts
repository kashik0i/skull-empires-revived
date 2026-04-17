import type { Action } from '../core/types'

export type EncodedRun = string

export function encodeRun(seed: string, log: readonly Action[]): EncodedRun {
  const payload = JSON.stringify({ seed, log })
  return btoa(unescape(encodeURIComponent(payload)))
}

export function decodeRun(encoded: EncodedRun): { seed: string; log: Action[] } | null {
  try {
    const payload = decodeURIComponent(escape(atob(encoded)))
    const parsed = JSON.parse(payload) as { seed?: unknown; log?: unknown }
    if (typeof parsed.seed !== 'string' || !Array.isArray(parsed.log)) return null
    return { seed: parsed.seed, log: parsed.log as Action[] }
  } catch {
    return null
  }
}
