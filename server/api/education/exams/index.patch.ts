import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { id, timed, duration } = body
  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'Exam id is required.' }
  }
  const exam = await prisma.exam.update({
    where: { id },
    data: { timed: !!timed, duration: timed ? duration : null },
  })
  return exam
})
