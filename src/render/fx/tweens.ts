export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

export function easeOutCubic(t: number): number {
  const c = clamp01(t)
  return 1 - (1 - c) ** 3
}

export function easeInOutQuad(t: number): number {
  const c = clamp01(t)
  return c < 0.5 ? 2 * c * c : 1 - ((-2 * c + 2) ** 2) / 2
}

export type TweenSpec = {
  durationMs: number
  onTick: (t: number) => void
  onComplete?: () => void
}

type ActiveTween = TweenSpec & { elapsedMs: number; done: boolean }

export type Tweens = {
  add(spec: TweenSpec): void
  tick(dtMs: number): void
  count(): number
}

export function createTweens(): Tweens {
  const active: ActiveTween[] = []
  return {
    add(spec) { active.push({ ...spec, elapsedMs: 0, done: false }) },
    tick(dtMs) {
      for (const tw of active) {
        if (tw.done) continue
        tw.elapsedMs += dtMs
        if (tw.elapsedMs >= tw.durationMs) {
          tw.onTick(1)
          tw.done = true
          tw.onComplete?.()
        } else {
          tw.onTick(tw.elapsedMs / tw.durationMs)
        }
      }
      // compact
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].done) active.splice(i, 1)
      }
    },
    count() { return active.length },
  }
}
