export type SfxClipId = 'step' | 'hit' | 'death' | 'attack' | 'click'

export type SfxClipSpec = {
  id: SfxClipId
  src: string
  poolSize: number
}

export type Sfx = {
  play(id: SfxClipId): void
}

export function createSfx(specs: readonly SfxClipSpec[], opts: { volume: number }): Sfx {
  const pool = new Map<SfxClipId, HTMLAudioElement[]>()
  const cursor = new Map<SfxClipId, number>()
  const AudioCtor = (globalThis as Record<string, unknown>).Audio as typeof Audio | undefined

  for (const spec of specs) {
    if (!AudioCtor) continue
    const list: HTMLAudioElement[] = []
    for (let i = 0; i < spec.poolSize; i++) {
      try {
        const a = new AudioCtor(spec.src)
        a.preload = 'auto'
        a.volume = opts.volume
        list.push(a)
      } catch {
        // ignore; silent fallback
      }
    }
    pool.set(spec.id, list)
    cursor.set(spec.id, 0)
  }

  return {
    play(id) {
      const list = pool.get(id)
      if (!list || list.length === 0) {
        console.warn(`[sfx] unknown or empty clip: ${id}`)
        return
      }
      const i = cursor.get(id) ?? 0
      const a = list[i]
      cursor.set(id, (i + 1) % list.length)
      try {
        a.currentTime = 0
        void a.play()
      } catch {
        // silently drop
      }
    },
  }
}
