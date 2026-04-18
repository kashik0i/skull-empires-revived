import type { World, Action } from '../core/types'
import { getItemDef } from '../content/itemLoader'

export type ItemRewardMount = {
  root: HTMLElement
  update(state: World): void
}

export function mountItemReward(parent: HTMLElement, onAction: (a: Action) => void): ItemRewardMount {
  const root = document.createElement('div')
  root.id = 'item-reward-root'
  Object.assign(root.style, {
    position: 'fixed', inset: '0', display: 'none',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)', zIndex: '99',
  } satisfies Partial<CSSStyleDeclaration>)

  const modal = document.createElement('div')
  Object.assign(modal.style, {
    background: '#1a1024', border: '1px solid #5a3e8a',
    padding: '24px 28px', borderRadius: '8px', textAlign: 'center',
  } satisfies Partial<CSSStyleDeclaration>)

  const title = document.createElement('h2')
  title.textContent = 'Choose your spoils'
  Object.assign(title.style, { color: '#f5e6b0', margin: '0 0 16px 0' } satisfies Partial<CSSStyleDeclaration>)

  const row = document.createElement('div')
  Object.assign(row.style, { display: 'flex', gap: '12px' } satisfies Partial<CSSStyleDeclaration>)

  modal.appendChild(title)
  modal.appendChild(row)
  root.appendChild(modal)
  parent.appendChild(root)

  let lastKey = ''
  function update(state: World): void {
    const offered = state.run.pendingItemReward
    if (!offered) {
      root.style.display = 'none'
      lastKey = ''
      return
    }
    root.style.display = 'flex'
    const key = offered.join('|')
    if (key === lastKey) return
    lastKey = key
    row.replaceChildren()
    for (const id of offered) {
      const def = getItemDef(id)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = def.name
      Object.assign(btn.style, {
        background: '#3e2a5c', color: '#f5e6b0',
        border: '1px solid #8b6f47', borderRadius: '4px',
        padding: '12px 16px', fontSize: '14px', cursor: 'pointer',
      } satisfies Partial<CSSStyleDeclaration>)
      btn.addEventListener('click', () => onAction({ type: 'PickItemReward', itemId: id }))
      row.appendChild(btn)
    }
  }
  return { root, update }
}
