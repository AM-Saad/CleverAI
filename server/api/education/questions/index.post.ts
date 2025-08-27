import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { examId, type, text, options, correctAnswer } = body
  if (!examId || !type || !text) {
    setResponseStatus(event, 400)
    return { error: 'examId, type, and text are required.' }
  }
  const question = await prisma.question.create({
    data: {
      examId,
      type,
      text,
      options: options || [],
      correctAnswer: correctAnswer || null,
    },
  })
  setResponseStatus(event, 201)
  return question
})
