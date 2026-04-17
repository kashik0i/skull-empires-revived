import type { World } from '../core/types'

export type Hud = {
  update(state: World): void
  root: HTMLElement
}

export function mountHud(container: HTMLElement): Hud {
  container.replaceChildren()

  const root = document.createElement('div')
  root.id = 'hud-root'
  root.style.position = 'absolute'
  root.style.left = '12px'
  root.style.top = '12px'
  root.style.display = 'flex'
  root.style.flexDirection = 'column'
  root.style.gap = '8px'
  root.style.maxWidth = '360px'

  const hpPanel = document.createElement('div')
  hpPanel.style.background = 'rgba(18, 10, 28, 0.8)'
  hpPanel.style.border = '1px solid #5a3e8a'
  hpPanel.style.padding = '6px 10px'
  hpPanel.style.borderRadius = '6px'
  const hpLabel = document.createElement('div')
  hpLabel.style.fontSize = '14px'
  const hpBarOuter = document.createElement('div')
  hpBarOuter.style.marginTop = '4px'
  hpBarOuter.style.height = '6px'
  hpBarOuter.style.background = '#2a1c3a'
  hpBarOuter.style.borderRadius = '3px'
  const hpBarInner = document.createElement('div')
  hpBarInner.style.height = '100%'
  hpBarInner.style.background = '#e0bdf7'
  hpBarInner.style.borderRadius = '3px'
  hpBarInner.style.width = '100%'
  hpBarOuter.appendChild(hpBarInner)
  hpPanel.appendChild(hpLabel)
  hpPanel.appendChild(hpBarOuter)

  const depthPanel = document.createElement('div')
  depthPanel.style.background = 'rgba(18, 10, 28, 0.8)'
  depthPanel.style.border = '1px solid #5a3e8a'
  depthPanel.style.padding = '6px 10px'
  depthPanel.style.borderRadius = '6px'
  const depthEl = document.createElement('div')
  depthEl.style.fontSize = '14px'
  depthPanel.appendChild(depthEl)

  const logPanel = document.createElement('div')
  logPanel.style.background = 'rgba(18, 10, 28, 0.8)'
  logPanel.style.border = '1px solid #3e2a5c'
  logPanel.style.padding = '6px 10px'
  logPanel.style.borderRadius = '6px'
  logPanel.style.fontSize = '12px'
  logPanel.style.maxHeight = '160px'
  logPanel.style.overflow = 'hidden'

  root.appendChild(hpPanel)
  root.appendChild(depthPanel)
  root.appendChild(logPanel)
  container.appendChild(root)

  function update(state: World): void {
    const hero = state.actors[state.heroId]
    if (hero) {
      hpLabel.textContent = `HP ${Math.max(0, hero.hp)} / ${hero.maxHp}`
      const ratio = Math.max(0, Math.min(1, hero.hp / hero.maxHp))
      hpBarInner.style.width = `${(ratio * 100).toFixed(0)}%`
    }
    depthEl.textContent = `Floor ${state.run.depth} / 5`
    logPanel.replaceChildren()
    const recent = state.log.slice(-8)
    for (const entry of recent) {
      const line = document.createElement('div')
      line.textContent = `[${entry.tick}] ${entry.text}`
      logPanel.appendChild(line)
    }
  }

  return { root, update }
}
