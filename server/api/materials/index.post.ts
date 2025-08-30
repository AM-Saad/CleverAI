import { requireRole } from '~/../server/middleware/auth'
import { ErrorFactory, ErrorType } from '~/services/ErrorFactory'
import { CreateMaterialDTO, MaterialSchema } from '~~/shared/material.contract'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  try {
    const body = await readBody(event)

    // Validate request body
    const parsed = CreateMaterialDTO.safeParse(body)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
    }
    const data = parsed.data

    // Verify folder belongs to user
    const folder = await prisma.folder.findFirst({
      where: { id: data.folderId, userId: user.id }
    })
    if (!folder) {
      throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
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

    // Optional: assert response shape in development
    if (process.env.NODE_ENV === 'development') {
      MaterialSchema.parse(material)
    }

    return material
  } catch (error) {
    console.error('Error creating material:', error)
    throw ErrorFactory.create(
      ErrorType.Validation,
      'Materials',
      'Failed to create material'
    )
  }
})
