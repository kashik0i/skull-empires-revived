export const palette = {
  boneWhite:       '#eadbc0',
  deepPurple:      '#2a1a3e',
  deepPurpleDark:  '#1a1024',
  deepPurpleLite:  '#3e2a5c',
  bloodCrimson:    '#7a1f2e',
  silkFlameAmber:  '#f0b770',
  obsidianBlack:   '#0b0612',
  ironGray:        '#706078',
  ghostTeal:       '#4a8a8a',
  runeViolet:      '#b7a3d9',
} as const

export type PaletteKey = keyof typeof palette
export type PaletteColor = (typeof palette)[PaletteKey]

export function colorFor(key: PaletteKey): PaletteColor {
  return palette[key]
}
