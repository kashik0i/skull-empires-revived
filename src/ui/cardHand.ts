import type { World } from '../core/types'
import { getCard } from '../content/cardLoader'

export type CardHand = {
  update(state: World): void
  destroy(): void
  getTargetingCardId(): string | null
  cancelTargeting(): void
}

export function mountCardHand(
  parent: HTMLElement,
  onPlay: (cardId: string, targetId?: string) => void,
  onTargetSelectStart: () => void,
  onTargetSelectCancel: () => void,
): CardHand {
  const root = document.createElement('div')
  root.id = 'card-hand'
  Object.assign(root.style, {
    position: 'absolute',
    bottom: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    zIndex: '5',
  } satisfies Partial<CSSStyleDeclaration>)

  parent.appendChild(root)

  let targetingCardId: string | null = null
  const cardElements: Map<string, HTMLElement> = new Map()
  let lastHandKey = ''

  function handleCardClick(cardId: string): void {
    const card = getCard(cardId)
    if (card.target === 'self' || card.target === 'none') {
      onPlay(cardId)
    } else if (card.target === 'enemy') {
      targetingCardId = cardId
      onTargetSelectStart()
      updateStyles()
    }
  }

  function updateStyles(): void {
    for (const [cid, btn] of cardElements) {
      if (cid === targetingCardId) {
        btn.style.opacity = '1'
        btn.style.borderColor = '#f0b770'
      } else if (targetingCardId) {
        btn.style.opacity = '0.4'
        btn.style.borderColor = '#3e2a5c'
      } else {
        btn.style.opacity = '1'
        btn.style.borderColor = '#8b6f47'
      }
    }
  }

  function rebuild(hand: readonly string[]): void {
    root.replaceChildren()
    cardElements.clear()

    for (const cardId of hand) {
      const card = getCard(cardId)

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = card.name
      btn.title = card.description
      Object.assign(btn.style, {
        width: '80px',
        background: '#3e2a5c',
        color: '#f5e6b0',
        border: '1px solid #8b6f47',
        borderRadius: '4px',
        padding: '8px 4px',
        fontFamily: 'inherit',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      } satisfies Partial<CSSStyleDeclaration>)

      btn.addEventListener('click', () => {
        if (targetingCardId && targetingCardId !== cardId) {
          targetingCardId = null
          onTargetSelectCancel()
        }
        handleCardClick(cardId)
      })

      root.appendChild(btn)
      cardElements.set(cardId, btn)
    }
  }

  function update(state: World): void {
    const key = state.run.cards.hand.join('|')
    if (key !== lastHandKey) {
      lastHandKey = key
      rebuild(state.run.cards.hand)
    }
    updateStyles()
  }

  return {
    update,
    destroy() {
      root.remove()
    },
    getTargetingCardId() {
      return targetingCardId
    },
    cancelTargeting() {
      targetingCardId = null
      updateStyles()
    },
  }
}
