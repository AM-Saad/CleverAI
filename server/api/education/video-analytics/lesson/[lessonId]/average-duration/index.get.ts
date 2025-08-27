export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma
  const lessonId = getRouterParam(event, 'lessonId')
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'Missing lessonId' }
  }
  // Get all events with a duration for this lesson
  const events = await prisma.videoWatchEvent.findMany({
    where: { lessonId, duration: { not: null } },
    select: { studentId: true, duration: true },
  })
  // Sum total duration
  const totalDuration = events.reduce((sum: number, e: { duration: number | null }) => sum + (e.duration ?? 0), 0)
  // Get number of unique students who started the video
  const students = new Set(events.map((e: { studentId: string }) => e.studentId))
  const numStudents = students.size
  const averageDuration = numStudents === 0 ? 0 : totalDuration / numStudents
  return { averageDuration }
})
