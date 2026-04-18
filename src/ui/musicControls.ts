type Controlled = {
  start(): void
  stop(): void
  setVolume(v: number): void
}

export type MusicControls = {
  root: HTMLElement
  setMuted(muted: boolean): void
}

const KEY_PLAYING = 'music_playing'
const KEY_VOLUME = 'music_volume'

export function mountMusicControls(
  parent: HTMLElement,
  music: Controlled
): MusicControls {
  const root = document.createElement('div')
  Object.assign(root.style, {
    background: 'rgba(11, 6, 18, 0.6)',
    border: '1px solid #5a3e8a',
    borderRadius: '6px',
    padding: '6px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>)
  parent.appendChild(root)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  Object.assign(toggle.style, {
    background: '#2a1a3e',
    color: '#eadbc0',
    border: '1px solid #5a3e8a',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>)

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '100'
  slider.style.flex = '1'

  root.appendChild(toggle)
  root.appendChild(slider)

  // Restore persisted state.
  const persistedPlay = localStorage.getItem(KEY_PLAYING)
  const persistedVol = localStorage.getItem(KEY_VOLUME)
  let playing = persistedPlay === null ? true : persistedPlay === 'true'
  let volume =
    persistedVol === null ? 50 : Math.max(0, Math.min(100, Number(persistedVol)))
  let muted = false

  slider.value = String(volume)

  function effectiveVolume(): number {
    return playing && !muted ? (volume / 100) * 0.5 : 0
  }
  function applyVolume(): void {
    music.setVolume(effectiveVolume())
  }

  function setPlaying(next: boolean): void {
    playing = next
    localStorage.setItem(KEY_PLAYING, String(playing))
    toggle.textContent = playing ? '⏸ Pause' : '▶ Play'
    if (playing) music.start()
    applyVolume()
  }

  toggle.addEventListener('click', () => setPlaying(!playing))
  slider.addEventListener('input', () => {
    volume = Number(slider.value)
    localStorage.setItem(KEY_VOLUME, String(volume))
    applyVolume()
  })

  setPlaying(playing)

  return {
    root,
    setMuted(next: boolean) {
      muted = next
      applyVolume()
    },
  }
}
