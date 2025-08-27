const BUCKET_SIZE = 10 // seconds

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma
  const lessonId = getRouterParam(event, 'lessonId')
  if (!lessonId) {
    setResponseStatus(event, 400)
    return { error: 'Missing lessonId' }
  }
  // Fetch all play, seek, and pause events for this lesson
  const events = await prisma.videoWatchEvent.findMany({
    where: {
      lessonId,
      event: { in: ['play', 'seek', 'pause'] },
    },
    select: { position: true },
  })
  // Find max position to determine number of buckets
  const maxPosition = events.reduce((max: number, e: { position: number }) => Math.max(max, e.position), 0)
  const numBuckets = Math.ceil((maxPosition + 1) / BUCKET_SIZE)
  const buckets = Array.from({ length: numBuckets }, (_, i) => ({
    start: i * BUCKET_SIZE,
    end: (i + 1) * BUCKET_SIZE,
    views: 0,
  }))
  // Count events per bucket
  for (const e of events) {
    const bucketIdx = Math.floor(e.position / BUCKET_SIZE)
    if (buckets[bucketIdx]) {
      buckets[bucketIdx].views++
    }
  }
  return { buckets }
})
