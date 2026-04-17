import { describe, it, expect } from 'bun:test'
import { palette, type PaletteKey } from '../../src/content/palette'

describe('palette', () => {
  it('exposes 10 named color keys', () => {
    const keys: PaletteKey[] = [
      'boneWhite', 'deepPurple', 'deepPurpleDark', 'deepPurpleLite',
      'bloodCrimson', 'silkFlameAmber', 'obsidianBlack', 'ironGray',
      'ghostTeal', 'runeViolet',
    ]
    for (const k of keys) expect(palette[k]).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('key set is exactly the documented set', () => {
    expect(Object.keys(palette).sort()).toEqual([
      'boneWhite', 'bloodCrimson', 'deepPurple', 'deepPurpleDark', 'deepPurpleLite',
      'ghostTeal', 'ironGray', 'obsidianBlack', 'runeViolet', 'silkFlameAmber',
    ].sort())
  })
})
