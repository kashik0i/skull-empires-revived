import { describe, it, expect } from 'bun:test'
import { validateShapeRecipe, type ShapeRecipe } from '../../src/render/shape'

describe('shape recipe', () => {
  it('accepts a well-formed recipe', () => {
    const valid: ShapeRecipe = {
      body:   { type: 'rect', w: 0.5, h: 0.7, color: 'boneWhite', corner: 0.2 },
      accent: { type: 'strip', y: 0.3, h: 0.06, color: 'bloodCrimson' },
      head:   { type: 'circle', y: -0.38, r: 0.2, color: 'boneWhite' },
      eyes:   { type: 'eyeDots', y: -0.4, spacing: 0.09, r: 0.03, color: 'deepPurpleDark' },
    }
    expect(validateShapeRecipe(valid)).toBe(true)
  })

  it('rejects an object missing body', () => {
    expect(validateShapeRecipe({ accent: { type: 'strip' } } as unknown)).toBe(false)
  })

  it('rejects a recipe with unknown shape type', () => {
    const invalid = {
      body: { type: 'triangle', w: 0.5 },
    } as unknown
    expect(validateShapeRecipe(invalid)).toBe(false)
  })
})
