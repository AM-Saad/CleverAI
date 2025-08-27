export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma
  const lessonId = getRouterParam(event, 'lessonId')
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'Missing lessonId' }
  }
  // Get all students who started the video (any event)
  const started = await prisma.videoWatchEvent.findMany({
    where: { lessonId },
    select: { studentId: true },
    distinct: ['studentId'],
  })
  const totalStarted = started.length
  // Get all students who completed the video
  const completed = await prisma.videoWatchEvent.findMany({
    where: { lessonId, event: 'complete' },
    select: { studentId: true },
    distinct: ['studentId'],
  })
  const totalCompleted = completed.length
  const completionRate = totalStarted === 0 ? 0 : totalCompleted / totalStarted
  return { completionRate }
})
