import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const lessonId = getQuery(event).lessonId as string | undefined
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'lessonId is required.' }
  }
  const pins = await prisma.pinCode.findMany({
    where: { lessonId },
    orderBy: { createdAt: 'desc' },
  })
  return pins
})
