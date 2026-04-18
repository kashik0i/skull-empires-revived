import type { RngState } from '../core/rng'
import { nextU32 } from '../core/rng'
import { Tile, type Floor, type Pos } from '../core/types'
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

  return {
    floor: { width, height, tiles, spawns },
    rng,
    scrollPos,
  }
}
