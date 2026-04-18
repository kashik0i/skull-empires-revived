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

  // ── Top status bar (HP / stats / floor) — compact, above everything ──
  const topBar = document.createElement('div')
  Object.assign(topBar.style, {
    position: 'absolute',
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
    background: 'rgba(11, 6, 18, 0.78)',
    border: '1px solid #5a3e8a',
    borderRadius: '18px',
    padding: '6px 14px',
    fontSize: '13px',
    color: '#eadbc0',
    fontVariantNumeric: 'tabular-nums',
    zIndex: '3',
  } satisfies Partial<CSSStyleDeclaration>)

  const hpBox = document.createElement('div')
  Object.assign(hpBox.style, { display: 'flex', alignItems: 'center', gap: '6px' } satisfies Partial<CSSStyleDeclaration>)

  const hpBarOuter = document.createElement('div')
  Object.assign(hpBarOuter.style, {
    width: '120px',
    height: '10px',
    background: '#1a1024',
    border: '1px solid #3e2a5c',
    borderRadius: '5px',
    overflow: 'hidden',
  } satisfies Partial<CSSStyleDeclaration>)
  const hpBarInner = document.createElement('div')
  Object.assign(hpBarInner.style, {
    height: '100%',
    background: 'linear-gradient(90deg, #e0bdf7, #b7a3d9)',
    width: '100%',
    transition: 'width 120ms ease-out',
  } satisfies Partial<CSSStyleDeclaration>)
  hpBarOuter.appendChild(hpBarInner)

  const hpText = document.createElement('span')
  hpText.style.minWidth = '54px'
  hpText.textContent = 'HP 20/20'

  hpBox.appendChild(hpBarOuter)
  hpBox.appendChild(hpText)

  const sep1 = makeSep()
  const atkStat = makeStat('⚔', '4')
  const sep2 = makeSep()
  const defStat = makeStat('🛡', '1')
  const sep3 = makeSep()
  const depthStat = makeStat('⬇', '1/5')

  topBar.appendChild(hpBox)
  topBar.appendChild(sep1)
  topBar.appendChild(atkStat.el)
  topBar.appendChild(sep2)
  topBar.appendChild(defStat.el)
  topBar.appendChild(sep3)
  topBar.appendChild(depthStat.el)

  // ── Descend button — shows below the top bar when hero stands on stairs ──
  const descendBtn = document.createElement('button')
  descendBtn.type = 'button'
  descendBtn.textContent = 'Descend ↓'
  Object.assign(descendBtn.style, {
    position: 'absolute',
    top: '52px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#5a3e8a',
    color: '#f5e6b0',
    border: '1px solid #f0b770',
    borderRadius: '6px',
    padding: '8px 14px',
    fontFamily: 'inherit',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'none',
    zIndex: '3',
    boxShadow: '0 0 12px rgba(240, 183, 112, 0.4)',
  } satisfies Partial<CSSStyleDeclaration>)

  // ── Log — bottom-left, small, filtered, fades old lines ──
  const logPanel = document.createElement('div')
  Object.assign(logPanel.style, {
    position: 'absolute',
    left: '12px',
    bottom: '80px',   // sits above the card hand
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

  root.appendChild(topBar)
  root.appendChild(descendBtn)
  root.appendChild(logPanel)
  container.appendChild(root)

  let descendCb: (() => void) | null = null
  descendBtn.addEventListener('click', () => { descendCb?.() })

  // Lines we don't want cluttering the log.
  const NOISE_PREFIXES = ['turn advance', 'hero intent', 'hero path']

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
      atkStat.setValue(String(hero.atk))
      defStat.setValue(String(hero.def))
    }
    depthStat.setValue(`${state.run.depth}/5`)

    const heroOnStairs = hero && hero.alive
      && state.floor.tiles[hero.pos.y * state.floor.width + hero.pos.x] === Tile.Stairs
    descendBtn.style.display = heroOnStairs ? 'block' : 'none'

    // Filter + fade log lines
    logPanel.replaceChildren()
    const filtered = state.log.filter(l => !NOISE_PREFIXES.some(p => l.text.startsWith(p))).slice(-5)
    for (let i = 0; i < filtered.length; i++) {
      const line = document.createElement('div')
      line.textContent = filtered[i].text
      const age = filtered.length - 1 - i
      line.style.opacity = String(1 - age * 0.18)
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

function makeSep(): HTMLElement {
  const sep = document.createElement('span')
  Object.assign(sep.style, {
    width: '1px',
    height: '16px',
    background: 'rgba(90, 62, 138, 0.7)',
  } satisfies Partial<CSSStyleDeclaration>)
  return sep
}

function makeStat(icon: string, initialValue: string): { el: HTMLElement; setValue: (v: string) => void } {
  const el = document.createElement('div')
  Object.assign(el.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } satisfies Partial<CSSStyleDeclaration>)
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
    setValue(v: string) {
      if (valueEl.textContent !== v) valueEl.textContent = v
    },
  }
}
