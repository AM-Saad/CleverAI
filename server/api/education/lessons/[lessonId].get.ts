import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER', 'STUDENT'])
  const prisma = event.context.prisma
  const lessonId = getRouterParam(event, 'lessonId')
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'lessonId is required.' }
  }
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })
  if (!lesson) {
    setResponseStatus(event, 404)
    return { error: 'Lesson not found.' }
  }
  // Teacher: can access their own lessons
  if (user.role === 'TEACHER' && lesson.teacherId === user.id) {
    return lesson
  }
  // Student: enforce sequential access (allow going backwards)
  if (user.role === 'STUDENT') {
    const unlockedLessons = await prisma.lessonUnlock.findMany({
      where: { studentId: user.id },
      include: { lesson: true },
      orderBy: { lesson: { order: 'asc' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unlockedOrders = unlockedLessons.map((lu: any) => lu.lesson.order)
    if (unlockedOrders.length === 0) {
      await createLessonUnlock(prisma, user, lessonId, user.studentType, null)
      return lesson
    }
    const maxUnlockedOrder = Math.max(...unlockedOrders)
    if (unlockedOrders.includes(lesson.order)) {
      return lesson
    }
    if (lesson.order <= maxUnlockedOrder + 1) {
      await createLessonUnlock(prisma, user, lessonId, user.studentType, null)
      return lesson
    }
    setResponseStatus(event, 403)
    return { error: 'You must finish previous lessons before accessing this one.' }
  }
  setResponseStatus(event, 403)
  return { error: 'Not authorized.' }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
async function createLessonUnlock(prisma: any, user: any, lessonId: string, studentType: string, pinCodeId: string | null): Promise<void> {
  await prisma.lessonUnlock.create({
    data: {
      studentId: user.id,
      lessonId,
      method: studentType === 'IN_HOUSE' ? 'IN_HOUSE' : 'OPEN',
      pinCodeId,
    },
  })
}
