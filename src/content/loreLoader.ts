import raw from './lore.json'

export type LoreFragment = {
  id: number
  title: string
  body: string
}

const fragments: readonly LoreFragment[] = raw as readonly LoreFragment[]

export function getLoreFragment(index: number): LoreFragment {
  const f = fragments[index]
  if (!f) throw new Error(`unknown lore fragment index: ${index}`)
  return f
}

export function loreCount(): number {
  return fragments.length
}
