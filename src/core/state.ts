import { createRng, nextU32 } from './rng'
import type { Actor, ActorId, World } from './types'
import { generateFloor } from '../procgen/floor'
import { getArchetype } from '../content/loader'

const FLOOR_W = 40
const FLOOR_H = 30

export function createInitialWorld(seed: string): World {
  let rng = createRng(seed)
  const { floor } = generateFloor(rng, FLOOR_W, FLOOR_H)
  const after = nextU32(rng); rng = after.state

  const actors: Record<ActorId, Actor> = {}
  const spawns = floor.spawns

  const heroSpawn = spawns[0]
  const heroDef = getArchetype('hero')
  const hero: Actor = {
    id: 'hero-1',
    kind: 'hero',
    archetype: 'hero',
    pos: heroSpawn,
    hp: heroDef.hp,
    maxHp: heroDef.hp,
    atk: heroDef.atk,
    def: heroDef.def,
    alive: true,
  }
  actors[hero.id] = hero

  const enemyCount = Math.min(spawns.length - 1, 4)
  for (let i = 0; i < enemyCount; i++) {
    const spawn = spawns[i + 1]
    const def = getArchetype('bone-knight')
    const id = `enemy-${i + 1}`
    actors[id] = {
      id,
      kind: 'enemy',
      archetype: 'bone-knight',
      pos: spawn,
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      def: def.def,
      alive: true,
    }
  }

  const turnOrder = Object.keys(actors)
  return {
    seed,
    tick: 0,
    phase: 'exploring',
    floor,
    actors,
    heroId: hero.id,
    turnOrder,
    turnIndex: 0,
    log: [],
    rng,
  }
}
