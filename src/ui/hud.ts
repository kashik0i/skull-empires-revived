import { Tile, type World } from '../core/types'
import { effectiveAtk, effectiveDef } from '../core/selectors'

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

  // Per-line fade: each line ages from its own bornAt. When the visible set
  // exceeds MAX_VISIBLE_LINES, the oldest excess are forced into a fast
  // fade-out so the queue recycles line-by-line instead of all at once.
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

    // Ingest any new log entries since last update (state.log only grows).
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

    // Overflow: force oldest excess lines into their fade-out phase so only
    // MAX_VISIBLE_LINES stay at full opacity; they'll fade one-by-one as new
    // lines arrive rather than the whole batch vanishing together.
    const overflow = liveLines.length - MAX_VISIBLE_LINES
    if (overflow > 0) {
      const forcedBornAt = now - (FADE_LIFE_MS - OVERFLOW_EVICT_MS)
      for (let i = 0; i < overflow; i++) {
        const line = liveLines[i]
        if (line.bornAt > forcedBornAt) line.bornAt = forcedBornAt
      }
    }

    // Fade each live line based on age, drop fully-faded lines.
    for (let i = liveLines.length - 1; i >= 0; i--) {
      const line = liveLines[i]
      const age = now - line.bornAt
      if (age >= FADE_LIFE_MS) {
        line.el.remove()
        liveLines.splice(i, 1)
        continue
      }
      // Held at full opacity for 40% of life, then linear fade over remaining 60%.
      const held = FADE_LIFE_MS * 0.4
      const opacity = age < held ? 1 : 1 - (age - held) / (FADE_LIFE_MS - held)
      line.el.style.opacity = opacity.toFixed(3)
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
