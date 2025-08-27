import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const examId = getQuery(event).examId as string | undefined
  const where = examId ? { examId } : {}
  const questions = await prisma.question.findMany({ where })
  return questions
})
