import { describe, it, expect } from 'bun:test'
import { getFrame } from '../../src/render/sprites'

describe('sprite frames — phase 1H additions', () => {
  const newFrames = [
    'wall_corner_top_left', 'wall_corner_top_right',
    'wall_corner_bottom_left', 'wall_corner_bottom_right',
    'wall_side_mid_left', 'wall_side_mid_right',
    'wall_top_mid', 'column_top', 'column_mid',
    'door_closed', 'door_open',
    'chest_closed', 'chest_open',
    'wall_banner_red', 'wall_banner_blue', 'wall_banner_green', 'wall_banner_yellow',
    'crate', 'skull',
    'weapon_knight_sword', 'weapon_duel_sword', 'weapon_anime_sword',
    'weapon_golden_sword', 'weapon_lavish_sword',
  ]
  for (const name of newFrames) {
    it(`registers ${name}`, () => {
      const f = getFrame(name)
      expect(f).not.toBeNull()
      expect(f!.w).toBeGreaterThan(0)
      expect(f!.h).toBeGreaterThan(0)
    })
  }
})
