import type { FxBus } from '../render/fx/bus'
import type { Sfx } from './sfx'

export function wireAudio(bus: FxBus, sfx: Sfx, heroId: string): () => void {
  return bus.subscribe(event => {
    switch (event.kind) {
      case 'moved':
        if (event.actorId === heroId) sfx.play('step')
        return
      case 'attacked':
        sfx.play('attack')
        return
      case 'damaged':
        sfx.play('hit')
        return
      case 'died':
        sfx.play('death')
        return
      case 'card-played':
        sfx.play('click')
        return
      case 'run-ended':
        return
    }
  })
}
