import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { id, type, text, options, correctAnswer } = body
  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'Question id is required.' }
  }
  const question = await prisma.question.update({
    where: { id },
    data: { type, text, options, correctAnswer },
  })
  return question
})
