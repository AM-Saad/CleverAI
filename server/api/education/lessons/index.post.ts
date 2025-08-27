import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { title, chapterId, explanationVideoUrl, solutionVideoUrl, unlockWindowDays, order, chapterOrder } = body
  if (!title || !chapterId || !explanationVideoUrl || typeof order !== 'number') {
    setResponseStatus(event, 400)
    return { error: 'Title, chapterId, explanationVideoUrl, and order are required.' }
  }
  // Check for unique global order
  const existing = await prisma.lesson.findUnique({ where: { order } })
  if (existing) {
    setResponseStatus(event, 409)
    return { error: 'Lesson global order must be unique.' }
  }
  // Optionally check for unique chapterOrder within chapter
  if (typeof chapterOrder === 'number') {
    const chapterOrderExists = await prisma.lesson.findFirst({ where: { chapterId, chapterOrder } })
    if (chapterOrderExists) {
      setResponseStatus(event, 409)
      return { error: 'Lesson chapterOrder must be unique within the chapter.' }
    }
  }
  const lesson = await prisma.lesson.create({
    data: {
      title,
      chapterId,
      explanationVideoUrl,
      solutionVideoUrl,
      unlockWindowDays: unlockWindowDays || 7,
      order,
      chapterOrder: typeof chapterOrder === 'number' ? chapterOrder : null,
      teacherId: user.id,
    },
  })
  setResponseStatus(event, 201)
  return lesson
})
