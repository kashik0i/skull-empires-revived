import type { World } from '../core/types'

export type Overlay = {
  update(state: World): void
  onRestart(handler: () => void): void
  onShare(handler: () => void): void
}

export function mountOverlay(container: HTMLElement): Overlay {
  const root = document.createElement('div')
  root.id = 'overlay-root'
  root.style.position = 'absolute'
  root.style.inset = '0'
  root.style.display = 'none'
  root.style.alignItems = 'center'
  root.style.justifyContent = 'center'
  root.style.background = 'rgba(11, 6, 18, 0.75)'

  const card = document.createElement('div')
  card.style.background = '#1a1024'
  card.style.border = '1px solid #5a3e8a'
  card.style.padding = '24px 32px'
  card.style.borderRadius = '8px'
  card.style.textAlign = 'center'
  card.style.minWidth = '280px'

  const title = document.createElement('h1')
  title.style.margin = '0 0 12px 0'
  title.style.fontSize = '28px'
  title.style.color = '#f5e6b0'

  const subtitle = document.createElement('div')
  subtitle.style.margin = '0 0 16px 0'
  subtitle.style.color = '#c9b3e8'
  subtitle.style.fontSize = '13px'

  const buttons = document.createElement('div')
  buttons.style.display = 'flex'
  buttons.style.gap = '8px'
  buttons.style.justifyContent = 'center'

  const restartBtn = document.createElement('button')
  restartBtn.type = 'button'
  restartBtn.textContent = 'New run'
  styleButton(restartBtn)

  const shareBtn = document.createElement('button')
  shareBtn.type = 'button'
  shareBtn.textContent = 'Share URL'
  styleButton(shareBtn)

  buttons.appendChild(restartBtn)
  buttons.appendChild(shareBtn)
  card.appendChild(title)
  card.appendChild(subtitle)
  card.appendChild(buttons)
  root.appendChild(card)
  container.appendChild(root)

  let restartHandler: (() => void) | null = null
  let shareHandler: (() => void) | null = null
  restartBtn.addEventListener('click', () => { restartHandler?.() })
  shareBtn.addEventListener('click', () => { shareHandler?.() })

  function update(state: World): void {
    if (state.phase === 'run_won') {
      title.textContent = 'You broke the bone tide.'
      subtitle.textContent = `Tick ${state.tick}. Seed ${state.seed}.`
      root.style.display = 'flex'
    } else if (state.phase === 'run_lost') {
      title.textContent = 'You fell to the bone knights.'
      subtitle.textContent = `Tick ${state.tick}. Seed ${state.seed}.`
      root.style.display = 'flex'
    } else {
      root.style.display = 'none'
    }
  }

  return {
    update,
    onRestart(h) { restartHandler = h },
    onShare(h) { shareHandler = h },
  }
}

function styleButton(btn: HTMLButtonElement): void {
  btn.style.background = '#3e2a5c'
  btn.style.color = '#f5e6b0'
  btn.style.border = '1px solid #5a3e8a'
  btn.style.padding = '8px 16px'
  btn.style.borderRadius = '4px'
  btn.style.fontFamily = 'inherit'
  btn.style.fontSize = '14px'
  btn.style.cursor = 'pointer'
}
