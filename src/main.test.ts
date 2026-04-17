import { describe, expect, test } from 'bun:test'
import { bootMarker } from './main'

describe('bootMarker', () => {
  test('has the expected value', () => {
    expect(bootMarker).toBe('skull-empires-revived:boot')
  })
})
