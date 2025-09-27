import { requireRole } from '~/../server/middleware/auth'
import { CreateMaterialDTO, MaterialSchema } from '~~/shared/material.contract'
import { ResponseBuilder } from '../../utils/standardAPIResponse'
import { ErrorFactory, getErrorContextFromEvent } from '../../utils/standardErrorHandler'
import { validateBody } from '../../utils/validationHandler'

export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)

  // Authenticate user
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  // Validate request body
  const body = await readBody(event)
  const data = await validateBody({ body }, CreateMaterialDTO)

  // Verify folder ownership
  const folder = await prisma.folder.findFirst({
    where: { id: data.folderId, userId: user.id }
  })

  if (!folder) {
    throw ErrorFactory.notFound('folder', {
      ...context,
      resource: `folder:${data.folderId}`,
      metadata: { folderId: data.folderId, userId: user.id }
    })
  }

  // Create material
  const material = await prisma.material.create({
    data: {
      folderId: data.folderId,
      title: data.title,
      content: data.content,
      type: data.type,
      llmModel: data.llmModel,
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
    }
  })

  // Validate response shape in development
  if (process.env.NODE_ENV === 'development') {
    MaterialSchema.parse(material)
  }

  return new ResponseBuilder()
    .data(material)
    .context({
      message: 'Material created successfully',
      materialId: material.id,
      folderId: data.folderId
    })
    .success()
})
