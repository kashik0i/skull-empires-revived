import type { Pos } from '../core/types'

export type CameraOffset = { x: number; y: number }

/**
 * Compute camera offset in world pixels so that the hero is centered in the
 * viewport. Offset is clamped to [0, floor*tile - viewport] on each axis; if
 * the floor fits the viewport on an axis, that axis's offset is 0.
 */
export function computeCameraOffset(
  heroDisplay: { x: number; y: number },
  tileSize: number,
  viewportW: number,
  viewportH: number,
  floorW: number,
  floorH: number,
): CameraOffset {
  const floorPxW = floorW * tileSize
  const floorPxH = floorH * tileSize

  const rawX = heroDisplay.x + tileSize / 2 - viewportW / 2
  const rawY = heroDisplay.y + tileSize / 2 - viewportH / 2

  const maxX = floorPxW - viewportW
  const maxY = floorPxH - viewportH

  const x = maxX <= 0 ? 0 : Math.max(0, Math.min(rawX, maxX))
  const y = maxY <= 0 ? 0 : Math.max(0, Math.min(rawY, maxY))

  return { x, y }
}

/**
 * Convert a client (screen) click coordinate into a world tile, inverting
 * the render translate. Applies CSS-scale correction via canvasRect vs
 * canvasSize, then adds cameraOffset before dividing by tileSize.
 */
export function screenToWorldTile(
  clientX: number,
  clientY: number,
  canvasRect: { left: number; top: number; width: number; height: number },
  canvasSize: { width: number; height: number },
  tileSize: number,
  cameraOffset: CameraOffset,
): Pos {
  const scaleX = canvasSize.width / canvasRect.width
  const scaleY = canvasSize.height / canvasRect.height
  const canvasX = (clientX - canvasRect.left) * scaleX
  const canvasY = (clientY - canvasRect.top) * scaleY
  const worldX = canvasX + cameraOffset.x
  const worldY = canvasY + cameraOffset.y
  return { x: Math.floor(worldX / tileSize), y: Math.floor(worldY / tileSize) }
}
