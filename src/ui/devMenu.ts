import type { FlagStore, Flags } from '../dev/flags'

export type DevMenu = {
  root: HTMLElement
  toggle(): void
  show(): void
  hide(): void
  setFps(fps: number): void
  isOpen(): boolean
}

type FlagConfig = {
  key: keyof Flags
  label: string
  hint: string
}

const FLAG_UI: FlagConfig[] = [
  { key: 'showFps',      label: 'FPS counter',    hint: 'Show frames-per-second overlay' },
  { key: 'slowMotion',   label: 'Slow motion',    hint: 'Slow enemy turns to 1000ms' },
  { key: 'showHeroPath', label: 'Show hero path', hint: 'Draw the hero\u2019s cached BFS path' },
]

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

  const hint = document.createElement('div')
  hint.textContent = 'Press ` to toggle'
  Object.assign(hint.style, {
    marginTop: '8px',
    fontSize: '10px',
    opacity: '0.55',
  } satisfies Partial<CSSStyleDeclaration>)
  root.appendChild(hint)

  container.appendChild(root)

  // Keep checkboxes in sync if flags are set programmatically.
  flags.subscribe(next => {
    FLAG_UI.forEach((cfg, i) => { checkboxes[i].checked = next[cfg.key] })
    fpsLine.style.display = next.showFps ? 'block' : 'none'
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
