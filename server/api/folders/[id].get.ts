
import { requireRole } from "~/../server/middleware/auth"

export default defineEventHandler(async (event) => {
    const user = await requireRole(event, ["USER"])
    const prisma = event.context.prisma
  const id = getRouterParam(event, 'id')

    console.log("🔥 Fetching folder with ID:", id)
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Folder ID is required' })
    }

const folder = await prisma.folder.findFirst({
  where: { id, userId: user.id },
  include: {
    materials: true,
    flashcards: true,
    questions: true,
  },
})
if (!folder) {
  throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
}
return folder
})
