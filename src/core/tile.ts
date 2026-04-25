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
