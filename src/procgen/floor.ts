import type { RngState } from '../core/rng'
import { Tile, type Floor } from '../core/types'
import { generateBsp } from './bsp'

export type FloorResult = { floor: Floor; rng: RngState }

export function generateFloor(rng: RngState, width: number, height: number): FloorResult {
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
  const spawns = bsp.rooms.map(r => ({
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  }))
  return {
    floor: { width, height, tiles, spawns },
    rng,
  }
}
