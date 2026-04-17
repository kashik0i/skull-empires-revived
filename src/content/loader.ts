import raw from './archetypes.json'

export type ArchetypeDef = {
  kind: 'hero' | 'enemy'
  name: string
  hp: number
  atk: number
  def: number
  color: string
  behavior?: string
}

const typed: Record<string, ArchetypeDef> = raw as Record<string, ArchetypeDef>

export function getArchetype(key: string): ArchetypeDef {
  const a = typed[key]
  if (!a) throw new Error(`unknown archetype: ${key}`)
  return a
}

export function listArchetypes(): Record<string, ArchetypeDef> {
  return typed
}
