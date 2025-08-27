import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER', 'STUDENT'])
  const prisma = event.context.prisma
  const chapterId = getQuery(event).chapterId as string | undefined

  if (user.role === 'TEACHER' && !chapterId) {
    const lessons = await prisma.lesson.findMany({ orderBy: { order: 'asc' } })
    return lessons
  }
  if (!chapterId) {
    setResponseStatus(event, 400)
    return { error: 'chapterId is required.' }
  }
  let lessons
  if (user.role === 'TEACHER') {
    lessons = await prisma.lesson.findMany({
      where: { chapterId, teacherId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return lessons
  } else {
    lessons = await prisma.lesson.findMany({
      where: { chapterId },
      orderBy: { createdAt: 'desc' },
    })
    if (user.studentType === 'IN_HOUSE') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return lessons.map((lesson: any) => ({ ...lesson, unlocked: true }))
    } else {
      const unlockedLessonIds = (await prisma.pinCode.findMany({
        where: { studentId: user.id, used: true },
        select: { lessonId: true },
      })).map((pin: any) => pin.lessonId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return lessons.map((lesson: any) => ({
        ...lesson,
        unlocked: unlockedLessonIds.includes(lesson.id),
      }))
    }
  }
})
