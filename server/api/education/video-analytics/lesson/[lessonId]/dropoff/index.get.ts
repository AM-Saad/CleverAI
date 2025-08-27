const BUCKET_SIZE = 10 // seconds

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma
  const lessonId = getRouterParam(event, 'lessonId')
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'Missing lessonId' }
  }
  // Get all pause and seek events for this lesson
  const events = await prisma.videoWatchEvent.findMany({
    where: { lessonId, event: { in: ['pause', 'seek'] } },
    select: { studentId: true, position: true },
    orderBy: { createdAt: 'asc' },
  })
  // Map studentId to their last event position
  const lastPositions = new Map<string, number>()
  for (const e of events) {
    lastPositions.set(e.studentId, e.position)
  }
  // Aggregate last positions into buckets
  const bucketCounts: Record<number, number> = {}
  for (const pos of lastPositions.values()) {
    const bucket = Math.floor(pos / BUCKET_SIZE) * BUCKET_SIZE
    bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1
  }
  // Format as array sorted by position
  const dropoffPoints = Object.entries(bucketCounts)
    .map(([position, count]) => ({ position: Number(position), count }))
    .sort((a, b) => a.position - b.position)
  return { dropoffPoints }
})
