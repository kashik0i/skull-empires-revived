import { Tile, type TileKind } from './types'

export function isPassable(t: TileKind): boolean {
  switch (t) {
    case Tile.Floor:
    case Tile.Stairs:
    case Tile.Shrine:
    case Tile.DoorOpen:
    case Tile.Chest:
    case Tile.ChestOpen:
      return true
    case Tile.Void:
    case Tile.Wall:
    case Tile.DoorClosed:
      return false
  }
}

export function isOpaque(t: TileKind): boolean {
  switch (t) {
    case Tile.Wall:
    case Tile.DoorClosed:
      return true
    case Tile.Void:
    case Tile.Floor:
    case Tile.Stairs:
    case Tile.Shrine:
    case Tile.DoorOpen:
    case Tile.Chest:
    case Tile.ChestOpen:
      return false
  }
}

/**
 * Path-planning passability. Closed doors are pathable: BFS routes through them
 * and the move reducer handles the bump-then-stop. Use this for click handlers,
 * BFS, and step validation. Use isPassable for "can the actor occupy this tile
 * right now" (movement reducer's isWalkable).
 */
export function isPathable(t: TileKind): boolean {
  switch (t) {
    case Tile.Floor:
    case Tile.Stairs:
    case Tile.Shrine:
    case Tile.DoorClosed:
    case Tile.DoorOpen:
    case Tile.Chest:
    case Tile.ChestOpen:
      return true
    case Tile.Void:
    case Tile.Wall:
      return false
  }
}
