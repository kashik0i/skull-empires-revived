import type { Responsive } from '../dev/responsive'

const KEY_DRAWER = 'hud_drawer'
type DrawerState = 'expanded' | 'collapsed'

export type SidePanel = {
  root: HTMLElement
  slot(name: 'minimap' | 'stats' | 'equipment' | 'inventory' | 'zoom' | 'music' | 'descend' | 'dev'): HTMLElement
}

export function mountSidePanel(parent: HTMLElement, responsive?: Responsive): SidePanel {
  // Header strip — only used in mobile drawer mode.
  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'none',  // shown when isMobile()
    cursor: 'pointer',
    padding: '6px 10px',
    background: '#2a1a3e',
    borderBottom: '1px solid #5a3e8a',
    textAlign: 'center',
    fontSize: '12px',
    color: '#eadbc0',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  header.textContent = '▾ Tap to collapse'
  parent.appendChild(header)

  // Body holds the slots; we hide it when collapsed.
  const body = document.createElement('div')
  Object.assign(body.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto',
  } satisfies Partial<CSSStyleDeclaration>)
  parent.appendChild(body)

  const slots: Record<string, HTMLElement> = {}
  const order = ['minimap', 'stats', 'equipment', 'inventory', 'zoom', 'music', 'descend', 'dev'] as const
  for (const name of order) {
    const el = document.createElement('div')
    el.dataset.slot = name
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '6px'
    body.appendChild(el)
    slots[name] = el
  }

  const persisted = localStorage.getItem(KEY_DRAWER)
  let drawer: DrawerState = persisted === 'collapsed' ? 'collapsed' : 'expanded'

  function applyMobileState(isMobile: boolean): void {
    if (isMobile) {
      header.style.display = 'block'
      const collapsed = drawer === 'collapsed'
      body.style.display = collapsed ? 'none' : 'flex'
      header.textContent = collapsed ? '▴ Tap to expand' : '▾ Tap to collapse'
    } else {
      header.style.display = 'none'
      body.style.display = 'flex'
    }
  }

  header.addEventListener('click', () => {
    drawer = drawer === 'expanded' ? 'collapsed' : 'expanded'
    localStorage.setItem(KEY_DRAWER, drawer)
    applyMobileState(true)
  })

  if (responsive) {
    applyMobileState(responsive.isMobile())
    responsive.subscribe(applyMobileState)
  } else {
    applyMobileState(false)
  }

  return {
    root: parent,
    slot(name) { return slots[name] },
  }
}
