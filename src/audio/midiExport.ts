export type CapturedNote = {
  timeMs: number
  freq: number
  durMs: number
  gain: number
  voice: 'melody' | 'bass' | 'arp' | 'perc-kick' | 'perc-hat'
}

const DIVISION = 480

const VOICE_CHANNEL: Record<CapturedNote['voice'], number> = {
  melody: 0,
  bass: 1,
  arp: 2,
  'perc-kick': 9,   // channel 10 (0-indexed)
  'perc-hat': 9,
}

const PERC_PITCH: Record<'perc-kick' | 'perc-hat', number> = {
  'perc-kick': 36,
  'perc-hat': 42,
}

function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440))
}

function vlq(value: number): number[] {
  if (value < 0) value = 0
  const bytes: number[] = []
  let v = value & 0x0fffffff
  bytes.unshift(v & 0x7f)
  v >>= 7
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
    v >>= 7
  }
  return bytes
}

function msToTicks(ms: number, bpm: number): number {
  // ticks = (ms / 1000) * (bpm / 60) * DIVISION
  return Math.max(0, Math.round((ms * bpm * DIVISION) / 60000))
}

type TrackEvent = { absTick: number; bytes: number[] }

function buildTrack(events: TrackEvent[]): number[] {
  events.sort((a, b) => a.absTick - b.absTick)
  const out: number[] = []
  let lastTick = 0
  for (const ev of events) {
    const delta = ev.absTick - lastTick
    out.push(...vlq(delta), ...ev.bytes)
    lastTick = ev.absTick
  }
  // End-of-track meta event: delta=0, FF 2F 00.
  out.push(0, 0xff, 0x2f, 0)
  return out
}

function wrapTrack(body: number[]): number[] {
  const len = body.length
  return [
    0x4d, 0x54, 0x72, 0x6b,
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...body,
  ]
}

export function encodeMidi(notes: CapturedNote[], bpm: number): Uint8Array {
  const tracks: Record<'melody' | 'bass' | 'arp' | 'perc', TrackEvent[]> = {
    melody: [], bass: [], arp: [], perc: [],
  }
  for (const n of notes) {
    const ch = VOICE_CHANNEL[n.voice]
    const isPerc = n.voice === 'perc-kick' || n.voice === 'perc-hat'
    const pitch = isPerc ? PERC_PITCH[n.voice as 'perc-kick' | 'perc-hat'] : freqToMidi(n.freq)
    if (!isFinite(pitch) || pitch < 0 || pitch > 127) continue
    const vel = Math.max(1, Math.min(127, Math.round(n.gain * 127)))
    const onTick = msToTicks(n.timeMs, bpm)
    const offTick = msToTicks(n.timeMs + n.durMs, bpm)
    const trackKey = isPerc ? 'perc' : (n.voice as 'melody' | 'bass' | 'arp')
    tracks[trackKey].push({ absTick: onTick, bytes: [0x90 | ch, pitch, vel] })
    tracks[trackKey].push({ absTick: offTick, bytes: [0x80 | ch, pitch, 0] })
  }

  const trackBytes = [
    wrapTrack(buildTrack(tracks.melody)),
    wrapTrack(buildTrack(tracks.bass)),
    wrapTrack(buildTrack(tracks.arp)),
    wrapTrack(buildTrack(tracks.perc)),
  ]

  // Header: format=1, ntrks=4, division=480.
  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0, 0, 0, 6,
    0, 1,
    0, 4,
    (DIVISION >>> 8) & 0xff, DIVISION & 0xff,
  ]

  const out = new Uint8Array(header.length + trackBytes.reduce((s, t) => s + t.length, 0))
  out.set(header, 0)
  let off = header.length
  for (const t of trackBytes) { out.set(t, off); off += t.length }
  return out
}

export function downloadMidi(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes] as BlobPart[], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
