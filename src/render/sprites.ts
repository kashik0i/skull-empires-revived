/**
 * Sprite atlas loader + frame registry for 0x72 Dungeon Tileset II.
 * Each entry in FRAMES is `[x, y, w, h, frameCount]` where multi-frame
 * animations lay out horizontally at that y-row in w-px columns.
 */

export type SpriteFrame = {
  x: number
  y: number
  w: number
  h: number
  frames: number
}

const FRAMES: Record<string, SpriteFrame> = {
  // Characters — 16×28, 4 idle frames (tall, overhang upward from tile)
  knight_m_idle:  { x: 128, y: 100, w: 16, h: 28, frames: 4 },
  knight_m_run:   { x: 192, y: 100, w: 16, h: 28, frames: 4 },
  knight_m_hit:   { x: 256, y: 100, w: 16, h: 28, frames: 1 },

  // Merchant NPC — 16×28, 4 idle frames
  wizzard_m_idle: { x: 128, y: 164, w: 16, h: 28, frames: 4 },

  // 16×16 mook tier — 4 idle frames, fits a tile
  skelet_idle:       { x: 368, y: 80,  w: 16, h: 16, frames: 4 },
  skelet_run:        { x: 432, y: 80,  w: 16, h: 16, frames: 4 },
  tiny_zombie_idle:  { x: 368, y: 16,  w: 16, h: 16, frames: 4 },
  imp_idle:          { x: 368, y: 48,  w: 16, h: 16, frames: 4 },
  zombie_idle:       { x: 368, y: 144, w: 16, h: 16, frames: 4 },
  ice_zombie_idle:   { x: 432, y: 144, w: 16, h: 16, frames: 4 },

  // 16×20 orc tier — 4 idle frames, slightly taller
  masked_orc_idle:   { x: 368, y: 172, w: 16, h: 20, frames: 4 },
  orc_warrior_idle:  { x: 368, y: 204, w: 16, h: 20, frames: 4 },
  orc_shaman_idle:   { x: 368, y: 236, w: 16, h: 20, frames: 4 },

  // Big demon boss — 32×36, 4 idle frames (2 tiles wide)
  big_demon_idle:    { x: 16,  y: 364, w: 32, h: 36, frames: 4 },
  big_demon_run:     { x: 144, y: 364, w: 32, h: 36, frames: 4 },

  // Terrain — 16×16 single frames
  floor_1:        { x: 16,  y: 64,  w: 16, h: 16, frames: 1 },
  wall_mid:       { x: 32,  y: 16,  w: 16, h: 16, frames: 1 },

  // Items (consumable flasks) — 16×16
  flask_red:      { x: 288, y: 240, w: 16, h: 16, frames: 1 },
  flask_blue:     { x: 304, y: 240, w: 16, h: 16, frames: 1 },
  flask_yellow:   { x: 336, y: 240, w: 16, h: 16, frames: 1 },

  // Lore scroll pickup — 16×16 (uses flask_green as fallback)
  scroll:         { x: 320, y: 240, w: 16, h: 16, frames: 1 },
}

const ITEM_SPRITE: Record<string, string> = {
  'flask-red':    'flask_red',
  'flask-yellow': 'flask_yellow',
  'flask-blue':   'flask_blue',
}

export function itemSpriteName(kind: string): string | null {
  return ITEM_SPRITE[kind] ?? null
}

let atlas: HTMLImageElement | null = null
let atlasPromise: Promise<HTMLImageElement> | null = null

export function loadAtlas(src = '/sprites/dungeon.png'): Promise<HTMLImageElement> {
  if (atlas) return Promise.resolve(atlas)
  if (atlasPromise) return atlasPromise
  atlasPromise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { atlas = img; resolve(img) }
    img.onerror = reject
    img.src = src
  })
  return atlasPromise
}

export function isAtlasReady(): boolean {
  return atlas !== null
}

export function getFrame(name: string): SpriteFrame | null {
  return FRAMES[name] ?? null
}

/** Frame counter in milliseconds per frame. Dungeon Tileset II idles at ~150ms/frame feels right. */
const FRAME_MS = 150

export function currentFrameIndex(frames: number, nowMs = performance.now()): number {
  if (frames <= 1) return 0
  return Math.floor(nowMs / FRAME_MS) % frames
}

/**
 * Draw a sprite centered on (cx, cy) with its bottom-middle anchored there
 * (so tall characters overhang upward from the tile center).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  tileSize: number,
  nowMs?: number,
): boolean {
  if (!atlas) return false
  const f = FRAMES[name]
  if (!f) return false
  const frame = currentFrameIndex(f.frames, nowMs)
  const sx = f.x + frame * f.w
  // Scale so width matches tileSize; height scales proportionally.
  const scale = tileSize / 16
  const dw = f.w * scale
  const dh = f.h * scale
  // Anchor to bottom-center of the tile.
  const dx = cx - dw / 2
  const dy = cy + tileSize / 2 - dh
  ctx.drawImage(atlas, sx, f.y, f.w, f.h, dx, dy, dw, dh)
  return true
}

/** Draw a 1-tile sprite that fills the tile exactly (floor/wall). */
export function drawTileSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  tileX: number,
  tileY: number,
  tileSize: number,
): boolean {
  if (!atlas) return false
  const f = FRAMES[name]
  if (!f) return false
  ctx.drawImage(atlas, f.x, f.y, f.w, f.h, tileX * tileSize, tileY * tileSize, tileSize, tileSize)
  return true
}
