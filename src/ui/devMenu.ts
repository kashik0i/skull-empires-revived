import type { FlagStore, Flags } from '../dev/flags'

export type DevMenu = {
  root: HTMLElement
  toggle(): void
  show(): void
  hide(): void
  setFps(fps: number): void
  isOpen(): boolean
}

type BooleanFlagKey = {
  [K in keyof Flags]: Flags[K] extends boolean ? K : never
}[keyof Flags]

type FlagConfig = {
  key: BooleanFlagKey
  label: string
  hint: string
}

const FLAG_UI: FlagConfig[] = [
  { key: 'showFps',        label: 'FPS counter',     hint: 'Show frames-per-second overlay' },
  { key: 'showHeroPath',   label: 'Show hero path',  hint: 'Draw the hero\u2019s cached BFS path' },
  { key: 'pauseEnemies',   label: 'Pause enemies',   hint: 'Freeze enemy turns' },
  { key: 'invincibleHero', label: 'Invincible hero', hint: 'Hero takes no damage' },
  { key: 'revealMap',      label: 'Reveal map',      hint: 'Disable fog of war' },
]

// Slider snaps — covers slow debugging → very fast playtesting.
const TICK_SPEED_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 5]

export function mountDevMenu(container: HTMLElement, flags: FlagStore): DevMenu {
  const root = document.createElement('div')
  root.id = 'dev-menu'
  Object.assign(root.style, {
    position: 'absolute',
    right: '12px',
    top: '12px',
    background: 'rgba(10, 5, 15, 0.88)',
    border: '1px solid #5a3e8a',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    color: '#c9b3e8',
    minWidth: '200px',
    display: 'none',
    zIndex: '10',
  } satisfies Partial<CSSStyleDeclaration>)

  const title = document.createElement('div')
  title.textContent = 'DEV MENU'
  Object.assign(title.style, {
    fontWeight: 'bold',
    marginBottom: '8px',
    letterSpacing: '0.15em',
    color: '#f0b770',
    fontSize: '11px',
  } satisfies Partial<CSSStyleDeclaration>)
  root.appendChild(title)

  const fpsLine = document.createElement('div')
  Object.assign(fpsLine.style, {
    marginBottom: '8px',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '11px',
    color: '#eadbc0',
    display: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  fpsLine.textContent = 'FPS —'
  root.appendChild(fpsLine)

  const checkboxes: HTMLInputElement[] = []
  for (const cfg of FLAG_UI) {
    const row = document.createElement('label')
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      padding: '3px 0',
    } satisfies Partial<CSSStyleDeclaration>)
    row.title = cfg.hint

    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = flags.get()[cfg.key]
    box.addEventListener('change', () => flags.set(cfg.key, box.checked))
    checkboxes.push(box)

    const labelText = document.createElement('span')
    labelText.textContent = cfg.label

    row.appendChild(box)
    row.appendChild(labelText)
    root.appendChild(row)
  }

  // Volume slider (range input 0..100, maps to flags.volume in [0, 1]).
  const volumeRow = document.createElement('label')
  Object.assign(volumeRow.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0 3px 0',
    marginTop: '4px',
    borderTop: '1px solid rgba(90, 62, 138, 0.6)',
  } satisfies Partial<CSSStyleDeclaration>)
  volumeRow.title = 'Master volume (0-100%)'

  const volumeLabel = document.createElement('span')
  volumeLabel.textContent = 'Volume'
  Object.assign(volumeLabel.style, { flex: '0 0 auto' } satisfies Partial<CSSStyleDeclaration>)

  const volumeSlider = document.createElement('input')
  volumeSlider.type = 'range'
  volumeSlider.min = '0'
  volumeSlider.max = '100'
  volumeSlider.step = '1'
  volumeSlider.value = String(Math.round(flags.get().volume * 100))
  Object.assign(volumeSlider.style, { flex: '1 1 auto' } satisfies Partial<CSSStyleDeclaration>)

  const volumeReadout = document.createElement('span')
  Object.assign(volumeReadout.style, {
    flex: '0 0 auto',
    fontFamily: 'ui-monospace, monospace',
    minWidth: '32px',
    textAlign: 'right',
  } satisfies Partial<CSSStyleDeclaration>)
  volumeReadout.textContent = `${Math.round(flags.get().volume * 100)}`

  volumeSlider.addEventListener('input', () => {
    const n = Number(volumeSlider.value)
    flags.set('volume', n / 100)
  })

  volumeRow.appendChild(volumeLabel)
  volumeRow.appendChild(volumeSlider)
  volumeRow.appendChild(volumeReadout)
  root.appendChild(volumeRow)

  // Tick-speed slider: snaps to named steps (0.25x .. 5x).
  const speedRow = document.createElement('label')
  Object.assign(speedRow.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0 3px 0',
  } satisfies Partial<CSSStyleDeclaration>)
  speedRow.title = 'Enemy tick speed (1x = 300ms/turn)'

  const speedLabel = document.createElement('span')
  speedLabel.textContent = 'Speed'
  Object.assign(speedLabel.style, { flex: '0 0 auto' } satisfies Partial<CSSStyleDeclaration>)

  const initialSpeedIdx = Math.max(0, TICK_SPEED_STEPS.indexOf(flags.get().tickSpeed))
  const speedSlider = document.createElement('input')
  speedSlider.type = 'range'
  speedSlider.min = '0'
  speedSlider.max = String(TICK_SPEED_STEPS.length - 1)
  speedSlider.step = '1'
  speedSlider.value = String(initialSpeedIdx === -1 ? 2 : initialSpeedIdx)
  Object.assign(speedSlider.style, { flex: '1 1 auto' } satisfies Partial<CSSStyleDeclaration>)

  const speedReadout = document.createElement('span')
  Object.assign(speedReadout.style, {
    flex: '0 0 auto',
    fontFamily: 'ui-monospace, monospace',
    minWidth: '40px',
    textAlign: 'right',
  } satisfies Partial<CSSStyleDeclaration>)
  speedReadout.textContent = `${flags.get().tickSpeed}x`

  speedSlider.addEventListener('input', () => {
    const i = Number(speedSlider.value)
    const step = TICK_SPEED_STEPS[i]
    flags.set('tickSpeed', step)
  })

  speedRow.appendChild(speedLabel)
  speedRow.appendChild(speedSlider)
  speedRow.appendChild(speedReadout)
  root.appendChild(speedRow)

  const hint = document.createElement('div')
  hint.textContent = 'Press ` to toggle'
  Object.assign(hint.style, {
    marginTop: '8px',
    fontSize: '10px',
    opacity: '0.55',
  } satisfies Partial<CSSStyleDeclaration>)
  root.appendChild(hint)

  container.appendChild(root)

  // Keep checkboxes + sliders in sync if flags are set programmatically.
  flags.subscribe(next => {
    FLAG_UI.forEach((cfg, i) => { checkboxes[i].checked = next[cfg.key] })
    fpsLine.style.display = next.showFps ? 'block' : 'none'
    const pct = Math.round(next.volume * 100)
    if (volumeSlider.value !== String(pct)) volumeSlider.value = String(pct)
    volumeReadout.textContent = `${pct}`
    const idx = TICK_SPEED_STEPS.indexOf(next.tickSpeed)
    if (idx >= 0 && speedSlider.value !== String(idx)) speedSlider.value = String(idx)
    speedReadout.textContent = `${next.tickSpeed}x`
  })

  function show() { root.style.display = 'block' }
  function hide() { root.style.display = 'none' }
  function toggle() { root.style.display === 'none' ? show() : hide() }
  function isOpen() { return root.style.display !== 'none' }
  function setFps(fps: number) {
    if (!flags.get().showFps) return
    fpsLine.textContent = `FPS ${fps.toFixed(0)}`
  }

  // initial fps-line visibility
  fpsLine.style.display = flags.get().showFps ? 'block' : 'none'

  return { root, toggle, show, hide, setFps, isOpen }
}

export function attachDevMenuHotkey(menu: DevMenu, key = '`'): () => void {
  function onKey(e: KeyboardEvent) {
    if (e.key === key) {
      e.preventDefault()
      menu.toggle()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
