import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['STUDENT'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { examId } = body
  if (!examId) {
    setResponseStatus(event, 400)
    return { error: 'examId is required.' }
  }
  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { lesson: true } })
  if (!exam) {
    setResponseStatus(event, 404)
    return { error: 'Exam not found.' }
  }
  const lessonUnlock = await prisma.lessonUnlock.findFirst({ where: { studentId: user.id, lessonId: exam.lessonId } })
  if (!lessonUnlock) {
    setResponseStatus(event, 403)
    return { error: 'You have not unlocked this lesson.' }
  }
  const activeAttempt = await prisma.examAttempt.findFirst({ where: { studentId: user.id, examId, status: 'in_progress' } })
  if (activeAttempt) {
    setResponseStatus(event, 409)
    return { error: 'You already have an active attempt for this exam.', attemptId: activeAttempt.id }
  }
  const attempt = await prisma.examAttempt.create({
    data: {
      studentId: user.id,
      examId,
      answers: {},
      status: 'in_progress',
      startedAt: new Date(),
      timedOut: false,
    },
  })
  const questions = await prisma.question.findMany({ where: { examId }, orderBy: { createdAt: 'asc' } })
  return { attempt, question: questions[0], questionIndex: 0, totalQuestions: questions.length }
})
