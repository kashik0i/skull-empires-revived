import type { RngState } from './rng'

export type ActorId = string

export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
  Stairs: 3,
} as const
export type TileKind = (typeof Tile)[keyof typeof Tile]

export type Pos = { x: number; y: number }

export type StatusEffect =
  | { kind: 'buff-atk'; amount: number; remainingTicks: number }
  | { kind: 'buff-def'; amount: number; remainingTicks: number }
  | { kind: 'debuff-def'; amount: number; remainingTicks: number }

export type Actor = {
  id: ActorId
  kind: 'hero' | 'enemy'
  archetype: string
  pos: Pos
  hp: number
  maxHp: number
  atk: number
  def: number
  alive: boolean
  statusEffects: StatusEffect[]
}

export type Floor = {
  width: number
  height: number
  tiles: Uint8Array
  spawns: Pos[]
}

export type Phase = 'exploring' | 'card_reward' | 'run_won' | 'run_lost'

export type LogEntry = { tick: number; text: string }

export type HeroIntent =
  | { kind: 'move-to'; goal: Pos }
  | { kind: 'attack'; targetId: ActorId }

export type RunCards = {
  deck: string[]
  hand: string[]
  discard: string[]
}

export type World = {
  seed: string
  tick: number
  phase: Phase
  floor: Floor
  actors: Record<ActorId, Actor>
  heroId: ActorId
  heroIntent: HeroIntent | null
  heroPath: Pos[]
  turnOrder: ActorId[]
  turnIndex: number
  log: LogEntry[]
  rng: RngState
  run: {
    depth: number
    cards: RunCards
    pendingReward: null | { choices: string[] }
  }
}

export type Action =
  | { type: 'MoveActor'; actorId: ActorId; to: Pos }
  | { type: 'AttackActor'; attackerId: ActorId; targetId: ActorId }
  | { type: 'TurnAdvance' }
  | { type: 'RunEnd'; outcome: 'won' | 'lost' }
  | { type: 'Restart'; seed: string }
  | { type: 'SetHeroIntent'; intent: HeroIntent | null }
  | { type: 'SetHeroPath'; path: Pos[] }
  | { type: 'Descend' }
