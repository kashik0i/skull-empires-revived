export const ZOOM_STEPS = [18, 24, 30, 36, 48] as const
export const ZOOM_DEFAULT_INDEX = 1
const STORAGE_KEY = 'zoom_index'

export type ZoomController = {
  tileSize(): number
  index(): number
  zoomIn(): void
  zoomOut(): void
  reset(): void
  subscribe(cb: (tileSize: number) => void): () => void
}

export function createZoom(): ZoomController {
  let idx = readPersistedIndex()
  const subs: Array<(t: number) => void> = []

  function setIndex(next: number): void {
    const clamped = Math.max(0, Math.min(ZOOM_STEPS.length - 1, next))
    if (clamped === idx) return
    idx = clamped
    try { localStorage.setItem(STORAGE_KEY, String(idx)) } catch {}
    const ts = ZOOM_STEPS[idx]
    for (const cb of subs) cb(ts)
  }

  return {
    tileSize: () => ZOOM_STEPS[idx],
    index: () => idx,
    zoomIn: () => setIndex(idx + 1),
    zoomOut: () => setIndex(idx - 1),
    reset: () => setIndex(ZOOM_DEFAULT_INDEX),
    subscribe(cb) {
      subs.push(cb)
      return () => {
        const i = subs.indexOf(cb)
        if (i >= 0) subs.splice(i, 1)
      }
    },
  }
}

function readPersistedIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return ZOOM_DEFAULT_INDEX
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0 || n >= ZOOM_STEPS.length) return ZOOM_DEFAULT_INDEX
    return n
  } catch {
    return ZOOM_DEFAULT_INDEX
  }
}
