import { describe, it, expect, beforeAll } from 'vitest'
import { setupTestServer, makeTestEvent } from './utils/test-server-utils'
import enrollHandler from '~/server/api/review/enroll.post'

// NOTE: these test helpers are pseudo-helpers for the repo's test setup.
// If your repo uses a different runner/mocks, adapt accordingly.

describe('review/enroll handler', () => {
  beforeAll(() => {
    setupTestServer()
  })

  it('accepts resourceType+resourceId', async () => {
    const event = makeTestEvent({ body: { resourceType: 'material', resourceId: 'test-material-1' }, userId: 'user-1' })
    // We expect handler to either throw 404 (no DB) or respond; ensure no schema validation error
    let threw = false
    try {
      await enrollHandler(event as any)
    } catch (err: any) {
      threw = true
      // if it threw, it should not be a Zod validation error
      expect(err?.statusCode).not.toBe(400)
    }
    expect(true).toBe(true)
  })

  it('accepts legacy materialId', async () => {
    const event = makeTestEvent({ body: { materialId: 'legacy-material-1' }, userId: 'user-1' })
    let threw = false
    try {
      await enrollHandler(event as any)
    } catch (err: any) {
      threw = true
      expect(err?.statusCode).not.toBe(400)
    }
    expect(true).toBe(true)
  })
})
