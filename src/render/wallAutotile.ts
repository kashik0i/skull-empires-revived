export const NEIGHBOR_N = 1 << 0
export const NEIGHBOR_E = 1 << 1
export const NEIGHBOR_S = 1 << 2
export const NEIGHBOR_W = 1 << 3

const TABLE: Record<number, string> = {
  // mask: NESW bits
  0b0000: 'column_top',         // isolated → pillar
  0b0001: 'wall_top_mid',       // only N → cap pointing up (we sit at top of column)
  0b0010: 'wall_side_mid_left', // only E → side, opens right
  0b0011: 'wall_corner_bottom_right',
  0b0100: 'wall_top_mid',       // only S → top cap
  0b0101: 'wall_side_mid_left', // N+S → vertical, treat as left side
  0b0110: 'wall_corner_top_left',
  0b0111: 'wall_side_mid_left',
  0b1000: 'wall_side_mid_right', // only W
  0b1001: 'wall_corner_bottom_left',
  0b1010: 'wall_top_mid',        // E+W horizontal
  0b1011: 'wall_top_mid',
  0b1100: 'wall_corner_top_right',
  0b1101: 'wall_side_mid_right',
  0b1110: 'wall_top_mid',
  0b1111: 'wall_mid',            // surrounded → inner
}

/**
 * Map a 4-bit cardinal-neighbor mask to a 0x72 wall frame name.
 * Bit layout: NEIGHBOR_N | NEIGHBOR_E | NEIGHBOR_S | NEIGHBOR_W.
 * A bit is set when that neighbor is also a wall (or out-of-bounds).
 * Falls back to 'wall_mid' on lookup gap.
 */
export function wallVariantForMask(mask: number): string {
  return TABLE[mask & 0b1111] ?? 'wall_mid'
}
