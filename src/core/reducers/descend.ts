import type { World } from '../types'
import { Tile } from '../types'
import { generateFloor } from '../../procgen/floor'
import { generateBossFloor } from '../../procgen/boss'
import { spawnEnemiesOnFloor, spawnBossEncounter, compositionForDepth } from '../state'
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

  const { floor: newFloor, rng: rng2 } = isBossFloor
    ? generateBossFloor(world.rng, floor.width, floor.height)
    : generateFloor(world.rng, floor.width, floor.height, { hasStairs: true })

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
    run: {
      ...world.run,
      depth: newDepth,
      rewardedThisFloor: false,
    },
  }
}
