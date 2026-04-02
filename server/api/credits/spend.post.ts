// server/api/credits/spend.post.ts
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const ok = await spendCredit(user.id)
  if (!ok) {
    throw createError({ statusCode: 402, message: 'Insufficient credits' })
  }
  return { ok }
})
