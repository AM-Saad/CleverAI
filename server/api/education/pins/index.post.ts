import { requireRole } from '~/../server/middleware/auth'

function generatePin(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { lessonId, count = 1, assignToStudentId, expiresAt } = body
  if (assignToStudentId && count !== 1) {
    setResponseStatus(event, 400)
    return { error: 'When assigning to a student, only one PIN can be created at a time.' }
  }
  if (!assignToStudentId && count < 1) {
    setResponseStatus(event, 400)
    return { error: 'Count must be at least 1.' }
  }
  const pins = []
  for (let i = 0; i < count; i++) {
    let pin
    let exists = true
    while (exists) {
      pin = generatePin()
      exists = !!(await prisma.pinCode.findUnique({ where: { code: pin } }))
    }
    pins.push(pin)
  }
  const createdPins = await prisma.$transaction(
    pins.map((code) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {
        code,
        studentId: assignToStudentId ?? null,
        createdById: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }
      if (lessonId) data.lessonId = lessonId
      return prisma.pinCode.create({ data })
    })
  )
  setResponseStatus(event, 201)
  return createdPins
})
