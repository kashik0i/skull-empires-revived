import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { rootReducer } from '../../../src/core/reducers'
import type { World, Action } from '../../../src/core/types'

/** Give hero a specific hand for testing. */
function withHand(w: World, hand: string[]): World {
  return { ...w, run: { ...w.run, cards: { ...w.run.cards, hand } } }
}

/** Place first enemy adjacent to hero. */
function placeEnemyNextToHero(w: World): { world: World; enemyId: string } {
  const hero = w.actors[w.heroId]
  const enemyId = Object.keys(w.actors).find(id => id !== w.heroId)!
  const enemy = w.actors[enemyId]
  return {
    world: {
      ...w,
      actors: {
        ...w.actors,
        [enemyId]: { ...enemy, pos: { x: hero.pos.x + 1, y: hero.pos.y } },
      },
    },
    enemyId,
  }
}

describe('PlayCard reducer', () => {
  it('heal: increases hero hp capped at maxHp, moves card from hand to discard', () => {
    const base = createInitialWorld('card-heal-1')
    const hero = base.actors[base.heroId]
    // Damage the hero first
    const damaged: World = {
      ...base,
      actors: { ...base.actors, [base.heroId]: { ...hero, hp: hero.maxHp - 5 } },
    }
    const w = withHand(damaged, ['heal'])
    const action: Action = { type: 'PlayCard', cardId: 'heal' }
    const w2 = rootReducer(w, action)

    expect(w2.actors[w2.heroId].hp).toBe(Math.min(hero.maxHp, (hero.maxHp - 5) + 8))
    expect(w2.run.cards.hand).not.toContain('heal')
    expect(w2.run.cards.discard).toContain('heal')
  })

  it('heal: hp is capped at maxHp even if amount would overheal', () => {
    const base = createInitialWorld('card-heal-2')
    const hero = base.actors[base.heroId]
    // hero is at full hp
    const w = withHand(base, ['heal'])
    const action: Action = { type: 'PlayCard', cardId: 'heal' }
    const w2 = rootReducer(w, action)
    expect(w2.actors[w2.heroId].hp).toBe(hero.maxHp)
  })

  it('PlayCard with invalid cardId (not in hand) → no-op', () => {
    const w = createInitialWorld('card-invalid-1')
    const action: Action = { type: 'PlayCard', cardId: 'nonexistent-card' }
    const w2 = rootReducer(w, action)
    expect(w2).toBe(w)
  })

  it('smite (direct-damage target=enemy) without targetId → no-op', () => {
    const base = createInitialWorld('card-smite-notarget')
    const w = withHand(base, ['smite'])
    const action: Action = { type: 'PlayCard', cardId: 'smite' }
    const w2 = rootReducer(w, action)
    expect(w2).toBe(w)
  })

  it('smite with valid targetId → target hp drops, card moves hand → discard', () => {
    const base = createInitialWorld('card-smite-valid')
    const { world: placed, enemyId } = placeEnemyNextToHero(base)
    const w = withHand(placed, ['smite'])
    const beforeHp = w.actors[enemyId].hp
    const action: Action = { type: 'PlayCard', cardId: 'smite', targetId: enemyId }
    const w2 = rootReducer(w, action)
    expect(w2.actors[enemyId].hp).toBeLessThan(beforeHp)
    expect(w2.run.cards.hand).not.toContain('smite')
    expect(w2.run.cards.discard).toContain('smite')
  })

  it('storm (aoe-damage) damages ALL alive enemies', () => {
    const base = createInitialWorld('card-storm-1')
    const w = withHand(base, ['storm'])
    const enemyIds = Object.keys(w.actors).filter(id => id !== w.heroId && w.actors[id].alive)
    const action: Action = { type: 'PlayCard', cardId: 'storm' }
    const w2 = rootReducer(w, action)
    for (const eid of enemyIds) {
      expect(w2.actors[eid].hp).toBeLessThan(w.actors[eid].hp)
    }
    expect(w2.run.cards.hand).not.toContain('storm')
    expect(w2.run.cards.discard).toContain('storm')
  })

  it('bless (buff-atk) pushes a StatusEffect onto hero with correct remainingTicks', () => {
    const base = createInitialWorld('card-bless-1')
    const w = withHand(base, ['bless'])
    const action: Action = { type: 'PlayCard', cardId: 'bless' }
    const w2 = rootReducer(w, action)
    const hero = w2.actors[w2.heroId]
    const buffAtk = hero.statusEffects.find(s => s.kind === 'buff-atk')
    expect(buffAtk).toBeDefined()
    expect(buffAtk!.amount).toBe(2)
    expect(buffAtk!.remainingTicks).toBe(30)
    expect(w2.run.cards.hand).not.toContain('bless')
    expect(w2.run.cards.discard).toContain('bless')
  })

  it('curse (debuff-def) pushes a StatusEffect onto target enemy with correct remainingTicks', () => {
    const base = createInitialWorld('card-curse-1')
    const enemyId = Object.keys(base.actors).find(id => id !== base.heroId)!
    const w = withHand(base, ['curse'])
    const action: Action = { type: 'PlayCard', cardId: 'curse', targetId: enemyId }
    const w2 = rootReducer(w, action)
    const enemy = w2.actors[enemyId]
    const debuff = enemy.statusEffects.find(s => s.kind === 'debuff-def')
    expect(debuff).toBeDefined()
    expect(debuff!.amount).toBe(1)
    expect(debuff!.remainingTicks).toBe(20)
    expect(w2.run.cards.discard).toContain('curse')
  })

  it('greater-heal restores 12 HP capped at maxHp', () => {
    const base = createInitialWorld('gh-1')
    const heroId = base.heroId
    const hero = base.actors[heroId]
    const wounded: World = {
      ...base,
      actors: { ...base.actors, [heroId]: { ...hero, hp: 5 } },
      run: { ...base.run, cards: { ...base.run.cards, hand: ['greater-heal'] } },
    }
    const action: Action = { type: 'PlayCard', cardId: 'greater-heal' }
    const next = rootReducer(wounded, action)
    expect(next.actors[heroId].hp).toBe(17)
  })

  it('fortify applies buff-def status', () => {
    const base = createInitialWorld('frt-1')
    const heroId = base.heroId
    const state: World = {
      ...base,
      run: { ...base.run, cards: { ...base.run.cards, hand: ['fortify'] } },
    }
    const action: Action = { type: 'PlayCard', cardId: 'fortify' }
    const next = rootReducer(state, action)
    const buffs = next.actors[heroId].statusEffects.filter(s => s.kind === 'buff-def')
    expect(buffs.length).toBe(1)
    expect(buffs[0].amount).toBe(2)
  })

  it('vigor applies buff-atk status', () => {
    const base = createInitialWorld('vgr-1')
    const heroId = base.heroId
    const state: World = {
      ...base,
      run: { ...base.run, cards: { ...base.run.cards, hand: ['vigor'] } },
    }
    const action: Action = { type: 'PlayCard', cardId: 'vigor' }
    const next = rootReducer(state, action)
    const buffs = next.actors[heroId].statusEffects.filter(s => s.kind === 'buff-atk')
    expect(buffs.some(b => b.amount === 3)).toBe(true)
  })
})

describe('OfferCardReward reducer', () => {
  it('sets pendingReward and phase to card_reward', () => {
    const w = createInitialWorld('offer-reward-1')
    const choices = ['bless', 'storm', 'heal']
    const action: Action = { type: 'OfferCardReward', choices }
    const w2 = rootReducer(w, action)
    expect(w2.phase).toBe('card_reward')
    expect(w2.run.pendingReward).toEqual({ choices })
  })
})

describe('PickCardReward reducer', () => {
  it('adds cardId to deck, nulls pendingReward, phase back to exploring', () => {
    const base = createInitialWorld('pick-reward-1')
    const offered = rootReducer(base, { type: 'OfferCardReward', choices: ['bless', 'storm', 'heal'] })
    const w2 = rootReducer(offered, { type: 'PickCardReward', cardId: 'bless' })
    expect(w2.run.cards.deck).toContain('bless')
    expect(w2.run.pendingReward).toBeNull()
    expect(w2.phase).toBe('exploring')
  })

  it('PickCardReward with null pendingReward → no-op', () => {
    const w = createInitialWorld('pick-reward-noop')
    expect(w.run.pendingReward).toBeNull()
    const action: Action = { type: 'PickCardReward', cardId: 'bless' }
    const w2 = rootReducer(w, action)
    expect(w2).toBe(w)
  })
})
