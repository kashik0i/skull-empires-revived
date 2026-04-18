import type { Action, World } from '../core/types'

export type DialogMount = {
  root: HTMLElement
  update(state: World): void
  destroy(): void
}

export function mountDialog(
  parent: HTMLElement,
  onAction: (a: Action) => void,
): DialogMount {
  const root = document.createElement('div')
  root.id = 'dialog-root'
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: '100',
  } satisfies Partial<CSSStyleDeclaration>)

  const modal = document.createElement('div')
  Object.assign(modal.style, {
    background: '#1a1024',
    border: '1px solid #5a3e8a',
    padding: '28px 32px',
    borderRadius: '8px',
    textAlign: 'center',
    maxWidth: '460px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
  } satisfies Partial<CSSStyleDeclaration>)

  const titleEl = document.createElement('h2')
  Object.assign(titleEl.style, {
    margin: '0 0 12px 0',
    fontFamily: "'UnifrakturMaguntia', ui-serif, Georgia, serif",
    fontSize: '30px',
    color: '#f5e6b0',
    letterSpacing: '0.03em',
  } satisfies Partial<CSSStyleDeclaration>)

  const bodyEl = document.createElement('p')
  Object.assign(bodyEl.style, {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#c9b3e8',
    lineHeight: '1.5',
  } satisfies Partial<CSSStyleDeclaration>)

  const buttonRow = document.createElement('div')
  Object.assign(buttonRow.style, {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  } satisfies Partial<CSSStyleDeclaration>)

  modal.appendChild(titleEl)
  modal.appendChild(bodyEl)
  modal.appendChild(buttonRow)
  root.appendChild(modal)
  parent.appendChild(root)

  let lastKey = ''

  function update(state: World): void {
    const pd = state.pendingDialog
    if (!pd) {
      root.style.display = 'none'
      lastKey = ''
      return
    }
    root.style.display = 'flex'
    const key = `${pd.title}|${pd.body}|${pd.actions.map(a => a.label).join(',')}`
    if (key === lastKey) return
    lastKey = key

    titleEl.textContent = pd.title
    bodyEl.textContent = pd.body
    buttonRow.replaceChildren()
    for (const act of pd.actions) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = act.label
      Object.assign(btn.style, {
        background: '#3e2a5c',
        color: '#f5e6b0',
        border: '1px solid #8b6f47',
        borderRadius: '4px',
        padding: '10px 16px',
        fontSize: '14px',
        cursor: 'pointer',
      } satisfies Partial<CSSStyleDeclaration>)
      btn.addEventListener('click', () => {
        if (act.resolve) onAction(act.resolve)
        onAction({ type: 'ClearDialog' })
      })
      buttonRow.appendChild(btn)
    }
  }

  return {
    root,
    update,
    destroy() { root.remove() },
  }
}
