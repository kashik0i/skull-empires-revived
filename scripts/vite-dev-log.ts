import { appendFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const DEBUG_DIR = resolve(process.cwd(), '.debug')

// Only allow alphanumeric + dash/underscore to prevent path traversal.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((res, rej) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { res(body ? JSON.parse(body) : {}) } catch (e) { rej(e) }
    })
    req.on('error', rej)
  })
}

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

      server.middlewares.use('/_dev/event', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const body = await readJson(req) as { runId?: string; entry?: unknown }
          if (!body.runId) { res.statusCode = 400; return res.end('runId required') }
          const file = pathFor(body.runId)
          if (!file) { res.statusCode = 400; return res.end('invalid runId') }
          appendFileSync(file, JSON.stringify(body.entry) + '\n')
          res.statusCode = 204
          res.end()
        } catch (err) {
          res.statusCode = 500
          res.end(String(err))
        }
      })

      server.middlewares.use('/_dev/reset', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const body = await readJson(req) as { runId?: string }
          if (!body.runId) { res.statusCode = 400; return res.end('runId required') }
          const file = pathFor(body.runId)
          if (!file) { res.statusCode = 400; return res.end('invalid runId') }
          try { rmSync(file, { force: true }) } catch { /* ignore */ }
          res.statusCode = 204
          res.end()
        } catch (err) {
          res.statusCode = 500
          res.end(String(err))
        }
      })
    },
  }
}
