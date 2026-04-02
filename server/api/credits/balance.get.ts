// server/api/credits/balance.get.ts
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const balance = await getCreditBalance(user.id)
  return { balance }
})
