import { requireRole } from '~/../server/middleware/auth'
import { ErrorFactory, ErrorType } from '~/services/ErrorFactory'
import { MaterialSchema } from '~~/shared/material.contract'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  try {
    const query = getQuery(event)
    const folderId = query.folderId as string

    if (!folderId) {
      throw createError({ statusCode: 400, statusMessage: 'folderId query parameter is required' })
    }

    // Verify folder belongs to user
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id }
    })
    if (!folder) {
      throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
    }

    // Get materials for folder
    const materials = await prisma.material.findMany({
      where: { folderId },
      orderBy: { createdAt: 'desc' }
    })

    // Optional: assert response shape in development
    if (process.env.NODE_ENV === 'development') {
      materials.forEach(material => MaterialSchema.parse(material))
    }

    return materials
  } catch (error) {
    console.error('Error fetching materials:', error)
    throw ErrorFactory.create(
      ErrorType.Validation,
      'Materials',
      'Failed to fetch materials'
    )
  }
})
