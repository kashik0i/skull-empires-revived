import type { Action, World } from '../core/types'
import { decodeRun } from './url'
import { replay } from './replay'
import type { DbClient } from './db/client'

export type AutoResumeContext = {
  urlRunParam: string | null
  dbClient: DbClient
  seedFn: () => string
  runIdFn: () => string
  createFresh: (seed: string) => World
}

export type AutoResumeResult = {
  world: World
  runId: string
  seed: string
  resumedFromLog: Action[]
  source: 'url' | 'db' | 'fresh'
}

export async function resolveInitialRun(ctx: AutoResumeContext): Promise<AutoResumeResult> {
  // 1. Try URL param
  if (ctx.urlRunParam) {
    const decoded = decodeRun(ctx.urlRunParam)
    if (decoded) {
      const world = replay(decoded.seed, decoded.log)
      return {
        world,
        runId: ctx.runIdFn(),
        seed: decoded.seed,
        resumedFromLog: decoded.log,
        source: 'url',
      }
    }
    // decode failed — fall through to DB
  }

  // 2. Try DB
  const latest = await ctx.dbClient.getLatestUnended()
  if (latest) {
    if (latest.log.length > 0) {
      const log = latest.log.map(e => JSON.parse(e.actionJson) as Action)
      const world = replay(latest.seed, log)
      return {
        world,
        runId: latest.runId,
        seed: latest.seed,
        resumedFromLog: log,
        source: 'db',
      }
    }
    // empty log — delete and fall through to fresh
    await ctx.dbClient.deleteRun(latest.runId)
  }

  // 3. Fresh
  const seed = ctx.seedFn()
  const runId = ctx.runIdFn()
  const world = ctx.createFresh(seed)
  return {
    world,
    runId,
    seed,
    resumedFromLog: [],
    source: 'fresh',
  }
}
