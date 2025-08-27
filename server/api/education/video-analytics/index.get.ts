import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  // Get all lessons for this teacher
  const lessons = await prisma.lesson.findMany({
    where: { teacherId: user.id },
    select: { id: true, title: true }
  })
  const lessonIds = lessons.map((l: { id: string; title: string }) => l.id)
  // Aggregate minutes watched per lesson
  const videoWatches = await prisma.videoWatch.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { lessonId: true, studentId: true, minutesWatched: true }
  })
  // Group by lesson and student
  const analytics: Record<string, { lessonTitle: string; students: Record<string, number> }> = {}
  for (const lesson of lessons) {
    analytics[lesson.id] = { lessonTitle: lesson.title, students: {} }
  }
  for (const vw of videoWatches) {
    if (!analytics[vw.lessonId]) continue
    analytics[vw.lessonId].students[vw.studentId] = (analytics[vw.lessonId].students[vw.studentId] || 0) + vw.minutesWatched
  }
  return { analytics }
})
