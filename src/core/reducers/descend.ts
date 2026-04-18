import type { World, LoreScroll } from '../types'
import { Tile } from '../types'
import type { Floor, Pos } from '../types'
import { generateFloor } from '../../procgen/floor'
import { generateBossFloor } from '../../procgen/boss'
import { spawnEnemiesOnFloor, spawnBossEncounter, compositionForDepth, spawnMerchant } from '../state'
import type { ActorId, Actor } from '../types'

export function descend(world: World): World {
  const hero = world.actors[world.heroId]

  // Guard: hero must be alive
  if (!hero || !hero.alive) return world

  // Guard: tile under hero must be Stairs
  const { floor } = world
  const tileIdx = hero.pos.y * floor.width + hero.pos.x
  if (floor.tiles[tileIdx] !== Tile.Stairs) return world

  // Guard: depth 5 is terminal (boss floor)
  if (world.run.depth >= 5) return world

  const newDepth = world.run.depth + 1
  const isBossFloor = newDepth === 5

  const bossResult = isBossFloor ? generateBossFloor(world.rng, floor.width, floor.height) : null
  const floorResult = isBossFloor ? null : generateFloor(world.rng, floor.width, floor.height, { hasStairs: true })
  const newFloor = (bossResult ?? floorResult!).floor
  const rng2 = (bossResult ?? floorResult!).rng
  const scrollPos = floorResult?.scrollPos ?? null

  const newSpawns = newFloor.spawns
  const heroSpawn = newSpawns[0]

  // Build new actors: hero (preserved hp/inventory/statusEffects) + fresh enemies
  const actors: Record<ActorId, Actor> = {}

  actors[hero.id] = {
    ...hero,
    pos: heroSpawn,
  }

  // Use a stable id offset based on depth so ids don't collide across floors
  const idOffset = (newDepth - 1) * 10 + 1
  const enemies = isBossFloor
    ? spawnBossEncounter(newSpawns, idOffset)
    : spawnEnemiesOnFloor(newSpawns, idOffset, compositionForDepth(newDepth))
  Object.assign(actors, enemies)

  const turnOrder = Object.keys(actors)

  // Spawn merchant on floors 2 and 4 (non-boss floors only).
  if (!isBossFloor && (newDepth === 2 || newDepth === 4)) {
    const m = spawnMerchant(newSpawns, newDepth)
    if (m && isFloorOrStairsTile(newFloor, m.pos)) {
      actors[m.id] = m
      turnOrder.push(m.id)
    }
  }

  const loreScrolls: LoreScroll[] = !isBossFloor && scrollPos
    ? [{ id: `scroll-d${newDepth}`, pos: scrollPos, fragmentIndex: newDepth - 1 }]
    : []

  return {
    ...world,
    floor: newFloor,
    actors,
    heroIntent: null,
    heroPath: [],
    turnOrder,
    turnIndex: 0,
    rng: rng2,
    droppedItems: [],
    loreScrolls,
    pendingDialog: null,
    run: {
      ...world.run,
      depth: newDepth,
      rewardedThisFloor: false,
    },
  }
}

function isFloorOrStairsTile(floor: Floor, p: Pos): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= floor.width || p.y >= floor.height) return false
  const t = floor.tiles[p.y * floor.width + p.x]
  return t === Tile.Floor || t === Tile.Stairs || t === Tile.Shrine
}
