import { spendCredit } from "../../modules/subscription/application/creditLedger";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const user = await requireAuth(event)
  const ok = await spendCredit({ prisma, userId: user.id })
  if (!ok) {
    throw createError({ statusCode: 402, message: 'Insufficient credits' })
  }
  return { ok }
})
