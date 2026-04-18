import { appendFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const DEBUG_DIR = resolve(process.cwd(), '.debug')

// Only allow alphanumeric + dash/underscore to prevent path traversal.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

function pathFor(runId: string): string | null {
  if (!SAFE_ID.test(runId)) return null
  return resolve(DEBUG_DIR, `${runId}.jsonl`)
}

export function devLogPlugin(): Plugin {
  return {
    name: 'skull-empires-dev-log',
    apply: 'serve',
    configureServer(server) {
      mkdirSync(DEBUG_DIR, { recursive: true })

      server.ws.on('skull-log:batch', (data: { runId?: string; entries?: unknown[] }) => {
        if (!data.runId || !Array.isArray(data.entries) || data.entries.length === 0) return
        const file = pathFor(data.runId)
        if (!file) return
        const payload = data.entries.map(e => JSON.stringify(e)).join('\n') + '\n'
        try { appendFileSync(file, payload) } catch { /* ignore */ }
      })

      server.ws.on('skull-log:reset', (data: { runId?: string }) => {
        if (!data.runId) return
        const file = pathFor(data.runId)
        if (!file) return
        try { rmSync(file, { force: true }) } catch { /* ignore */ }
      })
    },
  }
}
