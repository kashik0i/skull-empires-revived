export type HelpMenu = {
  root: HTMLElement
  show(): void
  hide(): void
  toggle(): void
  isOpen(): boolean
}

const ENTRIES: Array<[string, string]> = [
  ['Click tile', 'move / attack / interact'],
  ['+ / − / 0', 'zoom in / out / reset'],
  ['Ctrl + wheel', 'zoom on canvas'],
  ['`', 'dev menu'],
  ['?', 'this help'],
  ['R', 'restart run'],
  ['Space', 'pause toggle'],
]

export function mountHelpMenu(parent: HTMLElement): HelpMenu {
  const root = document.createElement('div')
  root.id = 'help-menu'
  Object.assign(root.style, {
    background: 'rgba(10, 5, 15, 0.88)',
    border: '1px solid #5a3e8a',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    color: '#c9b3e8',
    display: 'none',
  } satisfies Partial<CSSStyleDeclaration>)

  const title = document.createElement('div')
  title.textContent = 'HELP'
  Object.assign(title.style, {
    fontWeight: 'bold',
    marginBottom: '8px',
    letterSpacing: '0.15em',
    color: '#f0b770',
    fontSize: '11px',
  } satisfies Partial<CSSStyleDeclaration>)
  root.appendChild(title)

  const grid = document.createElement('div')
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: '12px',
    rowGap: '4px',
  } satisfies Partial<CSSStyleDeclaration>)
  root.appendChild(grid)

  for (const [k, v] of ENTRIES) {
    const key = document.createElement('code')
    key.textContent = k
    Object.assign(key.style, {
      fontFamily: 'ui-monospace, monospace',
      color: '#f0b770',
      whiteSpace: 'nowrap',
    } satisfies Partial<CSSStyleDeclaration>)

    const desc = document.createElement('span')
    desc.textContent = v
    Object.assign(desc.style, {
      color: '#eadbc0',
    } satisfies Partial<CSSStyleDeclaration>)

    grid.appendChild(key)
    grid.appendChild(desc)
  }

  const hint = document.createElement('div')
  hint.textContent = 'Press ? to toggle'
  Object.assign(hint.style, {
    marginTop: '8px',
    fontSize: '10px',
    opacity: '0.55',
  } satisfies Partial<CSSStyleDeclaration>)
  root.appendChild(hint)

  parent.appendChild(root)

  function show(): void { root.style.display = 'block' }
  function hide(): void { root.style.display = 'none' }
  function toggle(): void { root.style.display === 'none' ? show() : hide() }
  function isOpen(): boolean { return root.style.display !== 'none' }

  return { root, show, hide, toggle, isOpen }
}
