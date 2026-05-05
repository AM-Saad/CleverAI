import { requireAuth } from "../../utils/auth";
import { getCreditBalance } from "../../modules/subscription/application/creditLedger";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const user = await requireAuth(event)
  const balance = await getCreditBalance({ prisma, userId: user.id })
  return { balance }
})
