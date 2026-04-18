import { appendFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

const LOG_FILE = resolve(process.cwd(), '.debug/run.jsonl')

function readJson(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => res(body))
    req.on('error', rej)
  })
}

export function devLogPlugin(): Plugin {
  return {
    name: 'skull-empires-dev-log',
    apply: 'serve',
    configureServer(server) {
      mkdirSync(dirname(LOG_FILE), { recursive: true })

      server.middlewares.use('/_dev/event', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const body = await readJson(req)
          appendFileSync(LOG_FILE, body.endsWith('\n') ? body : body + '\n')
          res.statusCode = 204
          res.end()
        } catch (err) {
          res.statusCode = 500
          res.end(String(err))
        }
      })

      server.middlewares.use('/_dev/reset', (req, res, next) => {
        if (req.method !== 'POST') return next()
        try { rmSync(LOG_FILE, { force: true }) } catch { /* ignore */ }
        res.statusCode = 204
        res.end()
      })
    },
  }
}
