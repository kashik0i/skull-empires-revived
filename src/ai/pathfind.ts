import { type ActorId, type Pos, type TileKind, type World } from '../core/types'
import { isPassable } from '../core/tile'

export type PathfindOptions = {
  /** Actor IDs whose current tile should be treated as passable. Used when attacking — we path to the target's tile. */
  passThroughActors?: readonly ActorId[]
  /** If set, abort BFS once the goal cannot be reached within this many steps; returns null. */
  maxDepth?: number
}

/**
 * BFS from `from` to `to`. Returns the first step (single tile toward the goal) or null if unreachable.
 * Treats walls as impassable. Treats every alive actor's tile as impassable EXCEPT ids in `passThroughActors`.
 */
export function firstStepToward(state: World, from: Pos, to: Pos, opts: PathfindOptions = {}): Pos | null {
  if (from.x === to.x && from.y === to.y) return null
  const { floor } = state
  const w = floor.width
  const h = floor.height
  const passThrough = new Set(opts.passThroughActors ?? [])
  const maxDepth = opts.maxDepth ?? Infinity

  const occupied = new Uint8Array(w * h)
  for (const id in state.actors) {
    const a = state.actors[id]
    if (!a.alive) continue
    if (passThrough.has(id)) continue
    if (a.pos.x >= 0 && a.pos.y >= 0 && a.pos.x < w && a.pos.y < h) {
      occupied[a.pos.y * w + a.pos.x] = 1
    }
  }
  occupied[from.y * w + from.x] = 0

  function canEnter(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= w || y >= h) return false
    const t = floor.tiles[y * w + x]
    if (!isPassable(t as TileKind)) return false
    if (occupied[y * w + x]) return false
    return true
  }

  const prev = new Int32Array(w * h)
  prev.fill(-1)
  const dist = new Int32Array(w * h)
  dist.fill(-1)
  const startIdx = from.y * w + from.x
  prev[startIdx] = startIdx
  dist[startIdx] = 0

  const queue: number[] = [startIdx]
  const goalIdx = to.y * w + to.x
  let found = false
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === goalIdx) { found = true; break }
    if (dist[cur] >= maxDepth) continue
    const cx = cur % w
    const cy = (cur - cx) / w
    const dx = Math.sign(to.x - cx) || 1
    const dy = Math.sign(to.y - cy) || 1
    const neighbours: [number, number][] = [
      [cx + dx, cy],
      [cx, cy + dy],
      [cx - dx, cy],
      [cx, cy - dy],
    ]
    for (const [nx, ny] of neighbours) {
      if (!canEnter(nx, ny) && !(nx === to.x && ny === to.y)) continue
      const ni = ny * w + nx
      if (prev[ni] !== -1) continue
      prev[ni] = cur
      dist[ni] = dist[cur] + 1
      queue.push(ni)
    }
  }

  if (!found) return null

  // Walk back from goal to start to find first step.
  let cur = goalIdx
  while (prev[cur] !== startIdx) {
    const p = prev[cur]
    if (p === cur) break
    cur = p
  }
  const sx = cur % w
  const sy = (cur - sx) / w
  if (sx === from.x && sy === from.y) return null
  return { x: sx, y: sy }
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * BFS returning the full path from `from` to `to` as an array of positions,
 * NOT including the start tile. Returns null if unreachable.
 */
export function fullPathToward(state: World, from: Pos, to: Pos, opts: PathfindOptions = {}): Pos[] | null {
  if (from.x === to.x && from.y === to.y) return []
  const { floor } = state
  const w = floor.width
  const h = floor.height
  const passThrough = new Set(opts.passThroughActors ?? [])

  const occupied = new Uint8Array(w * h)
  for (const id in state.actors) {
    const a = state.actors[id]
    if (!a.alive) continue
    if (passThrough.has(id)) continue
    if (a.pos.x >= 0 && a.pos.y >= 0 && a.pos.x < w && a.pos.y < h) {
      occupied[a.pos.y * w + a.pos.x] = 1
    }
  }
  occupied[from.y * w + from.x] = 0

  function canEnter(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= w || y >= h) return false
    const t = floor.tiles[y * w + x]
    if (!isPassable(t as TileKind)) return false
    if (occupied[y * w + x]) return false
    return true
  }

  const prev = new Int32Array(w * h)
  prev.fill(-1)
  const startIdx = from.y * w + from.x
  prev[startIdx] = startIdx

  const queue: number[] = [startIdx]
  const goalIdx = to.y * w + to.x
  let found = false
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === goalIdx) { found = true; break }
    const cx = cur % w
    const cy = (cur - cx) / w
    // directional bias: explore toward-goal neighbors first for stable tiebreaking
    const dx = Math.sign(to.x - cx) || 1
    const dy = Math.sign(to.y - cy) || 1
    const neighbours: [number, number][] = [
      [cx + dx, cy],
      [cx, cy + dy],
      [cx - dx, cy],
      [cx, cy - dy],
    ]
    for (const [nx, ny] of neighbours) {
      if (!canEnter(nx, ny) && !(nx === to.x && ny === to.y)) continue
      const ni = ny * w + nx
      if (prev[ni] !== -1) continue
      prev[ni] = cur
      queue.push(ni)
    }
  }

  if (!found) return null

  // Reconstruct path from goal back to start.
  const path: Pos[] = []
  let cur = goalIdx
  while (cur !== startIdx) {
    const cx = cur % w
    const cy = (cur - cx) / w
    path.push({ x: cx, y: cy })
    const p = prev[cur]
    if (p === cur) break
    cur = p
  }
  path.reverse()
  return path
}
