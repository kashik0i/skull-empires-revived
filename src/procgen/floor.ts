import type { RngState } from '../core/rng'
import { nextFloat, nextU32 } from '../core/rng'
import { Tile, type Floor, type FloorDecor, type Pos } from '../core/types'
import { generateBsp } from './bsp'

export type FloorResult = { floor: Floor; rng: RngState; scrollPos: Pos | null }

export type GenerateFloorOpts = { hasStairs?: boolean }

export function generateFloor(
  rng: RngState,
  width: number,
  height: number,
  opts: GenerateFloorOpts = {},
): FloorResult {
  const hasStairs = opts.hasStairs ?? true
  const tiles = new Uint8Array(width * height)
  tiles.fill(Tile.Wall)
  const bsp = generateBsp(rng, width, height)
  for (const room of bsp.rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        tiles[y * width + x] = Tile.Floor
      }
    }
  }
  for (const corridor of bsp.corridors) {
    for (const p of corridor.points) {
      if (p.x >= 0 && p.y >= 0 && p.x < width && p.y < height) {
        tiles[p.y * width + p.x] = Tile.Floor
      }
    }
  }
  const roomCenters = bsp.rooms.map(r => ({
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  }))
  let spawns = roomCenters.slice()
  let stairsPos: Pos | null = null
  if (hasStairs && bsp.rooms.length >= 2) {
    const stairsRoomIndex = bsp.rooms.length - 1
    stairsPos = roomCenters[stairsRoomIndex]
    tiles[stairsPos.y * width + stairsPos.x] = Tile.Stairs
    spawns = roomCenters.filter((_, i) => i !== stairsRoomIndex)
  }

  // Door pass: place 1-2 closed doors at corridor↔room boundaries.
  function inAnyRoom(x: number, y: number): boolean {
    for (const r of bsp.rooms) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true
    }
    return false
  }
  const doorCandidates: Pos[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y * width + x] !== Tile.Floor) continue
      if (inAnyRoom(x, y)) continue              // skip room interiors
      const left  = tiles[y * width + (x - 1)] === Tile.Floor
      const right = tiles[y * width + (x + 1)] === Tile.Floor
      const up    = tiles[(y - 1) * width + x] === Tile.Floor
      const down  = tiles[(y + 1) * width + x] === Tile.Floor
      const horiz = left && right && !up && !down
      const vert  = up && down && !left && !right
      if (!horiz && !vert) continue
      // At least one neighbor must be inside a room (we're at the boundary).
      const hasRoomNeighbor =
        (left && inAnyRoom(x - 1, y)) ||
        (right && inAnyRoom(x + 1, y)) ||
        (up && inAnyRoom(x, y - 1)) ||
        (down && inAnyRoom(x, y + 1))
      if (hasRoomNeighbor) doorCandidates.push({ x, y })
    }
  }
  if (doorCandidates.length > 0) {
    const targetCount = doorCandidates.length === 1 ? 1 : 2
    const picked = new Set<number>()
    while (picked.size < Math.min(targetCount, doorCandidates.length)) {
      const r = nextU32(rng)
      rng = r.state
      const idx = r.value % doorCandidates.length
      if (picked.has(idx)) continue
      picked.add(idx)
      const p = doorCandidates[idx]
      tiles[p.y * width + p.x] = Tile.DoorClosed
    }
  }

  // Chest pass: one per floor in a non-spawn, non-stairs room.
  if (bsp.rooms.length >= 3) {
    const stairsRoomIdx = hasStairs && bsp.rooms.length >= 2 ? bsp.rooms.length - 1 : -1
    const eligibleRooms = bsp.rooms
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => i !== stairsRoomIdx && i !== 0)  // 0 is hero-spawn room
    if (eligibleRooms.length > 0) {
      const r = nextU32(rng)
      rng = r.state
      const pick = eligibleRooms[r.value % eligibleRooms.length].r
      // Collect all floor tiles in the chosen room that aren't spawn points.
      const chestCandidates: Pos[] = []
      for (let cy = pick.y; cy < pick.y + pick.h; cy++) {
        for (let cx = pick.x; cx < pick.x + pick.w; cx++) {
          if (tiles[cy * width + cx] !== Tile.Floor) continue
          if (spawns.some(s => s.x === cx && s.y === cy)) continue
          chestCandidates.push({ x: cx, y: cy })
        }
      }
      if (chestCandidates.length > 0) {
        const r2 = nextU32(rng)
        rng = r2.state
        const cp = chestCandidates[r2.value % chestCandidates.length]
        tiles[cp.y * width + cp.x] = Tile.Chest
      }
    }
  }

  // Pick a random floor tile (not a spawn, not stairs) for scroll placement.
  let scrollPos: Pos | null = null
  const candidates: Pos[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y * width + x] !== Tile.Floor) continue
      if (spawns.some(s => s.x === x && s.y === y)) continue
      if (stairsPos && stairsPos.x === x && stairsPos.y === y) continue
      candidates.push({ x, y })
    }
  }
  if (candidates.length > 0) {
    const r = nextU32(rng)
    rng = r.state
    scrollPos = candidates[r.value % candidates.length]
  }

  // 25% chance to place a Shrine tile per floor.
  const shrineRoll = nextFloat(rng)
  rng = shrineRoll.state
  if (shrineRoll.value < 0.25) {
    const shrineCandidates = candidates.filter(
      p => !(scrollPos && scrollPos.x === p.x && scrollPos.y === p.y),
    )
    if (shrineCandidates.length > 0) {
      const pick = nextU32(rng)
      rng = pick.state
      const sp = shrineCandidates[pick.value % shrineCandidates.length]
      tiles[sp.y * width + sp.x] = Tile.Shrine
    }
  }

  // Decor pass: 0-3 props per room, banners on north walls only.
  const DECOR_BANNERS = ['wall_banner_red', 'wall_banner_blue', 'wall_banner_green', 'wall_banner_yellow']
  const DECOR_FLOOR_PROPS = ['crate', 'skull', 'column_top']
  const decor: FloorDecor[] = []
  for (const room of bsp.rooms) {
    const propRoll = nextU32(rng)
    rng = propRoll.state
    const propCount = propRoll.value % 4   // 0, 1, 2, or 3
    for (let i = 0; i < propCount; i++) {
      const xRoll = nextU32(rng); rng = xRoll.state
      const yRoll = nextU32(rng); rng = yRoll.state
      const px = room.x + (xRoll.value % room.w)
      const py = room.y + (yRoll.value % room.h)
      if (tiles[py * width + px] !== Tile.Floor) continue
      // Choose banner if there is a wall to the north, else a floor prop.
      const northIsWall = py > 0 && tiles[(py - 1) * width + px] === Tile.Wall
      const kindRoll = nextU32(rng); rng = kindRoll.state
      const sprite = northIsWall
        ? DECOR_BANNERS[kindRoll.value % DECOR_BANNERS.length]
        : DECOR_FLOOR_PROPS[kindRoll.value % DECOR_FLOOR_PROPS.length]
      decor.push({ x: px, y: py, sprite })
    }
  }

  return {
    floor: { width, height, tiles, spawns, decor },
    rng,
    scrollPos,
  }
}
