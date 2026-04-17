import { Tile, type World } from '../core/types'

export type Hud = {
  update(state: World): void
  root: HTMLElement
  onDescend(cb: () => void): void
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
  root.style.width = '240px'
  root.style.boxSizing = 'border-box'

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

  const descendBtn = document.createElement('button')
  descendBtn.type = 'button'
  descendBtn.textContent = 'Descend ↓'
  Object.assign(descendBtn.style, {
    background: '#5a3e8a',
    color: '#f5e6b0',
    border: '1px solid #f0b770',
    borderRadius: '6px',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'none',
  } satisfies Partial<CSSStyleDeclaration>)

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
  root.appendChild(descendBtn)
  root.appendChild(logPanel)
  container.appendChild(root)

  let descendCb: (() => void) | null = null
  descendBtn.addEventListener('click', () => { descendCb?.() })

  function update(state: World): void {
    const hero = state.actors[state.heroId]
    if (hero) {
      hpLabel.textContent = `HP ${Math.max(0, hero.hp)} / ${hero.maxHp}`
      const ratio = Math.max(0, Math.min(1, hero.hp / hero.maxHp))
      hpBarInner.style.width = `${(ratio * 100).toFixed(0)}%`
    }
    depthEl.textContent = `Floor ${state.run.depth} / 5`

    const heroOnStairs = hero && hero.alive
      && state.floor.tiles[hero.pos.y * state.floor.width + hero.pos.x] === Tile.Stairs
    descendBtn.style.display = heroOnStairs ? 'block' : 'none'

    logPanel.replaceChildren()
    const recent = state.log.slice(-8)
    for (const entry of recent) {
      const line = document.createElement('div')
      line.textContent = `[${entry.tick}] ${entry.text}`
      line.style.whiteSpace = 'nowrap'
      line.style.overflow = 'hidden'
      line.style.textOverflow = 'ellipsis'
      logPanel.appendChild(line)
    }
  }

  return {
    root,
    update,
    onDescend(cb) { descendCb = cb },
  }
}
