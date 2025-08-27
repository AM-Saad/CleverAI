import { requireRole } from '~/../server/middleware/auth'

const MAX_FAILED_ATTEMPTS = 5

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['STUDENT'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { code, lessonId } = body
  if (!code) {
    setResponseStatus(event, 400)
    return { error: 'PIN code is required.' }
  }
  const pin = await prisma.pinCode.findUnique({ where: { code } })
  if (!pin) {
    setResponseStatus(event, 404)
    return { error: 'Invalid PIN code.' }
  }
  if (pin.locked) {
    setResponseStatus(event, 423)
    return { error: 'This PIN has been locked due to too many failed attempts or revoked by the teacher.' }
  }
  if (pin.used) {
    setResponseStatus(event, 409)
    return { error: 'PIN code has already been used.' }
  }
  if (pin.expiresAt && new Date(pin.expiresAt) < new Date()) {
    setResponseStatus(event, 410)
    return { error: 'PIN code has expired.' }
  }
  const targetLessonId = pin.lessonId || lessonId
  if (!targetLessonId) {
    setResponseStatus(event, 400)
    return { error: 'Lesson to unlock must be specified for universal PINs.' }
  }
  const existingUsedPin = await prisma.pinCode.findFirst({
    where: {
      lessonId: targetLessonId,
      studentId: user.id,
      used: true,
    },
  })
  if (existingUsedPin) {
    setResponseStatus(event, 409)
    return { error: 'You have already unlocked this lesson with another PIN.' }
  }
  if (pin.lessonId && lessonId && pin.lessonId !== lessonId) {
    await prisma.pinCode.update({
      where: { code },
      data: {
        failedAttempts: { increment: 1 },
        locked: pin.failedAttempts + 1 >= MAX_FAILED_ATTEMPTS,
      },
    })
    setResponseStatus(event, 403)
    return { error: 'This PIN is not valid for this lesson.' }
  }
  if (pin.studentId && pin.studentId !== user.id) {
    await prisma.pinCode.update({
      where: { code },
      data: {
        failedAttempts: { increment: 1 },
        locked: pin.failedAttempts + 1 >= MAX_FAILED_ATTEMPTS,
      },
    })
    setResponseStatus(event, 403)
    return { error: 'This PIN is not assigned to you.' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    used: true,
    usedAt: new Date(),
    failedAttempts: 0,
    locked: false,
    lessonId: pin.lessonId || lessonId,
  }
  if (!pin.studentId) {
    updateData.studentId = user.id
  }
  await prisma.pinCode.update({
    where: { code },
    data: updateData,
  })
  return { message: 'Lesson unlocked successfully.', lessonId: targetLessonId }
})
