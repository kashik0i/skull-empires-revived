import { Tile, type World } from '../core/types'
import { effectiveAtk, effectiveDef } from '../core/selectors'

export type Hud = {
  update(state: World): void
  root: HTMLElement
  onDescend(cb: () => void): void
  descendButton(): HTMLElement
}

export function mountHud(statsSlot: HTMLElement, descendSlot: HTMLElement, logParent: HTMLElement): Hud {
  // === Stats block (in side panel) ===
  const root = document.createElement('div')
  Object.assign(root.style, {
    background: 'rgba(11, 6, 18, 0.78)',
    border: '1px solid #5a3e8a',
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '13px',
    color: '#eadbc0',
    fontVariantNumeric: 'tabular-nums',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  statsSlot.appendChild(root)

  // HP row
  const hpBox = document.createElement('div')
  Object.assign(hpBox.style, { display: 'flex', alignItems: 'center', gap: '6px' } satisfies Partial<CSSStyleDeclaration>)
  const hpBarOuter = document.createElement('div')
  Object.assign(hpBarOuter.style, {
    flex: '1', height: '10px', background: '#1a1024',
    border: '1px solid #3e2a5c', borderRadius: '5px', overflow: 'hidden',
  } satisfies Partial<CSSStyleDeclaration>)
  const hpBarInner = document.createElement('div')
  Object.assign(hpBarInner.style, {
    height: '100%', background: 'linear-gradient(90deg, #e0bdf7, #b7a3d9)',
    width: '100%', transition: 'width 120ms ease-out',
  } satisfies Partial<CSSStyleDeclaration>)
  hpBarOuter.appendChild(hpBarInner)
  const hpText = document.createElement('span')
  hpText.style.minWidth = '54px'
  hpText.textContent = 'HP 20/20'
  hpBox.appendChild(hpBarOuter)
  hpBox.appendChild(hpText)
  root.appendChild(hpBox)

  // Stats row (atk/def/depth)
  const statsRow = document.createElement('div')
  Object.assign(statsRow.style, { display: 'flex', justifyContent: 'space-between' } satisfies Partial<CSSStyleDeclaration>)
  const atkStat = makeStat('⚔', '4')
  const defStat = makeStat('🛡', '1')
  const depthStat = makeStat('⬇', '1/5')
  statsRow.appendChild(atkStat.el)
  statsRow.appendChild(defStat.el)
  statsRow.appendChild(depthStat.el)
  root.appendChild(statsRow)

  // === Descend button (in panel descend slot) ===
  const descendBtn = document.createElement('button')
  descendBtn.type = 'button'
  descendBtn.textContent = 'Descend ↓'
  Object.assign(descendBtn.style, {
    width: '100%',
    background: '#5a3e8a',
    color: '#f5e6b0',
    border: '1px solid #f0b770',
    borderRadius: '6px',
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'none',
    boxShadow: '0 0 12px rgba(240, 183, 112, 0.4)',
  } satisfies Partial<CSSStyleDeclaration>)
  descendSlot.appendChild(descendBtn)

  // === Log panel (floats over the play area, bottom-left) ===
  const logPanel = document.createElement('div')
  Object.assign(logPanel.style, {
    position: 'absolute',
    left: '12px',
    bottom: '12px',
    maxWidth: '280px',
    maxHeight: '110px',
    overflow: 'hidden',
    fontSize: '11px',
    fontFamily: 'ui-monospace, monospace',
    color: 'rgba(234, 219, 192, 0.85)',
    textShadow: '0 1px 2px rgba(0,0,0,0.85)',
    pointerEvents: 'none',
    zIndex: '3',
  } satisfies Partial<CSSStyleDeclaration>)
  logParent.appendChild(logPanel)

  let descendCb: (() => void) | null = null
  descendBtn.addEventListener('click', () => { descendCb?.() })

  const NOISE_PREFIXES = ['turn advance', 'hero intent', 'hero path']
  const FADE_LIFE_MS = 6000
  const MAX_VISIBLE_LINES = 5
  const OVERFLOW_EVICT_MS = 500
  type LogLine = { key: string; text: string; bornAt: number; el: HTMLDivElement }
  const liveLines: LogLine[] = []
  let lastLogLen = 0

  function update(state: World): void {
    const hero = state.actors[state.heroId]
    if (hero) {
      hpText.textContent = `HP ${Math.max(0, hero.hp)}/${hero.maxHp}`
      const ratio = Math.max(0, Math.min(1, hero.hp / hero.maxHp))
      hpBarInner.style.width = `${(ratio * 100).toFixed(0)}%`
      hpBarInner.style.background = ratio < 0.3
        ? 'linear-gradient(90deg, #b7323e, #7a1f2e)'
        : ratio < 0.6
          ? 'linear-gradient(90deg, #f0b770, #b7753e)'
          : 'linear-gradient(90deg, #e0bdf7, #b7a3d9)'
      atkStat.setValue(String(effectiveAtk(state, state.heroId)))
      defStat.setValue(String(effectiveDef(state, state.heroId)))
    }
    depthStat.setValue(`${state.run.depth}/5`)

    const heroOnStairs = hero && hero.alive
      && state.floor.tiles[hero.pos.y * state.floor.width + hero.pos.x] === Tile.Stairs
    descendBtn.style.display = heroOnStairs ? 'block' : 'none'

    if (state.log.length !== lastLogLen) {
      const now = performance.now()
      for (let i = lastLogLen; i < state.log.length; i++) {
        const entry = state.log[i]
        if (NOISE_PREFIXES.some(p => entry.text.startsWith(p))) continue
        const el = document.createElement('div')
        el.textContent = entry.text
        Object.assign(el.style, {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'opacity 200ms linear',
        } satisfies Partial<CSSStyleDeclaration>)
        logPanel.appendChild(el)
        liveLines.push({ key: `${entry.tick}-${i}`, text: entry.text, bornAt: now, el })
      }
      lastLogLen = state.log.length
    }

    const now = performance.now()
    const overflow = liveLines.length - MAX_VISIBLE_LINES
    if (overflow > 0) {
      const forcedBornAt = now - (FADE_LIFE_MS - OVERFLOW_EVICT_MS)
      for (let i = 0; i < overflow; i++) {
        const line = liveLines[i]
        if (line.bornAt > forcedBornAt) line.bornAt = forcedBornAt
      }
    }
    for (let i = liveLines.length - 1; i >= 0; i--) {
      const line = liveLines[i]
      const age = now - line.bornAt
      if (age >= FADE_LIFE_MS) {
        line.el.remove()
        liveLines.splice(i, 1)
        continue
      }
      const held = FADE_LIFE_MS * 0.4
      const opacity = age < held ? 1 : 1 - (age - held) / (FADE_LIFE_MS - held)
      line.el.style.opacity = opacity.toFixed(3)
    }
  }

  return {
    root,
    update,
    onDescend(cb) { descendCb = cb },
    descendButton() { return descendBtn },
  }
}

function makeStat(icon: string, initialValue: string): { el: HTMLElement; setValue: (v: string) => void } {
  const el = document.createElement('div')
  Object.assign(el.style, { display: 'flex', alignItems: 'center', gap: '4px' } satisfies Partial<CSSStyleDeclaration>)
  const iconEl = document.createElement('span')
  iconEl.textContent = icon
  iconEl.style.fontSize = '13px'
  const valueEl = document.createElement('span')
  valueEl.textContent = initialValue
  valueEl.style.minWidth = '18px'
  el.appendChild(iconEl)
  el.appendChild(valueEl)
  return {
    el,
    setValue(v: string) { if (valueEl.textContent !== v) valueEl.textContent = v },
  }
}
