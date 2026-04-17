import { describe, it, expect } from 'bun:test'
import { appendLog, LOG_MAX } from '../../src/core/log'
import type { LogEntry } from '../../src/core/types'

describe('log', () => {
  it('appends entries', () => {
    const a: LogEntry[] = []
    const b = appendLog(a, { tick: 1, text: 'hello' })
    expect(b).toEqual([{ tick: 1, text: 'hello' }])
    expect(a).toEqual([])
  })

  it('caps at LOG_MAX', () => {
    let entries: LogEntry[] = []
    for (let i = 0; i < LOG_MAX + 10; i++) {
      entries = appendLog(entries, { tick: i, text: `e${i}` })
    }
    expect(entries.length).toBe(LOG_MAX)
    expect(entries[0].tick).toBe(10)
    expect(entries[entries.length - 1].tick).toBe(LOG_MAX + 9)
  })
})
