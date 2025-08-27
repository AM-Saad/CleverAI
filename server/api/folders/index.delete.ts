import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { id } = body
  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'Folder id is required.' }
  }
  // Only allow deleting folders owned by the user
  const result = await prisma.folder.deleteMany({
    where: { id, userId: user.id },
  })
  if (result.count === 0) {
    setResponseStatus(event, 404)
    return { error: 'Folder not found or not authorized.' }
  }
  return { success: true }
})
