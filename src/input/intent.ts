import { Tile, type Action, type Pos, type World } from '../core/types'

/**
 * Resolve a tile click into an intent-setting action.
 *   - Click on an alive actor (other than hero) → attack-intent on that actor.
 *   - Click on a walkable tile → move-intent to that tile.
 *   - Click on an impassable tile (wall/void) → null.
 * Returns null if no meaningful intent can be set.
 */
export function intentForClick(state: World, tile: Pos): Action | null {
  const hero = state.actors[state.heroId]
  if (!hero || !hero.alive) return null

  // In-bounds check
  const { floor } = state
  if (tile.x < 0 || tile.y < 0 || tile.x >= floor.width || tile.y >= floor.height) return null

  // Click on an alive actor → interact (NPC) or attack (enemy) intent
  for (const id in state.actors) {
    if (id === state.heroId) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === tile.x && a.pos.y === tile.y) {
      if (a.kind === 'npc') {
        return { type: 'SetHeroIntent', intent: { kind: 'interact', targetId: id } }
      }
      return { type: 'SetHeroIntent', intent: { kind: 'attack', targetId: id } }
    }
  }

  // Click on hero's own tile — clear intent
  if (tile.x === hero.pos.x && tile.y === hero.pos.y) {
    return { type: 'SetHeroIntent', intent: null }
  }

  // Click on walkable floor (or stairs) → move intent
  const t = floor.tiles[tile.y * floor.width + tile.x]
  if (t === Tile.Floor || t === Tile.Stairs) {
    return { type: 'SetHeroIntent', intent: { kind: 'move-to', goal: tile } }
  }

  return null
}
