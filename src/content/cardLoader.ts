import raw from './cards.json'

export type CardTarget = 'self' | 'enemy' | 'none'

export type CardEffect =
  | { kind: 'buff-atk'; amount: number; durationTicks: number }
  | { kind: 'debuff-def'; amount: number; durationTicks: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'direct-damage'; amount: number }
  | { kind: 'aoe-damage'; amount: number }
  | { kind: 'reveal' }

export type CardDef = {
  id: string
  name: string
  description: string
  target: CardTarget
  effect: CardEffect
}

const typed: readonly CardDef[] = raw as readonly CardDef[]

const byId: Record<string, CardDef> = Object.fromEntries(
  typed.map((c) => [c.id, c]),
)

export function getCard(id: string): CardDef {
  const c = byId[id]
  if (!c) throw new Error(`unknown card: ${id}`)
  return c
}

export function listCardIds(): string[] {
  return typed.map((c) => c.id)
}
