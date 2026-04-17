import type { LogEntry } from './types'

export const LOG_MAX = 50

export function appendLog(log: readonly LogEntry[], entry: LogEntry): LogEntry[] {
  const next = log.length >= LOG_MAX ? log.slice(log.length - LOG_MAX + 1) : log.slice()
  next.push(entry)
  return next
}
