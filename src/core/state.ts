import { createRng, nextU32 } from './rng'
import type { Actor, ActorId, Floor, World } from './types'
import { generateFloor } from '../procgen/floor'
import { getArchetype } from '../content/loader'
import { listCardIds } from '../content/cardLoader'
import type { RngState } from './rng'

export const FLOOR_W = 40
export const FLOOR_H = 30

/** Fisher-Yates shuffle using the PRNG; returns shuffled array and updated rng */
export function shuffleWithRng<T>(arr: T[], rng: RngState): { result: T[]; rng: RngState } {
  const result = arr.slice()
  let state = rng
  for (let i = result.length - 1; i > 0; i--) {
    const r = nextU32(state)
    state = r.state
    const j = r.value % (i + 1)
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return { result, rng: state }
}

/** Spawn enemies on a floor using the given spawns (skipping index 0 = hero spawn). */
export function spawnEnemiesOnFloor(
  spawns: Floor['spawns'],
  idOffset: number,
): Record<ActorId, Actor> {
  const actors: Record<ActorId, Actor> = {}
  const enemyCount = Math.min(spawns.length - 1, 4)
  for (let i = 0; i < enemyCount; i++) {
    const spawn = spawns[i + 1]
    const def = getArchetype('bone-knight')
    const id = `enemy-${idOffset + i}`
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
      statusEffects: [],
    }
  }
  return actors
}

export function createInitialWorld(seed: string): World {
  let rng = createRng(seed)
  const { floor, rng: rng2 } = generateFloor(rng, FLOOR_W, FLOOR_H)
  rng = rng2

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
    statusEffects: [],
  }
  actors[hero.id] = hero

  const enemies = spawnEnemiesOnFloor(spawns, 1)
  Object.assign(actors, enemies)

  // Shuffle the starter deck and draw 3 into hand
  const allCardIds = listCardIds()
  const { result: shuffled, rng: rng3 } = shuffleWithRng(allCardIds, rng)
  rng = rng3
  const hand = shuffled.splice(0, 3)
  const deck = shuffled

  const turnOrder = Object.keys(actors)
  return {
    seed,
    tick: 0,
    phase: 'exploring',
    floor,
    actors,
    heroId: hero.id,
    heroIntent: null,
    heroPath: [],
    turnOrder,
    turnIndex: 0,
    log: [],
    rng,
    revealed: false,
    run: {
      depth: 1,
      cards: {
        deck,
        hand,
        discard: [],
      },
      pendingReward: null,
    },
  }
}
