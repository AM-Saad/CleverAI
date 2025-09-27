import { z } from 'zod'
import { requireRole } from '~/../server/middleware/auth'
import { MaterialSchema } from '~~/shared/material.contract'
import { ResponseBuilder } from '../../utils/standardAPIResponse'
import { ErrorFactory, getErrorContextFromEvent } from '../../utils/standardErrorHandler'
import { validateQuery } from '../../utils/validationHandler'

// Query validation schema
const QuerySchema = z.object({
  folderId: z.string().uuid('Folder ID must be a valid UUID')
})

export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)

  // Authenticate user
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  // Validate query parameters
  const query = await validateQuery({ query: getQuery(event) }, QuerySchema)

  // Verify folder ownership
  const folder = await prisma.folder.findFirst({
    where: { id: query.folderId, userId: user.id }
  })

  if (!folder) {
    throw ErrorFactory.notFound('folder', {
      ...context,
      resource: `folder:${query.folderId}`,
      metadata: { folderId: query.folderId, userId: user.id }
    })
  }

  // Get materials for folder
  const materials = await prisma.material.findMany({
    where: { folderId: query.folderId },
    orderBy: { createdAt: 'desc' }
  })

  // Validate response shape in development
  if (process.env.NODE_ENV === 'development') {
    materials.forEach(material => MaterialSchema.parse(material))
  }

  return new ResponseBuilder()
    .data(materials)
    .context({
      message: `Found ${materials.length} materials in folder`,
      folderId: query.folderId,
      count: materials.length
    })
    .success()
})
