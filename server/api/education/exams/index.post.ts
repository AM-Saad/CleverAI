import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { lessonId, timed, duration } = body
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'lessonId is required.' }
  }
  const exam = await prisma.exam.create({
    data: {
      lessonId,
      timed: !!timed,
      duration: timed ? duration : null,
    },
  })
  setResponseStatus(event, 201)
  return exam
})
