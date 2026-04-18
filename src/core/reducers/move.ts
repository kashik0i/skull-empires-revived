import { Tile, type World, type Action, type Actor, type ActorId, type Pos } from '../types'
import { getLoreFragment } from '../../content/loreLoader'
import { instantiateItem } from '../../content/itemLoader'

export function moveActor(state: World, action: Extract<Action, { type: 'MoveActor' }>): World {
  const actor = state.actors[action.actorId]
  if (!actor || !actor.alive) return state
  if (!isAdjacent(actor.pos, action.to)) return state
  if (!isWalkable(state, action.to)) return state

  // NPC-swap: hero stepping onto an NPC tile pushes the NPC back to the hero's
  // origin tile. Other actors remain hard blockers.
  const blocker = blockerAt(state, action.to, action.actorId)
  const isHeroSwap = blocker !== null && blocker.kind === 'npc' && action.actorId === state.heroId
  if (blocker && !isHeroSwap) return state

  const movedActor = { ...actor, pos: action.to }
  const finalActor: Actor = movedActor

  let inventory = state.inventory
  let groundItems = state.groundItems

  // Only the hero can pick up items (simplifies the rules + prevents enemies eating potions).
  if (actor.id === state.heroId) {
    const groundIdx = groundItems.findIndex(g => g.pos.x === action.to.x && g.pos.y === action.to.y)
    if (groundIdx >= 0 && inventory.length < 6) {
      const ground = groundItems[groundIdx]
      inventory = [...inventory, instantiateItem(ground.itemId, ground.instanceId)]
      groundItems = groundItems.filter((_, i) => i !== groundIdx)
    }
  }

  const actorsUpdated: Record<ActorId, Actor> = {
    ...state.actors,
    [action.actorId]: finalActor,
  }
  if (isHeroSwap && blocker) {
    actorsUpdated[blocker.id] = { ...blocker, pos: actor.pos }
  }

  let stateSoFar: World = {
    ...state,
    inventory,
    groundItems,
    actors: actorsUpdated,
  }

  // Scroll pickup — hero only.
  if (actor.id === state.heroId) {
    const scrollHere = stateSoFar.loreScrolls.find(s => s.pos.x === action.to.x && s.pos.y === action.to.y)
    if (scrollHere) {
      const fragment = getLoreFragment(scrollHere.fragmentIndex)
      const loreScrolls = stateSoFar.loreScrolls.filter(s => s.id !== scrollHere.id)
      stateSoFar = {
        ...stateSoFar,
        loreScrolls,
        pendingDialog: {
          title: fragment.title,
          body: fragment.body,
          actions: [{ label: 'Onward.', resolve: null }],
        },
      }
    }
  }

  // Shrine trigger — hero only, and only if a scroll pickup didn't already claim the dialog slot.
  if (actor.id === state.heroId && !stateSoFar.pendingDialog) {
    const t = stateSoFar.floor.tiles[action.to.y * stateSoFar.floor.width + action.to.x]
    if (t === Tile.Shrine) {
      stateSoFar = {
        ...stateSoFar,
        pendingDialog: {
          title: 'An altar hums.',
          body: 'Blood from the bowl, or breath from the flame?',
          actions: [
            { label: 'Blood', resolve: { type: 'ResolveShrine', choice: 'blood', pos: action.to } },
            { label: 'Breath', resolve: { type: 'ResolveShrine', choice: 'breath', pos: action.to } },
          ],
        },
      }
    }
  }

  return stateSoFar
}

function isAdjacent(a: Pos, b: Pos): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return dx + dy === 1
}

function isWalkable(state: World, p: Pos): boolean {
  const { floor } = state
  if (p.x < 0 || p.y < 0 || p.x >= floor.width || p.y >= floor.height) return false
  const t = floor.tiles[p.y * floor.width + p.x]
  return t === Tile.Floor || t === Tile.Stairs || t === Tile.Shrine
}

function blockerAt(state: World, p: Pos, ignore: ActorId): Actor | null {
  for (const id in state.actors) {
    if (id === ignore) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === p.x && a.pos.y === p.y) return a
  }
  return null
}
