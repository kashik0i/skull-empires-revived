import type { Pos } from '../core/types'

export type DevInputHandlers = {
  onTileClick(tile: Pos): void
  onPauseToggle(): void
  onRestart(): void
}

export function attachDevInput(canvas: HTMLCanvasElement, tileSize: number, handlers: DevInputHandlers): () => void {
  function onClick(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY
    const tile = { x: Math.floor(px / tileSize), y: Math.floor(py / tileSize) }
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
