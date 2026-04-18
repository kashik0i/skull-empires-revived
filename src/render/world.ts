import { Tile, type World } from '../core/types'
import { getArchetype } from '../content/loader'
import { getItemDef } from '../content/itemLoader'
import { palette } from '../content/palette'
import { drawShape } from './shape'
import { drawSprite, drawTileSprite, itemSpriteName, isAtlasReady } from './sprites'
import { computeVisible } from './fov'
import type { DisplayState } from './display'

/**
 * Deterministic hash for tile (x, y) position to pick a variant.
 * Returns same value for same (x, y) always.
 */
function tileVariantHash(x: number, y: number, n: number): number {
  return ((x * 73 + y * 37) >>> 0) % n
}

export type RenderOptions = {
  tileSize: number
  shakeOffset: { x: number; y: number }
  cameraOffset: { x: number; y: number }
  showHeroPath?: boolean
  revealMap?: boolean
  /** Bitset (length w*h) tracking every tile ever seen on this floor. Mutated by renderWorld. */
  seenTiles?: Uint8Array
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  state: World,
  display: DisplayState,
  opts: RenderOptions,
): void {
  const { tileSize, shakeOffset, cameraOffset, showHeroPath, revealMap, seenTiles } = opts
  const { floor } = state
  const hero = state.actors[state.heroId]

  // Visibility mask — computed fresh each frame from hero pos, OR fully-on when revealMap.
  const visible = revealMap || !hero
    ? null
    : computeVisible(floor, hero.pos)

  // Fold visible tiles into the seen-memory bitset so dim tiles persist.
  if (visible && seenTiles && seenTiles.length === floor.tiles.length) {
    for (let i = 0; i < visible.length; i++) {
      if (visible[i]) seenTiles[i] = 1
    }
  }

  // Fill background before any translate so it always covers the full canvas.
  ctx.fillStyle = palette.obsidianBlack
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.save()
  ctx.translate(shakeOffset.x - cameraOffset.x, shakeOffset.y - cameraOffset.y)
  ctx.imageSmoothingEnabled = false
  const atlasReady = isAtlasReady()

  function tileVisState(idx: number): 'visible' | 'seen' | 'unknown' {
    if (!visible) return 'visible'                // revealMap on
    if (visible[idx]) return 'visible'
    if (seenTiles && seenTiles[idx]) return 'seen'
    return 'unknown'
  }

  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const idx = y * floor.width + x
      const vis = tileVisState(idx)
      if (vis === 'unknown') continue  // stay void-black

      ctx.globalAlpha = vis === 'seen' ? 0.35 : 1

      const t = floor.tiles[idx]
      if (t === Tile.Floor) {
        if (atlasReady) {
          const floorVariants = ['floor_1', 'floor_2', 'floor_3']
          const floorSprite = floorVariants[tileVariantHash(x, y, floorVariants.length)]
          drawTileSprite(ctx, floorSprite, x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleLite
          ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1)
        }
      } else if (t === Tile.Wall) {
        if (atlasReady) {
          // Always use the wall body sprite — `wall_top_mid` in 0x72 is designed
          // to overhang from the row above as a 3D cap, so it renders mostly
          // transparent in its own tile box and looks like a thin strip. The
          // body sprite gives a clean flat top-down brick wall.
          drawTileSprite(ctx, 'wall_mid', x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurple
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
        }
      } else if (t === Tile.Stairs) {
        if (atlasReady) {
          const stairsVariants = ['floor_1', 'floor_2', 'floor_3']
          const stairsSprite = stairsVariants[tileVariantHash(x, y, stairsVariants.length)]
          drawTileSprite(ctx, stairsSprite, x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleLite
          ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1)
        }
        ctx.fillStyle = palette.silkFlameAmber
        const pad = Math.max(2, Math.floor(tileSize * 0.15))
        const steps = 3
        const stepH = Math.floor((tileSize - pad * 2) / steps)
        for (let i = 0; i < steps; i++) {
          const w = tileSize - pad * 2 - i * Math.floor(stepH * 0.6)
          ctx.fillRect(
            x * tileSize + pad + Math.floor(i * stepH * 0.3),
            y * tileSize + pad + i * stepH,
            w,
            Math.max(2, stepH - 1),
          )
        }
      } else if (t === Tile.Shrine) {
        if (atlasReady) {
          const shrineVariants = ['floor_1', 'floor_2', 'floor_3']
          const shrineSprite = shrineVariants[tileVariantHash(x, y, shrineVariants.length)]
          drawTileSprite(ctx, shrineSprite, x, y, tileSize)
        } else {
          ctx.fillStyle = palette.deepPurpleLite
          ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1)
        }
        ctx.fillStyle = palette.silkFlameAmber
        const cx = x * tileSize + tileSize / 2
        const top = y * tileSize + Math.floor(tileSize * 0.2)
        const pillarH = Math.floor(tileSize * 0.6)
        const pillarW = Math.floor(tileSize * 0.25)
        ctx.fillRect(cx - Math.floor(pillarW / 2), top, pillarW, pillarH)
        ctx.fillStyle = palette.bloodCrimson
        const flameY = top + Math.floor(Math.sin(performance.now() / 300) * 2)
        ctx.beginPath()
        ctx.arc(cx, flameY, Math.floor(tileSize * 0.12), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1

  function posVisible(x: number, y: number): boolean {
    if (!visible) return true
    return visible[y * floor.width + x] === 1
  }

  if (showHeroPath && state.heroPath.length > 0) {
    ctx.fillStyle = palette.silkFlameAmber
    ctx.globalAlpha = 0.55
    for (const step of state.heroPath) {
      const cx = step.x * tileSize + tileSize / 2
      const cy = step.y * tileSize + tileSize / 2
      ctx.beginPath()
      ctx.arc(cx, cy, tileSize * 0.15, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Dropped items — legacy flask system, kept for back-compat with old saves.
  if (atlasReady) {
    const bob = Math.sin(performance.now() / 400) * tileSize * 0.08
    for (const item of state.droppedItems) {
      if (!posVisible(item.pos.x, item.pos.y)) continue
      const sprite = itemSpriteName(item.kind)
      if (!sprite) continue
      const cx = item.pos.x * tileSize + tileSize / 2
      const cy = item.pos.y * tileSize + tileSize / 2 + bob
      drawSprite(ctx, sprite, cx, cy, tileSize)
    }
  }

  // Ground items — new Phase 1E system. Render with the item's own sprite name.
  if (atlasReady) {
    const bob = Math.sin(performance.now() / 400) * tileSize * 0.08
    for (const ground of state.groundItems) {
      if (!posVisible(ground.pos.x, ground.pos.y)) continue
      const def = getItemDef(ground.itemId)
      const cx = ground.pos.x * tileSize + tileSize / 2
      const cy = ground.pos.y * tileSize + tileSize / 2 + bob
      drawSprite(ctx, def.sprite, cx, cy, tileSize)
    }
  }

  // Lore scrolls — bobbing animation, only shown in visible tiles.
  if (atlasReady) {
    const bob = Math.sin(performance.now() / 400) * tileSize * 0.08
    for (const scroll of state.loreScrolls) {
      if (!posVisible(scroll.pos.x, scroll.pos.y)) continue
      const cx = scroll.pos.x * tileSize + tileSize / 2
      const cy = scroll.pos.y * tileSize + tileSize / 2 + bob
      drawSprite(ctx, 'scroll', cx, cy, tileSize)
    }
  }

  const targetId = state.heroIntent?.kind === 'attack' ? state.heroIntent.targetId : null
  const pulseAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(performance.now() / 180))

  for (const d of display.all()) {
    const actor = state.actors[d.id]
    if (!actor || !actor.alive) continue
    // Actors in unseen tiles are hidden — hero always shown regardless.
    if (actor.id !== state.heroId && !posVisible(actor.pos.x, actor.pos.y)) continue
    const def = getArchetype(actor.archetype)
    const cx = d.x * tileSize + tileSize / 2
    const cy = d.y * tileSize + tileSize / 2

    if (actor.id === targetId) {
      ctx.strokeStyle = palette.bloodCrimson
      ctx.lineWidth = 2
      ctx.globalAlpha = pulseAlpha
      ctx.beginPath()
      ctx.arc(cx, cy, tileSize * 0.55, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const drewSprite = atlasReady && def.sprite
      ? drawSprite(ctx, def.sprite, cx, cy, tileSize, undefined, d.facing === 'left')
      : false
    if (!drewSprite) {
      drawShape(ctx, def.shape, cx, cy, tileSize, key => palette[key])
    }

    if (revealMap && actor.kind === 'enemy') {
      ctx.fillStyle = palette.silkFlameAmber
      ctx.font = `${Math.floor(tileSize * 0.5)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${actor.hp}/${actor.maxHp}`, cx, cy - tileSize * 0.5)
    }
  }
  ctx.restore()
}
