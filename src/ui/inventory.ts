import type { World, Action, Item } from '../core/types'
import { drawSprite } from '../render/sprites'

export type InventoryMount = {
  root: HTMLElement
  update(state: World): void
}

/** Paint a 32x32 sprite icon onto a canvas, or a faded outline if no sprite. */
function paintIcon(canvas: HTMLCanvasElement, spriteName: string | null): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (spriteName) {
    ctx.imageSmoothingEnabled = false
    drawSprite(ctx, spriteName, 16, 16, 32)
  } else {
    ctx.strokeStyle = 'rgba(234, 219, 192, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(4, 4, 24, 24)
  }
}

function makeIconCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  canvas.style.imageRendering = 'pixelated'
  canvas.style.flexShrink = '0'
  return canvas
}

export function mountInventory(equipSlot: HTMLElement, invSlot: HTMLElement, onAction: (a: Action) => void): InventoryMount {
  // Equipment rows (weapon + armor, each as a flex row with icon + label)
  const equipRow = document.createElement('div')
  Object.assign(equipRow.style, { display: 'flex', flexDirection: 'column', gap: '6px' } satisfies Partial<CSSStyleDeclaration>)
  equipSlot.appendChild(equipRow)

  // Inventory grid (2 rows × 3 cols)
  const invGrid = document.createElement('div')
  Object.assign(invGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  } satisfies Partial<CSSStyleDeclaration>)
  invSlot.appendChild(invGrid)

  let lastKey = ''

  type SlotHandle = {
    el: HTMLDivElement
    canvas: HTMLCanvasElement
    sprite(): string | null
    setItem(item: Item | null): void
    onClick(cb: () => void): void
  }

  function makeInventorySlot(label: string): SlotHandle {
    const el = document.createElement('div')
    Object.assign(el.style, {
      width: '52px', height: '52px',
      border: '1px solid #5a3e8a',
      borderRadius: '6px',
      background: 'rgba(11, 6, 18, 0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      padding: '2px',
    } satisfies Partial<CSSStyleDeclaration>)

    const canvas = makeIconCanvas()
    el.appendChild(canvas)
    let currentSprite: string | null = null
    paintIcon(canvas, null)

    let onClickCb: (() => void) | null = null
    el.addEventListener('mousedown', e => { e.preventDefault(); onClickCb?.() })

    return {
      el,
      canvas,
      sprite: () => currentSprite,
      setItem(item) {
        el.title = item ? item.name : `(${label})`
        currentSprite = item ? item.sprite : null
        paintIcon(canvas, currentSprite)
      },
      onClick(cb) { onClickCb = cb },
    }
  }

  function makeEquipmentRow(slotLabel: string): SlotHandle {
    const el = document.createElement('div')
    Object.assign(el.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      border: '1px solid #5a3e8a',
      borderRadius: '6px',
      background: 'rgba(11, 6, 18, 0.78)',
      padding: '4px 6px',
      cursor: 'pointer',
      minHeight: '40px',
    } satisfies Partial<CSSStyleDeclaration>)

    const canvas = makeIconCanvas()
    el.appendChild(canvas)
    let currentSprite: string | null = null
    paintIcon(canvas, null)

    const label = document.createElement('span')
    Object.assign(label.style, {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '10px',
      color: '#c9b3e8',
    } satisfies Partial<CSSStyleDeclaration>)
    label.textContent = '— empty —'
    el.appendChild(label)

    let onClickCb: (() => void) | null = null
    el.addEventListener('mousedown', e => { e.preventDefault(); onClickCb?.() })

    return {
      el,
      canvas,
      sprite: () => currentSprite,
      setItem(item) {
        el.title = item ? item.name : `(${slotLabel})`
        currentSprite = item ? item.sprite : null
        paintIcon(canvas, currentSprite)

        if (item) {
          const stat = item.body.kind === 'weapon'
            ? `+${item.body.atk} atk`
            : item.body.kind === 'armor'
              ? `+${item.body.def} def`
              : ''
          label.textContent = `${item.name}${stat ? ` (${stat})` : ''}`
        } else {
          label.textContent = '— empty —'
        }
      },
      onClick(cb) { onClickCb = cb },
    }
  }

  const weaponSlot = makeEquipmentRow('weapon')
  const armorSlot = makeEquipmentRow('armor')
  equipRow.appendChild(weaponSlot.el)
  equipRow.appendChild(armorSlot.el)

  const invSlots = Array.from({ length: 6 }, () => makeInventorySlot(''))
  for (const s of invSlots) invGrid.appendChild(s.el)

  // Per-frame redraw so multi-frame sprites animate AND single-frame items
  // re-render the moment the atlas finishes loading (atlas may load after
  // the first paint when no sprite is yet drawn). Cheap: 8 small canvases.
  const allSlots: SlotHandle[] = [weaponSlot, armorSlot, ...invSlots]
  function tick(): void {
    for (const s of allSlots) {
      const sp = s.sprite()
      if (sp) paintIcon(s.canvas, sp)
    }
    requestAnimationFrame(tick)
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick)

  function update(state: World): void {
    const key = JSON.stringify({
      w: state.equipment.weapon?.instanceId ?? '',
      a: state.equipment.armor?.instanceId ?? '',
      inv: state.inventory.map(i => i.instanceId),
    })
    if (key === lastKey) return
    lastKey = key

    weaponSlot.setItem(state.equipment.weapon)
    weaponSlot.onClick(() => { if (state.equipment.weapon) onAction({ type: 'UnequipItem', slot: 'weapon' }) })
    armorSlot.setItem(state.equipment.armor)
    armorSlot.onClick(() => { if (state.equipment.armor) onAction({ type: 'UnequipItem', slot: 'armor' }) })

    for (let i = 0; i < 6; i++) {
      const item = state.inventory[i] ?? null
      invSlots[i].setItem(item)
      invSlots[i].onClick(() => {
        if (!item) return
        if (item.body.kind === 'potion') onAction({ type: 'UseItem', instanceId: item.instanceId })
        else onAction({ type: 'EquipItem', instanceId: item.instanceId })
      })
    }
  }

  return { root: equipSlot, update }
}
