import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const lessonId = getQuery(event).lessonId as string | undefined
  const where = lessonId ? { lessonId } : {}
  const exams = await prisma.exam.findMany({ where })
  return exams
})
