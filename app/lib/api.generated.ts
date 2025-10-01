/* AUTO-GENERATED FILE. DO NOT EDIT. */
/* Generated: 2025-10-01T20:24:47.926Z */
import FetchFactory from '../services/FetchFactory'
import type { z } from 'zod'
// Each function returns unwrapped data. Validators are auto-wired when detectable.

/**
 * GET /api/admin/cron
 * Source: /Users/Bodda/cleverAI/server/api/admin/cron.ts
 */
export async function getAdminCron(ff: FetchFactory, params: void) {
  const url = '/api/admin/cron'
  return ff.call<any>('GET', url)
}

/**
 * GET /api/auth/:...
 * Source: /Users/Bodda/cleverAI/server/api/auth/[...].ts
 */
export async function getAuth(ff: FetchFactory, params: void) {
  const url = '/api/auth/:...'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/auth/authenticate
 * Source: /Users/Bodda/cleverAI/server/api/auth/authenticate/index.post.ts
 */
export async function postAuthAuthenticate(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/authenticate'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/authenticate/verify
 * Source: /Users/Bodda/cleverAI/server/api/auth/authenticate/verify.post.ts
 */
export async function postAuthAuthenticateVerify(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/authenticate/verify'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/find
 * Source: /Users/Bodda/cleverAI/server/api/auth/find.post.ts
 */
export async function postAuthFind(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/find'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/password/create
 * Source: /Users/Bodda/cleverAI/server/api/auth/password/create.post.ts
 */
export async function postAuthPasswordCreate(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/password/create'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/password/forgot
 * Source: /Users/Bodda/cleverAI/server/api/auth/password/forgot.post.ts
 */
export async function postAuthPasswordForgot(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/password/forgot'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/password/verify
 * Source: /Users/Bodda/cleverAI/server/api/auth/password/verify.post.ts
 */
export async function postAuthPasswordVerify(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/password/verify'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/register
 * Source: /Users/Bodda/cleverAI/server/api/auth/register.post.ts
 */
export async function postAuthRegister(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/register'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/verification
 * Source: /Users/Bodda/cleverAI/server/api/auth/verification/index.post.ts
 */
export async function postAuthVerification(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/verification'
  return ff.call<any>('POST', url, body)
}

/**
 * POST /api/auth/verification/verify
 * Source: /Users/Bodda/cleverAI/server/api/auth/verification/verify.post.ts
 */
export async function postAuthVerificationVerify(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/auth/verification/verify'
  return ff.call<any>('POST', url, body)
}

/**
 * GET /api/folders
 * Source: /Users/Bodda/cleverAI/server/api/folders/index.get.ts
 */
export async function getFolders(ff: FetchFactory, params: void) {
  const url = '/api/folders'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/folders
 * Source: /Users/Bodda/cleverAI/server/api/folders/index.post.ts
 */
export async function postFolders(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/folders'
  return ff.call<any>('POST', url, body)
}

/**
 * DELETE /api/folders/:id
 * Source: /Users/Bodda/cleverAI/server/api/folders/[id].delete.ts
 */
export async function deleteFoldersId(ff: FetchFactory, params: { id: string }, body?: object) {
  const url = `/api/folders/${params.id}`
  return ff.call<any>('DELETE', url, body)
}

/**
 * GET /api/folders/:id
 * Source: /Users/Bodda/cleverAI/server/api/folders/[id].get.ts
 */
export async function getFoldersId(ff: FetchFactory, params: { id: string }) {
  const url = `/api/folders/${params.id}`
  return ff.call<any>('GET', url)
}

/**
 * PATCH /api/folders/:id
 * Source: /Users/Bodda/cleverAI/server/api/folders/[id].patch.ts
 */
export async function patchFoldersId(ff: FetchFactory, params: { id: string }, body?: object) {
  const url = `/api/folders/${params.id}`
  return ff.call<any>('PATCH', url, body)
}

/**
 * GET /api/folders/count
 * Source: /Users/Bodda/cleverAI/server/api/folders/count.get.ts
 */
export async function getFoldersCount(ff: FetchFactory, params: void) {
  const url = '/api/folders/count'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/form-sync
 * Source: /Users/Bodda/cleverAI/server/api/form-sync.post.ts
 */
export async function postFormSync(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/form-sync'
  return ff.call<any>('POST', url, body)
}

/**
 * GET /api/llm-usage
 * Source: /Users/Bodda/cleverAI/server/api/llm-usage.get.ts
 */
export async function getLlmUsage(ff: FetchFactory, params: void) {
  const url = '/api/llm-usage'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/llm.generate
 * Source: /Users/Bodda/cleverAI/server/api/llm.generate.post.ts
 */
export async function postLlmGenerate(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/llm.generate'
  return ff.call<any>('POST', url, body)
}

/**
 * DELETE /api/materials
 * Source: /Users/Bodda/cleverAI/server/api/materials/index.delete.ts
 */
export async function deleteMaterials(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/materials'
  return ff.call<any>('DELETE', url, body)
}

/**
 * GET /api/materials
 * Source: /Users/Bodda/cleverAI/server/api/materials/index.get.ts
 */
export async function getMaterials(ff: FetchFactory, params: void) {
  const url = '/api/materials'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/materials
 * Source: /Users/Bodda/cleverAI/server/api/materials/index.post.ts
 */
export async function postMaterials(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/materials'
  return ff.call<any>('POST', url, body)
}

/**
 * PATCH /api/materials/:id
 * Source: /Users/Bodda/cleverAI/server/api/materials/[id].patch.ts
 */
export async function patchMaterialsId(ff: FetchFactory, params: { id: string }, body?: object) {
  const url = `/api/materials/${params.id}`
  return ff.call<any>('PATCH', url, body)
}

/**
 * GET /api/monitoring/:...path
 * Source: /Users/Bodda/cleverAI/server/api/monitoring/[...path].ts
 */
export async function getMonitoringPath(ff: FetchFactory, params: void) {
  const url = '/api/monitoring/:...path'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/notifications/clear-cooldown
 * Source: /Users/Bodda/cleverAI/server/api/notifications/clear-cooldown.post.ts
 */
export async function postNotificationsClearCooldown(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/notifications/clear-cooldown'
  return ff.call<any>('POST', url, body)
}

/**
 * GET /api/notifications/cron/check-due-cards
 * Source: /Users/Bodda/cleverAI/server/api/notifications/cron/check-due-cards.get.ts
 */
export async function getNotificationsCronCheckDueCards(ff: FetchFactory, params: void) {
  const url = '/api/notifications/cron/check-due-cards'
  return ff.call<any>('GET', url)
}

/**
 * GET /api/notifications/debug-cron
 * Source: /Users/Bodda/cleverAI/server/api/notifications/debug-cron.get.ts
 */
export async function getNotificationsDebugCron(ff: FetchFactory, params: void) {
  const url = '/api/notifications/debug-cron'
  return ff.call<any>('GET', url)
}

/**
 * GET /api/notifications/preferences
 * Source: /Users/Bodda/cleverAI/server/api/notifications/preferences.ts
 */
export async function getNotificationsPreferences(ff: FetchFactory, params: void) {
  const url = '/api/notifications/preferences'
  return ff.call<any>('GET', url)
}

/**
 * GET /api/notifications/recent
 * Source: /Users/Bodda/cleverAI/server/api/notifications/recent.get.ts
 */
export async function getNotificationsRecent(ff: FetchFactory, params: void) {
  const url = '/api/notifications/recent'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/notifications/send
 * Source: /Users/Bodda/cleverAI/server/api/notifications/send.post.ts
 */
export async function postNotificationsSend(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/notifications/send'
  return ff.call<any>('POST', url, body)
}

/**
 * GET /api/notifications/subscribe
 * Source: /Users/Bodda/cleverAI/server/api/notifications/subscribe.ts
 */
export async function getNotificationsSubscribe(ff: FetchFactory, params: void) {
  const url = '/api/notifications/subscribe'
  return ff.call<any>('GET', url)
}

/**
 * GET /api/notifications/subscriptions
 * Source: /Users/Bodda/cleverAI/server/api/notifications/subscriptions.get.ts
 */
export async function getNotificationsSubscriptions(ff: FetchFactory, params: void) {
  const url = '/api/notifications/subscriptions'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/notifications/test
 * Source: /Users/Bodda/cleverAI/server/api/notifications/test.post.ts
 */
export async function postNotificationsTest(ff: FetchFactory, params: void, body?: object) {
  const url = '/api/notifications/test'
  return ff.call<any>('POST', url, body)
}

/**
 * GET /api/notifications/unsubscribe
 * Source: /Users/Bodda/cleverAI/server/api/notifications/unsubscribe.ts
 */
export async function getNotificationsUnsubscribe(ff: FetchFactory, params: void) {
  const url = '/api/notifications/unsubscribe'
  return ff.call<any>('GET', url)
}

/**
 * GET /api/review/analytics
 * Source: /Users/Bodda/cleverAI/server/api/review/analytics.get.ts
 */
export async function getReviewAnalytics(ff: FetchFactory, params: void) {
  const url = '/api/review/analytics'
  return ff.call<any>('GET', url)
}

/**
 * POST /api/review/enroll
 * Source: /Users/Bodda/cleverAI/server/api/review/enroll.post.ts
 */
export async function postReviewEnroll(ff: FetchFactory, params: void, body: z.infer<typeof EnrollCardRequestSchema>) {
  const url = '/api/review/enroll'
  return ff.call<z.infer<typeof EnrollCardResponseSchema>>('POST', url, body)
}

/**
 * GET /api/review/enrollment-status
 * Source: /Users/Bodda/cleverAI/server/api/review/enrollment-status.get.ts
 */
export async function getReviewEnrollmentStatus(ff: FetchFactory, params: void) {
  const url = '/api/review/enrollment-status'
  return ff.call<z.infer<typeof EnrollmentStatusResponseSchema>>('GET', url)
}

/**
 * POST /api/review/grade
 * Source: /Users/Bodda/cleverAI/server/api/review/grade.post.ts
 */
export async function postReviewGrade(ff: FetchFactory, params: void, body: z.infer<typeof GradeCardRequestSchema>) {
  const url = '/api/review/grade'
  return ff.call<z.infer<typeof GradeCardResponseSchema>>('POST', url, body)
}

/**
 * GET /api/review/queue
 * Source: /Users/Bodda/cleverAI/server/api/review/queue.get.ts
 */
export async function getReviewQueue(ff: FetchFactory, params: void) {
  const url = '/api/review/queue'
  return ff.call<z.infer<typeof ReviewQueueResponseSchema>>('GET', url)
}

/**
 * GET /api/user/llm-usage
 * Source: /Users/Bodda/cleverAI/server/api/user/llm-usage.get.ts
 */
export async function getUserLlmUsage(ff: FetchFactory, params: void) {
  const url = '/api/user/llm-usage'
  return ff.call<any>('GET', url)
}

/**
 * GET /api/user/profile
 * Source: /Users/Bodda/cleverAI/server/api/user/profile.get.ts
 */
export async function getUserProfile(ff: FetchFactory, params: void) {
  const url = '/api/user/profile'
  return ff.call<any>('GET', url)
}

