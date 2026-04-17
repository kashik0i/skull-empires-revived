import type { RngState } from './rng'

export type ActorId = string

export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
} as const
export type TileKind = (typeof Tile)[keyof typeof Tile]

export type Pos = { x: number; y: number }

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
}

export type Floor = {
  width: number
  height: number
  tiles: Uint8Array
  spawns: Pos[]
}

export type Phase = 'exploring' | 'run_won' | 'run_lost'

export type LogEntry = { tick: number; text: string }

export type HeroIntent =
  | { kind: 'move-to'; goal: Pos }
  | { kind: 'attack'; targetId: ActorId }

export type World = {
  seed: string
  tick: number
  phase: Phase
  floor: Floor
  actors: Record<ActorId, Actor>
  heroId: ActorId
  heroIntent: HeroIntent | null
  turnOrder: ActorId[]
  turnIndex: number
  log: LogEntry[]
  rng: RngState
}

export type Action =
  | { type: 'MoveActor'; actorId: ActorId; to: Pos }
  | { type: 'AttackActor'; attackerId: ActorId; targetId: ActorId }
  | { type: 'TurnAdvance' }
  | { type: 'RunEnd'; outcome: 'won' | 'lost' }
  | { type: 'Restart'; seed: string }
  | { type: 'SetHeroIntent'; intent: HeroIntent | null }
