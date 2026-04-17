import { nextInt, type RngState } from '../core/rng'

export type Room = { x: number; y: number; w: number; h: number }
export type Corridor = { fromRoom: number; toRoom: number; points: { x: number; y: number }[] }

export type BspResult = { rooms: Room[]; corridors: Corridor[] }

type Leaf = { x: number; y: number; w: number; h: number; roomIndex?: number }

const MIN_SIZE = 8

export function generateBsp(rng: RngState, width: number, height: number): BspResult {
  let s = rng
  const leaves: Leaf[] = [{ x: 0, y: 0, w: width, h: height }]
  let i = 0
  while (i < leaves.length) {
    const l = leaves[i]
    const canSplitH = l.w > MIN_SIZE * 2
    const canSplitV = l.h > MIN_SIZE * 2
    if (!canSplitH && !canSplitV) { i++; continue }
    let splitH = canSplitH
    if (canSplitH && canSplitV) {
      const r = nextInt(s, 0, 2)
      s = r.state
      splitH = r.value === 0
    }
    if (splitH) {
      const r = nextInt(s, MIN_SIZE, l.w - MIN_SIZE); s = r.state
      leaves.push({ x: l.x, y: l.y, w: r.value, h: l.h })
      leaves.push({ x: l.x + r.value, y: l.y, w: l.w - r.value, h: l.h })
    } else {
      const r = nextInt(s, MIN_SIZE, l.h - MIN_SIZE); s = r.state
      leaves.push({ x: l.x, y: l.y, w: l.w, h: r.value })
      leaves.push({ x: l.x, y: l.y + r.value, w: l.w, h: l.h - r.value })
    }
    leaves.splice(i, 1)
  }
  const rooms: Room[] = []
  for (const l of leaves) {
    const w = Math.max(3, l.w - 3)
    const h = Math.max(3, l.h - 3)
    const rw = nextInt(s, 3, w + 1); s = rw.state
    const rh = nextInt(s, 3, h + 1); s = rh.state
    const rx = nextInt(s, l.x + 1, l.x + l.w - rw.value); s = rx.state
    const ry = nextInt(s, l.y + 1, l.y + l.h - rh.value); s = ry.state
    l.roomIndex = rooms.length
    rooms.push({ x: rx.value, y: ry.value, w: rw.value, h: rh.value })
  }
  const corridors: Corridor[] = []
  for (let j = 1; j < rooms.length; j++) {
    const a = rooms[j - 1]; const b = rooms[j]
    const ax = a.x + (a.w >> 1); const ay = a.y + (a.h >> 1)
    const bx = b.x + (b.w >> 1); const by = b.y + (b.h >> 1)
    const points: { x: number; y: number }[] = []
    const stepX = ax < bx ? 1 : -1
    for (let x = ax; x !== bx; x += stepX) points.push({ x, y: ay })
    const stepY = ay < by ? 1 : -1
    for (let y = ay; y !== by; y += stepY) points.push({ x: bx, y })
    points.push({ x: bx, y: by })
    corridors.push({ fromRoom: j - 1, toRoom: j, points })
  }
  return { rooms, corridors }
}
