import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { id } = body
  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'Lesson id is required.' }
  }
  // Only allow deleting lessons owned by the teacher
  const lesson = await prisma.lesson.deleteMany({
    where: { id, teacherId: user.id },
  })
  if (lesson.count === 0) {
    setResponseStatus(event, 404)
    return { error: 'Lesson not found or not authorized.' }
  }
  return { message: 'Lesson deleted.' }
})
