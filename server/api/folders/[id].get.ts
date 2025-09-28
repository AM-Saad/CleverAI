import { requireRole } from "~/../server/middleware/auth"
import { Errors, success } from '~~/server/utils/error'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]) // throws if unauthorized
  const prisma = event.context.prisma
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw Errors.badRequest('Folder ID is required')
  }

  const folder = await prisma.folder.findFirst({
    where: { id, userId: user.id },
    include: { materials: true, flashcards: true, questions: true },
  })
  if (!folder) {
    throw Errors.notFound('Folder')
  }
  return success(folder)
})
