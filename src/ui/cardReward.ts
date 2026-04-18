import type { World } from '../core/types'
import { getCard } from '../content/cardLoader'

export type CardReward = {
  update(state: World): void
  destroy(): void
}

export function mountCardReward(
  parent: HTMLElement,
  onPick: (cardId: string) => void,
): CardReward {
  const root = document.createElement('div')
  root.id = 'card-reward-root'
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
    padding: '32px',
    borderRadius: '8px',
    textAlign: 'center',
    maxWidth: '400px',
  } satisfies Partial<CSSStyleDeclaration>)

  const title = document.createElement('h2')
  title.textContent = 'Choose a card'
  Object.assign(title.style, {
    margin: '0 0 24px 0',
    fontFamily: "'UnifrakturMaguntia', ui-serif, Georgia, serif",
    fontSize: '32px',
    color: '#f5e6b0',
    letterSpacing: '0.03em',
  } satisfies Partial<CSSStyleDeclaration>)

  const buttonsContainer = document.createElement('div')
  Object.assign(buttonsContainer.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  } satisfies Partial<CSSStyleDeclaration>)

  modal.appendChild(title)
  modal.appendChild(buttonsContainer)
  root.appendChild(modal)
  parent.appendChild(root)

  let lastChoicesKey = ''

  function rebuild(choices: readonly string[]): void {
    buttonsContainer.replaceChildren()
    for (const cardId of choices) {
      const card = getCard(cardId)

      const btn = document.createElement('button')
      btn.type = 'button'
      Object.assign(btn.style, {
        background: '#3e2a5c',
        color: '#f5e6b0',
        border: '1px solid #8b6f47',
        padding: '14px',
        borderRadius: '4px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'center',
      } satisfies Partial<CSSStyleDeclaration>)

      btn.title = card.description

      const nameEl = document.createElement('div')
      nameEl.textContent = card.name
      Object.assign(nameEl.style, {
        fontFamily: "'UnifrakturMaguntia', ui-serif, Georgia, serif",
        fontSize: '22px',
        marginBottom: '6px',
        color: '#f0b770',
        letterSpacing: '0.02em',
      } satisfies Partial<CSSStyleDeclaration>)

      const descEl = document.createElement('div')
      descEl.textContent = card.description
      Object.assign(descEl.style, {
        fontSize: '13px',
        color: '#c9b3e8',
      } satisfies Partial<CSSStyleDeclaration>)

      btn.appendChild(nameEl)
      btn.appendChild(descEl)
      btn.addEventListener('click', () => { onPick(cardId) })

      buttonsContainer.appendChild(btn)
    }
  }

  function update(state: World): void {
    const shouldShow = state.phase === 'card_reward' && state.run.pendingReward !== null
    root.style.display = shouldShow ? 'flex' : 'none'

    if (!shouldShow || !state.run.pendingReward) {
      lastChoicesKey = ''
      return
    }

    const choices = state.run.pendingReward.choices
    const key = choices.join('|')
    if (key !== lastChoicesKey) {
      lastChoicesKey = key
      rebuild(choices)
    }
  }

  return {
    update,
    destroy() {
      root.remove()
    },
  }
}
