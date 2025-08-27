import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { id } = body
  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'Exam id is required.' }
  }
  await prisma.exam.delete({ where: { id } })
  return { message: 'Exam deleted.' }
})
