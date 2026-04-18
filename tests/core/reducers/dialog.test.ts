import { describe, it, expect } from 'bun:test'
import { createInitialWorld } from '../../../src/core/state'
import { dispatch } from '../../../src/core/dispatch'

describe('ClearDialog', () => {
  it('nulls pendingDialog when set', () => {
    const base = createInitialWorld('dlg-1')
    const state = {
      ...base,
      pendingDialog: { title: 't', body: 'b', actions: [] },
    }
    const next = dispatch(state, { type: 'ClearDialog' })
    expect(next.pendingDialog).toBeNull()
  })

  it('is a no-op when pendingDialog is already null', () => {
    const base = createInitialWorld('dlg-2')
    expect(base.pendingDialog).toBeNull()
    const next = dispatch(base, { type: 'ClearDialog' })
    expect(next).toBe(base)
  })
})
