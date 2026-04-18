import { createRng, nextU32 } from './rng'
import type { Actor, ActorId, Floor, LoreScroll, World } from './types'
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

/**
 * Per-depth enemy compositions. Each entry is an ordered list of archetype
 * ids; the spawner places them in order against available floor spawn slots
 * (truncating if the floor has fewer spawns than the list).
 */
const FLOOR_COMPOSITIONS: Record<number, string[]> = {
  1: ['bone-knight', 'tiny-zombie', 'chort'],
  2: ['bone-knight', 'tiny-zombie', 'imp', 'wogol'],
  3: ['bone-knight', 'imp', 'orc-warrior', 'chort', 'wogol'],
  4: ['masked-orc', 'orc-warrior', 'bone-knight', 'imp', 'ice-zombie'],
}

export function compositionForDepth(depth: number): string[] {
  return FLOOR_COMPOSITIONS[depth] ?? FLOOR_COMPOSITIONS[4]!
}

/**
 * Spawn enemies on a floor using the given spawns (skipping index 0 = hero spawn)
 * and the provided archetype composition.
 */
export function spawnEnemiesOnFloor(
  spawns: Floor['spawns'],
  idOffset: number,
  composition: readonly string[],
): Record<ActorId, Actor> {
  const actors: Record<ActorId, Actor> = {}
  const enemyCount = Math.min(spawns.length - 1, composition.length)
  for (let i = 0; i < enemyCount; i++) {
    const spawn = spawns[i + 1]
    const archetype = composition[i]
    const def = getArchetype(archetype)
    const id = `enemy-${idOffset + i}`
    actors[id] = {
      id,
      kind: 'enemy',
      archetype,
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

/** Boss floor spawn: index 1 = skull-emperor boss, 2..3 = bone-knight escorts. */
export function spawnBossEncounter(
  spawns: Floor['spawns'],
  idOffset: number,
): Record<ActorId, Actor> {
  const actors: Record<ActorId, Actor> = {}
  const build = (archetype: string, pos: Floor['spawns'][number], id: ActorId): Actor => {
    const def = getArchetype(archetype)
    return {
      id,
      kind: 'enemy',
      archetype,
      pos,
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      def: def.def,
      alive: true,
      statusEffects: [],
    }
  }
  if (spawns[1]) {
    const id = `boss-${idOffset}`
    actors[id] = build('skull-emperor', spawns[1], id)
  }
  for (let i = 2; i < Math.min(spawns.length, 4); i++) {
    const id = `enemy-${idOffset + i}`
    actors[id] = build('bone-knight', spawns[i], id)
  }
  return actors
}

export function spawnMerchant(spawns: Floor['spawns'], depth: number): Actor | null {
  const hero = spawns[0]
  if (!hero) return null
  const id: ActorId = `merchant-d${depth}`
  const def = getArchetype('merchant')
  return {
    id,
    kind: 'npc',
    archetype: 'merchant',
    pos: { x: hero.x + 2, y: hero.y },
    hp: def.hp,
    maxHp: def.hp,
    atk: def.atk,
    def: def.def,
    alive: true,
    statusEffects: [],
  }
}

export function createInitialWorld(seed: string): World {
  let rng = createRng(seed)
  const { floor, rng: rng2, scrollPos } = generateFloor(rng, FLOOR_W, FLOOR_H)
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

  const enemies = spawnEnemiesOnFloor(spawns, 1, compositionForDepth(1))
  Object.assign(actors, enemies)

  // Shuffle the starter deck and draw 3 into hand
  const allCardIds = listCardIds()
  const { result: shuffled, rng: rng3 } = shuffleWithRng(allCardIds, rng)
  rng = rng3
  const hand = shuffled.splice(0, 3)
  const deck = shuffled

  const loreScrolls: LoreScroll[] = scrollPos
    ? [{ id: 'scroll-d1', pos: scrollPos, fragmentIndex: 0 }]
    : []

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
    droppedItems: [],
    loreScrolls,
    pendingDialog: null,
    inventory: [],
    equipment: { weapon: null, armor: null },
    groundItems: [],
    run: {
      depth: 1,
      cards: {
        deck,
        hand,
        discard: [],
      },
      pendingReward: null,
      rewardedThisFloor: false,
    },
  }
}
