import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['STUDENT'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { lessonId, videoType, event: eventType, position, duration } = body
  if (!lessonId || !videoType || !eventType || typeof position !== 'number') {
    setResponseStatus(event, 400)
    return { error: 'Missing required fields' }
  }
  try {
    const videoEvent = await prisma.videoWatchEvent.create({
      data: {
        studentId: user.id,
        lessonId,
        videoType,
        event: eventType,
        position,
        duration: duration ?? null,
      },
    })
    return { success: true, videoEvent }
  } catch (error) {
    setResponseStatus(event, 500)
    return { error: 'Failed to record event', details: error }
  }
})
