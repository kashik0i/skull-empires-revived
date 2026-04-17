/// <reference lib="WebWorker" />

// Worker tested via runtime smoke in src/main.ts integration — no unit test here due to environment limits.

import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type WorkerMsg =
  | { kind: 'start-run'; runId: string; seed: string; reqId?: number }
  | {
      kind: 'append-event'
      runId: string
      events: Array<{ idx: number; tick: number; actionJson: string }>
      reqId?: number
    }
  | { kind: 'end-run'; runId: string; outcome: 'win' | 'loss'; finalTick: number; reqId?: number }
  | { kind: 'get-latest-unended'; reqId?: number }
  | { kind: 'delete-run'; runId: string; reqId?: number }

export type WorkerResp =
  | { kind: 'ready' }
  | { kind: 'ok'; for: WorkerMsg['kind']; reqId?: number }
  | {
      kind: 'latest-unended'
      reqId?: number
      run: null | {
        runId: string
        seed: string
        log: Array<{ idx: number; tick: number; actionJson: string }>
      }
    }
  | { kind: 'error'; message: string; reqId?: number }

// ---------------------------------------------------------------------------
// Inline schema (schema.sql is the human-readable reference)
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  seed TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  outcome TEXT,
  final_tick INTEGER
);

CREATE TABLE IF NOT EXISTS run_events (
  run_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  tick INTEGER NOT NULL,
  action_json TEXT NOT NULL,
  PRIMARY KEY (run_id, idx),
  FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events(run_id, idx);
`

// ---------------------------------------------------------------------------
// Helper: only include reqId key when it is actually defined
// ---------------------------------------------------------------------------

function withReqId(reqId: number | undefined): { reqId: number } | Record<never, never> {
  return reqId !== undefined ? { reqId } : {}
}

// ---------------------------------------------------------------------------
// Worker init
// ---------------------------------------------------------------------------

let db: Database | null = null

async function init(): Promise<void> {
  const sqlite3 = await sqlite3InitModule()

  let opfsAvailable = false
  try {
    // OpfsDb is only present when OPFS VFS loaded successfully
    if (sqlite3.oo1.OpfsDb) {
      db = new sqlite3.oo1.OpfsDb('skull-empires.sqlite3', 'cw')
      opfsAvailable = true
    }
  } catch (_err) {
    opfsAvailable = false
  }

  if (!opfsAvailable || db === null) {
    // Fallback: in-memory — runs are lost on reload but the game still works
    const resp: WorkerResp = {
      kind: 'error',
      message: '[db-worker] OPFS unavailable — falling back to :memory: (runs will not persist across page reloads)',
    }
    self.postMessage(resp)
    db = new sqlite3.oo1.DB(':memory:', 'cw')
  }

  db.exec(SCHEMA_SQL)

  const ready: WorkerResp = { kind: 'ready' }
  self.postMessage(ready)
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

function handleMessage(msg: WorkerMsg): WorkerResp {
  if (db === null) {
    return { kind: 'error', message: 'DB not initialized', ...withReqId(msg.reqId) }
  }

  switch (msg.kind) {
    case 'start-run': {
      db.exec({
        sql: `INSERT OR IGNORE INTO runs (id, seed, started_at) VALUES (?, ?, unixepoch())`,
        bind: [msg.runId, msg.seed],
      })
      return { kind: 'ok', for: 'start-run', ...withReqId(msg.reqId) }
    }

    case 'append-event': {
      if (msg.events.length === 0) {
        return { kind: 'ok', for: 'append-event', ...withReqId(msg.reqId) }
      }
      db.exec('BEGIN')
      try {
        for (const ev of msg.events) {
          db.exec({
            sql: `INSERT OR IGNORE INTO run_events (run_id, idx, tick, action_json) VALUES (?, ?, ?, ?)`,
            bind: [msg.runId, ev.idx, ev.tick, ev.actionJson],
          })
        }
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      return { kind: 'ok', for: 'append-event', ...withReqId(msg.reqId) }
    }

    case 'end-run': {
      db.exec({
        sql: `UPDATE runs SET ended_at = unixepoch(), outcome = ?, final_tick = ? WHERE id = ?`,
        bind: [msg.outcome, msg.finalTick, msg.runId],
      })
      return { kind: 'ok', for: 'end-run', ...withReqId(msg.reqId) }
    }

    case 'get-latest-unended': {
      // Find most recent un-ended run
      const rows: Array<{ id: string; seed: string }> = []
      db.exec({
        sql: `SELECT id, seed FROM runs WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
        rowMode: 'object',
        callback: (row: unknown) => {
          const r = row as { id: string; seed: string }
          rows.push(r)
        },
      })

      if (rows.length === 0) {
        return { kind: 'latest-unended', run: null, ...withReqId(msg.reqId) }
      }

      const { id: runId, seed } = rows[0]
      const log: Array<{ idx: number; tick: number; actionJson: string }> = []
      db.exec({
        sql: `SELECT idx, tick, action_json FROM run_events WHERE run_id = ? ORDER BY idx`,
        bind: [runId],
        rowMode: 'object',
        callback: (row: unknown) => {
          const r = row as { idx: number; tick: number; action_json: string }
          log.push({ idx: r.idx, tick: r.tick, actionJson: r.action_json })
        },
      })

      return {
        kind: 'latest-unended',
        run: { runId, seed, log },
        ...withReqId(msg.reqId),
      }
    }

    case 'delete-run': {
      db.exec('BEGIN')
      try {
        db.exec({
          sql: `DELETE FROM run_events WHERE run_id = ?`,
          bind: [msg.runId],
        })
        db.exec({
          sql: `DELETE FROM runs WHERE id = ?`,
          bind: [msg.runId],
        })
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      return { kind: 'ok', for: 'delete-run', ...withReqId(msg.reqId) }
    }

    default: {
      // Exhaustiveness check
      const _never: never = msg
      return { kind: 'error', message: `Unknown message kind: ${JSON.stringify(_never)}` }
    }
  }
}

// ---------------------------------------------------------------------------
// Event listener
// ---------------------------------------------------------------------------

self.addEventListener('message', (e: MessageEvent<WorkerMsg>) => {
  const msg = e.data
  try {
    const resp = handleMessage(msg)
    self.postMessage(resp)
  } catch (err) {
    const resp: WorkerResp = {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
      ...withReqId(msg.reqId),
    }
    self.postMessage(resp)
  }
})

// Start init; errors during init are posted back as error messages
init().catch((err: unknown) => {
  const resp: WorkerResp = {
    kind: 'error',
    message: `[db-worker] init failed: ${err instanceof Error ? err.message : String(err)}`,
  }
  self.postMessage(resp)
})
