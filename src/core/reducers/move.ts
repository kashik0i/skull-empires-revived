import { Tile, type World, type Action, type Actor, type ActorId, type Pos, type DroppedItem } from '../types'
import { getLoreFragment } from '../../content/loreLoader'

export function moveActor(state: World, action: Extract<Action, { type: 'MoveActor' }>): World {
  const actor = state.actors[action.actorId]
  if (!actor || !actor.alive) return state
  if (!isAdjacent(actor.pos, action.to)) return state
  if (!isWalkable(state, action.to)) return state
  if (isOccupied(state, action.to, action.actorId)) return state

  const movedActor = { ...actor, pos: action.to }
  let droppedItems = state.droppedItems
  let finalActor: Actor = movedActor

  // Only the hero can pick up items (simplifies the rules + prevents enemies eating potions).
  if (actor.id === state.heroId) {
    const itemHere = droppedItems.find(it => it.pos.x === action.to.x && it.pos.y === action.to.y)
    if (itemHere) {
      finalActor = applyItemToHero(movedActor, itemHere)
      droppedItems = droppedItems.filter(it => it.id !== itemHere.id)
    }
  }

  let stateSoFar: World = {
    ...state,
    droppedItems,
    actors: {
      ...state.actors,
      [action.actorId]: finalActor,
    },
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

  // Shrine trigger — hero only.
  if (actor.id === state.heroId) {
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

function applyItemToHero(hero: Actor, item: DroppedItem): Actor {
  switch (item.kind) {
    case 'flask-red':
      return { ...hero, hp: Math.min(hero.maxHp, hero.hp + 5) }
    case 'flask-yellow':
      return { ...hero, atk: hero.atk + 1 }
    case 'flask-blue':
      return { ...hero, def: hero.def + 1 }
  }
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

function isOccupied(state: World, p: Pos, ignore: ActorId): boolean {
  for (const id in state.actors) {
    if (id === ignore) continue
    const a = state.actors[id]
    if (a.alive && a.pos.x === p.x && a.pos.y === p.y) return true
  }
  return false
}
