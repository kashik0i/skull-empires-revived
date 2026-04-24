import { computeCameraOffset, type CameraOffset } from './camera'

export type CameraController = {
  /** Advance one frame; returns and stores the new offset. */
  update(opts: {
    heroDisplay: { x: number; y: number }
    tileSize: number
    viewportW: number
    viewportH: number
    floorW: number
    floorH: number
    dtMs: number
  }): CameraOffset
  /** Skip lerp on next update — used when zoom changes or floor swaps. */
  snap(): void
  /** Most recent post-lerp offset. Pre-shake by design. */
  current(): CameraOffset
}

type Opts = {
  deadzoneFractionX?: number
  deadzoneFractionY?: number
  lerpHz?: number
}

export function createCameraController(opts: Opts = {}): CameraController {
  const dzx = opts.deadzoneFractionX ?? 0.4
  const dzy = opts.deadzoneFractionY ?? 0.4
  const lerpHz = opts.lerpHz ?? 12

  let cur: CameraOffset = { x: 0, y: 0 }
  let target: CameraOffset = { x: 0, y: 0 }
  let snapNext = true      // first update always snaps
  let initialized = false  // true after the first update has run

  function clampToFloor(t: CameraOffset, args: {
    tileSize: number; viewportW: number; viewportH: number; floorW: number; floorH: number
  }): CameraOffset {
    const floorPxW = args.floorW * args.tileSize
    const floorPxH = args.floorH * args.tileSize
    const maxX = floorPxW - args.viewportW
    const maxY = floorPxH - args.viewportH
    const x = maxX <= 0 ? 0 : Math.max(0, Math.min(t.x, maxX))
    const y = maxY <= 0 ? 0 : Math.max(0, Math.min(t.y, maxY))
    return { x, y }
  }

  function nextTarget(opts2: {
    heroDisplay: { x: number; y: number }
    tileSize: number
    viewportW: number
    viewportH: number
    floorW: number
    floorH: number
  }): CameraOffset {
    const hpx = opts2.heroDisplay.x + opts2.tileSize / 2
    const hpy = opts2.heroDisplay.y + opts2.tileSize / 2
    const vcx = opts2.viewportW / 2
    const vcy = opts2.viewportH / 2
    const dhw = opts2.viewportW * dzx / 2
    const dhh = opts2.viewportH * dzy / 2

    // Hero screen position given current target (deadzone is anchored to current target, not lerped current).
    const hsx = hpx - target.x
    const hsy = hpy - target.y

    let tx = target.x
    let ty = target.y
    if (hsx < vcx - dhw) tx = hpx - (vcx - dhw)
    else if (hsx > vcx + dhw) tx = hpx - (vcx + dhw)
    if (hsy < vcy - dhh) ty = hpy - (vcy - dhh)
    else if (hsy > vcy + dhh) ty = hpy - (vcy + dhh)

    return clampToFloor({ x: tx, y: ty }, opts2)
  }

  return {
    update(args) {
      if (snapNext) {
        if (!initialized) {
          // Bootstrap: seed target to the centered offset so the first snap
          // lands on a meaningful position rather than drifting from {0,0}.
          target = computeCameraOffset(args.heroDisplay, args.tileSize, args.viewportW, args.viewportH, args.floorW, args.floorH)
        } else {
          // Subsequent snap: use deadzone logic then jump cur to target.
          target = nextTarget(args)
        }
        cur = target
        snapNext = false
        initialized = true
        return cur
      }
      initialized = true
      target = nextTarget(args)
      const k = 1 - Math.exp(-args.dtMs * lerpHz / 1000)
      cur = {
        x: cur.x + (target.x - cur.x) * k,
        y: cur.y + (target.y - cur.y) * k,
      }
      return cur
    },
    snap() { snapNext = true },
    current() { return cur },
  }
}
