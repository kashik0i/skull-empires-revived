import type { Floor } from '../core/types'
import { Tile } from '../core/types'
import type { RngState } from '../core/rng'

export function generateBossFloor(
  rng: RngState,
  width: number,
  height: number,
): { floor: Floor; rng: RngState } {
  const tiles = new Uint8Array(width * height)
  tiles.fill(Tile.Wall)

  // Create a single centered rectangular chamber filling most of the floor
  const chamberLeft = 4
  const chamberTop = 4
  const chamberRight = width - 4
  const chamberBottom = height - 4

  for (let y = chamberTop; y < chamberBottom; y++) {
    for (let x = chamberLeft; x < chamberRight; x++) {
      tiles[y * width + x] = Tile.Floor
    }
  }

  const chamberWidth = chamberRight - chamberLeft
  const chamberHeight = chamberBottom - chamberTop

  // Position 4 spawns reasonably spaced in the chamber
  // Hero spawn: bottom-left area
  const heroSpawn = {
    x: chamberLeft + Math.floor(chamberWidth * 0.2),
    y: chamberTop + Math.floor(chamberHeight * 0.7),
  }

  // Boss spawn: center-top
  const bossSpawn = {
    x: chamberLeft + Math.floor(chamberWidth * 0.5),
    y: chamberTop + Math.floor(chamberHeight * 0.2),
  }

  // Escort 1: top-left
  const escort1 = {
    x: chamberLeft + Math.floor(chamberWidth * 0.25),
    y: chamberTop + Math.floor(chamberHeight * 0.3),
  }

  // Escort 2: top-right
  const escort2 = {
    x: chamberLeft + Math.floor(chamberWidth * 0.75),
    y: chamberTop + Math.floor(chamberHeight * 0.3),
  }

  const spawns = [heroSpawn, bossSpawn, escort1, escort2]

  return {
    floor: { width, height, tiles, spawns },
    rng,
  }
}
