export type SidePanel = {
  root: HTMLElement
  slot(name: 'minimap' | 'stats' | 'equipment' | 'inventory' | 'music' | 'descend'): HTMLElement
}

export function mountSidePanel(parent: HTMLElement): SidePanel {
  const slots: Record<string, HTMLElement> = {}
  const order = ['minimap', 'stats', 'equipment', 'inventory', 'music', 'descend'] as const
  for (const name of order) {
    const el = document.createElement('div')
    el.dataset.slot = name
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '6px'
    parent.appendChild(el)
    slots[name] = el
  }
  return {
    root: parent,
    slot(name) { return slots[name] },
  }
}
