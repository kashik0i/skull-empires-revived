import type { ActorId, Pos } from '../../core/types'

export type FxEvent =
  | { kind: 'moved'; actorId: ActorId; from: Pos; to: Pos }
  | { kind: 'attacked'; attackerId: ActorId; targetId: ActorId; attackerPos: Pos; targetPos: Pos }
  | { kind: 'damaged'; targetId: ActorId; amount: number; pos: Pos; isHero: boolean }
  | { kind: 'died'; actorId: ActorId; pos: Pos; archetype: string }
  | { kind: 'run-ended'; outcome: 'won' | 'lost' }
  | { kind: 'card-played'; cardId: string; targetPos?: Pos }

export type FxSubscriber = (event: FxEvent) => void

export type FxBus = {
  publish(event: FxEvent): void
  subscribe(subscriber: FxSubscriber): () => void
  drain(): void
}

export function createFxBus(): FxBus {
  const subscribers: FxSubscriber[] = []
  let queue: FxEvent[] = []
  return {
    publish(event) { queue.push(event) },
    subscribe(sub) {
      subscribers.push(sub)
      return () => {
        const i = subscribers.indexOf(sub)
        if (i >= 0) subscribers.splice(i, 1)
      }
    },
    drain() {
      const batch = queue
      queue = []
      for (const event of batch) for (const sub of subscribers) sub(event)
    },
  }
}
