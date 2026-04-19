import { describe, it, expect } from 'bun:test'
import { encodeMidi, type CapturedNote } from '../../src/audio/midiExport'

describe('encodeMidi', () => {
  it('produces a valid MIDI Type-1 header for 4 tracks', () => {
    const bytes = encodeMidi([], 120)
    // MThd header
    expect(bytes[0]).toBe(0x4d) // M
    expect(bytes[1]).toBe(0x54) // T
    expect(bytes[2]).toBe(0x68) // h
    expect(bytes[3]).toBe(0x64) // d
    // chunk length = 6
    expect(bytes[4]).toBe(0); expect(bytes[5]).toBe(0); expect(bytes[6]).toBe(0); expect(bytes[7]).toBe(6)
    // format = 1
    expect(bytes[8]).toBe(0); expect(bytes[9]).toBe(1)
    // ntrks = 4
    expect(bytes[10]).toBe(0); expect(bytes[11]).toBe(4)
    // division = 480 ticks/quarter
    expect(bytes[12]).toBe(0x01); expect(bytes[13]).toBe(0xe0)
  })

  it('emits 4 MTrk chunks', () => {
    const bytes = encodeMidi([], 120)
    let count = 0
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0x4d && bytes[i + 1] === 0x54 && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x6b) count++
    }
    expect(count).toBe(4)
  })

  it('encodes a single melody note with correct pitch and velocity', () => {
    // 440 Hz = MIDI 69, gain 0.5 → velocity 64
    const notes: CapturedNote[] = [
      { timeMs: 0, freq: 440, durMs: 500, gain: 0.5, voice: 'melody' },
    ]
    const bytes = encodeMidi(notes, 120)
    // Look for note-on event 0x90 (channel 1) followed by pitch 69 and velocity 64.
    let found = false
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x90 && bytes[i + 1] === 69 && bytes[i + 2] === 64) { found = true; break }
    }
    expect(found).toBe(true)
  })

  it('routes percussion to channel 10 (status byte 0x99) with kick=36', () => {
    const notes: CapturedNote[] = [
      { timeMs: 0, freq: 0, durMs: 50, gain: 0.8, voice: 'perc-kick' },
    ]
    const bytes = encodeMidi(notes, 120)
    let found = false
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x99 && bytes[i + 1] === 36) { found = true; break }
    }
    expect(found).toBe(true)
  })

  it('encodes delta times in variable-length quantity', () => {
    // A note 1 beat in (= 480 ticks at division 480) at 120bpm = 500ms.
    const notes: CapturedNote[] = [
      { timeMs: 500, freq: 440, durMs: 100, gain: 0.5, voice: 'melody' },
    ]
    const bytes = encodeMidi(notes, 120)
    // VLQ for 480 = 0x83 0x60 (binary: 1_0000011 0_1100000).
    let found = false
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0x83 && bytes[i + 1] === 0x60) { found = true; break }
    }
    expect(found).toBe(true)
  })
})
