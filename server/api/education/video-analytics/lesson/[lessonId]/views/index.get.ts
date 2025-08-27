import { startOfDay } from 'date-fns'

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma
  const lessonId = getRouterParam(event, 'lessonId')
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'Missing lessonId' }
  }
  // Get all events for this lesson
  const events = await prisma.videoWatchEvent.findMany({
    where: { lessonId },
    select: { studentId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  // Map studentId to set of days (approximate sessions by day)
  const studentDays = new Map<string, Set<string>>()
  for (const e of events) {
    const day = startOfDay(e.createdAt).toISOString()
    if (!studentDays.has(e.studentId)) {
      studentDays.set(e.studentId, new Set())
    }
    studentDays.get(e.studentId)!.add(day)
  }
  let firstViews = 0
  let repeatViews = 0
  for (const days of studentDays.values()) {
    if (days.size === 1) firstViews++
    else if (days.size > 1) repeatViews++
  }
  return { firstViews, repeatViews }
})
