import type { RngState } from './rng'

export type ActorId = string

export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
  Stairs: 3,
  Shrine: 4,
} as const
export type TileKind = (typeof Tile)[keyof typeof Tile]

export type Pos = { x: number; y: number }

export type StatusEffect =
  | { kind: 'buff-atk'; amount: number; remainingTicks: number }
  | { kind: 'buff-def'; amount: number; remainingTicks: number }
  | { kind: 'debuff-def'; amount: number; remainingTicks: number }

export type EquipmentSlot = 'weapon' | 'armor'

export type PotionEffect =
  | { type: 'heal'; amount: number }
  | { type: 'buff-atk'; amount: number; durationTicks: number }
  | { type: 'buff-def'; amount: number; durationTicks: number }

export type ItemKind =
  | { kind: 'potion'; effect: PotionEffect }
  | { kind: 'weapon'; atk: number }
  | { kind: 'armor'; def: number }

export type Item = {
  id: string
  instanceId: string
  name: string
  sprite: string
  body: ItemKind
}

export type DroppedItemInstance = {
  instanceId: string
  itemId: string
  pos: Pos
}

/** Legacy flask drop types — removed in T14. */
export type LegacyItemKind = 'flask-red' | 'flask-yellow' | 'flask-blue'

export type DroppedItem = {
  id: string
  kind: LegacyItemKind
  pos: Pos
}

export type Actor = {
  id: ActorId
  kind: 'hero' | 'enemy' | 'npc'
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
  | { kind: 'interact'; targetId: ActorId }

export type RunCards = {
  deck: string[]
  hand: string[]
  discard: string[]
}

export type LoreScroll = { id: string; pos: Pos; fragmentIndex: number }

export type DialogAction =
  | { type: 'ResolveShrine'; choice: 'blood' | 'breath'; pos: Pos }
  | { type: 'MerchantTrade'; cardId: string; merchantId: ActorId }
  | { type: 'MerchantBuyItem'; itemId: string; merchantId: ActorId }
  | { type: 'ClearDialog' }

export type PendingDialog = {
  title: string
  body: string
  actions: Array<{ label: string; resolve: DialogAction | null }>
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
  revealed: boolean
  droppedItems: DroppedItem[]
  loreScrolls: LoreScroll[]
  pendingDialog: PendingDialog | null
  inventory: Item[]
  equipment: { weapon: Item | null; armor: Item | null }
  groundItems: DroppedItemInstance[]
  run: {
    depth: number
    cards: RunCards
    pendingReward: null | { choices: string[] }
    /** Set after a card reward has been offered on this floor; reset on Descend. */
    rewardedThisFloor: boolean
    pendingItemReward: string[] | null
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
  | { type: 'PlayCard'; cardId: string; targetId?: ActorId }
  | { type: 'OfferCardReward'; choices: string[] }
  | { type: 'PickCardReward'; cardId: string }
  | { type: 'OpenMerchantDialog'; merchantId: ActorId }
  | { type: 'MerchantTrade'; cardId: string; merchantId: ActorId }
  | { type: 'ResolveShrine'; choice: 'blood' | 'breath'; pos: Pos }
  | { type: 'ClearDialog' }
  | { type: 'UseItem'; instanceId: string }
  | { type: 'EquipItem'; instanceId: string }
  | { type: 'UnequipItem'; slot: EquipmentSlot }
  | { type: 'PickupItem'; instanceId: string }
  | { type: 'OfferItemReward'; itemIds: string[] }
  | { type: 'PickItemReward'; itemId: string }
  | { type: 'MerchantBuyItem'; itemId: string; merchantId: ActorId }
