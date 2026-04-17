import type { Pos } from '../core/types'
import { screenToWorldTile } from '../render/camera'
import type { CameraOffset } from '../render/camera'

export type DevInputHandlers = {
  onTileClick(tile: Pos): void
  onPauseToggle(): void
  onRestart(): void
}

export function attachDevInput(
  canvas: HTMLCanvasElement,
  tileSize: number,
  handlers: DevInputHandlers,
  cameraOffsetGetter: () => CameraOffset = () => ({ x: 0, y: 0 }),
): () => void {
  function onClick(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect()
    const tile = screenToWorldTile(
      e.clientX,
      e.clientY,
      rect,
      { width: canvas.width, height: canvas.height },
      tileSize,
      cameraOffsetGetter(),
    )
    handlers.onTileClick(tile)
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === ' ') { e.preventDefault(); handlers.onPauseToggle() }
    else if (e.key.toLowerCase() === 'r') handlers.onRestart()
  }
  canvas.addEventListener('click', onClick)
  window.addEventListener('keydown', onKey)
  return () => {
    canvas.removeEventListener('click', onClick)
    window.removeEventListener('keydown', onKey)
  }
}
