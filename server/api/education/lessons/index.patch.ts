import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { id, title, explanationVideoUrl, solutionVideoUrl, unlockWindowDays, order, chapterOrder } = body
  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'Lesson id is required.' }
  }
  if (typeof order !== 'undefined') {
    setResponseStatus(event, 400)
    return { error: 'Lesson order cannot be updated.' }
  }
  // Optionally check for unique chapterOrder within chapter if updating
  if (typeof chapterOrder === 'number') {
    const lessonToUpdate = await prisma.lesson.findUnique({ where: { id } })
    if (lessonToUpdate && lessonToUpdate.chapterOrder !== chapterOrder) {
      const chapterOrderExists = await prisma.lesson.findFirst({ where: { chapterId: lessonToUpdate.chapterId, chapterOrder } })
      if (chapterOrderExists) {
        setResponseStatus(event, 409)
        return { error: 'Lesson chapterOrder must be unique within the chapter.' }
      }
    }
  }
  // Only allow updating lessons owned by the teacher
  const lesson = await prisma.lesson.updateMany({
    where: { id, teacherId: user.id },
    data: { title, explanationVideoUrl, solutionVideoUrl, unlockWindowDays, chapterOrder: typeof chapterOrder === 'number' ? chapterOrder : undefined },
  })
  if (lesson.count === 0) {
    setResponseStatus(event, 404)
    return { error: 'Lesson not found or not authorized.' }
  }
  return { message: 'Lesson updated.' }
})
