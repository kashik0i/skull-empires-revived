import { describe, it, expect, mock } from 'bun:test'
import { resolveInitialRun } from '../../src/persistence/autoResume'
import { encodeRun } from '../../src/persistence/url'
import type { DbClient, LatestUnended } from '../../src/persistence/db/client'
import type { Action, World } from '../../src/core/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbClient(overrides: Partial<DbClient> = {}): DbClient {
  return {
    startRun: mock(() => Promise.resolve()),
    appendEvent: mock(() => {}),
    endRun: mock(() => Promise.resolve()),
    getLatestUnended: mock(() => Promise.resolve(null)),
    deleteRun: mock(() => Promise.resolve()),
    flush: mock(() => Promise.resolve()),
    dispose: mock(() => {}),
    ...overrides,
  }
}

function makeWorld(seed: string): World {
  return { seed } as unknown as World
}

const SEED_A = 'seed-aaa'
const SEED_B = 'seed-bbb'
const RUN_ID_FIXED = 'run-fixed-uuid'

const sampleActions: Action[] = [
  { type: 'MoveActor', actorId: 'hero-1', to: { x: 1, y: 2 } },
  { type: 'TurnAdvance' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveInitialRun', () => {
  it('URL param valid → source:url, world replayed, DB not queried', async () => {
    const encoded = encodeRun(SEED_A, sampleActions)
    const db = makeDbClient()

    const result = await resolveInitialRun({
      urlRunParam: encoded,
      dbClient: db,
      seedFn: () => SEED_B,
      runIdFn: () => RUN_ID_FIXED,
      createFresh: (s) => makeWorld(s),
    })

    expect(result.source).toBe('url')
    expect(result.seed).toBe(SEED_A)
    expect(result.resumedFromLog).toEqual(sampleActions)
    expect(result.runId).toBe(RUN_ID_FIXED)
    // DB should NOT have been consulted
    expect((db.getLatestUnended as ReturnType<typeof mock>).mock.calls.length).toBe(0)
  })

  it('URL param null, DB returns run with log → source:db, runId from DB', async () => {
    const dbRun: LatestUnended = {
      runId: 'db-run-id',
      seed: SEED_A,
      log: sampleActions.map((a, i) => ({ idx: i, tick: i, actionJson: JSON.stringify(a) })),
    }
    const db = makeDbClient({
      getLatestUnended: mock(() => Promise.resolve(dbRun)),
    })

    const result = await resolveInitialRun({
      urlRunParam: null,
      dbClient: db,
      seedFn: () => SEED_B,
      runIdFn: () => RUN_ID_FIXED,
      createFresh: (s) => makeWorld(s),
    })

    expect(result.source).toBe('db')
    expect(result.runId).toBe('db-run-id')
    expect(result.seed).toBe(SEED_A)
    expect(result.resumedFromLog).toEqual(sampleActions)
    expect((db.deleteRun as ReturnType<typeof mock>).mock.calls.length).toBe(0)
  })

  it('URL param null, DB returns run with empty log → deleteRun called, source:fresh', async () => {
    const dbRun: LatestUnended = {
      runId: 'empty-run-id',
      seed: SEED_A,
      log: [],
    }
    const db = makeDbClient({
      getLatestUnended: mock(() => Promise.resolve(dbRun)),
    })

    const result = await resolveInitialRun({
      urlRunParam: null,
      dbClient: db,
      seedFn: () => SEED_B,
      runIdFn: () => RUN_ID_FIXED,
      createFresh: (s) => makeWorld(s),
    })

    expect(result.source).toBe('fresh')
    expect((db.deleteRun as ReturnType<typeof mock>).mock.calls.length).toBe(1)
    expect((db.deleteRun as ReturnType<typeof mock>).mock.calls[0]![0]).toBe('empty-run-id')
    expect(result.seed).toBe(SEED_B)
    expect(result.resumedFromLog).toEqual([])
  })

  it('URL param null, DB returns null → source:fresh, seedFn + runIdFn called', async () => {
    const db = makeDbClient({
      getLatestUnended: mock(() => Promise.resolve(null)),
    })
    let seedCalls = 0
    let runIdCalls = 0

    const result = await resolveInitialRun({
      urlRunParam: null,
      dbClient: db,
      seedFn: () => { seedCalls++; return SEED_B },
      runIdFn: () => { runIdCalls++; return RUN_ID_FIXED },
      createFresh: (s) => makeWorld(s),
    })

    expect(result.source).toBe('fresh')
    expect(result.seed).toBe(SEED_B)
    expect(result.runId).toBe(RUN_ID_FIXED)
    expect(seedCalls).toBe(1)
    expect(runIdCalls).toBe(1)
    expect(result.resumedFromLog).toEqual([])
  })

  it('URL param present but decode fails → falls through to DB', async () => {
    const dbRun: LatestUnended = {
      runId: 'db-fallback-id',
      seed: SEED_A,
      log: sampleActions.map((a, i) => ({ idx: i, tick: i, actionJson: JSON.stringify(a) })),
    }
    const db = makeDbClient({
      getLatestUnended: mock(() => Promise.resolve(dbRun)),
    })

    const result = await resolveInitialRun({
      urlRunParam: 'totally-invalid-base64!!!',
      dbClient: db,
      seedFn: () => SEED_B,
      runIdFn: () => RUN_ID_FIXED,
      createFresh: (s) => makeWorld(s),
    })

    expect(result.source).toBe('db')
    expect(result.runId).toBe('db-fallback-id')
    expect((db.getLatestUnended as ReturnType<typeof mock>).mock.calls.length).toBe(1)
  })
})
