import { requireRole } from '~/../server/middleware/auth'
import { ErrorFactory, ErrorType } from '~/services/ErrorFactory'
import { UpdateMaterialDTO, MaterialSchema } from '~~/shared/material.contract'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  try {
    const body = await readBody(event)

    // Validate request: require id + allow only fields from UpdateMaterialDTO
    const ParsedUpdateDTO = UpdateMaterialDTO.extend({ id: z.string() })
    const parsed = ParsedUpdateDTO.safeParse(body)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
    }
    const data = parsed.data

    // Verify material exists and user owns the folder
    const material = await prisma.material.findFirst({
      where: {
        id: data.id,
        folder: { userId: user.id }
      }
    })
    if (!material) {
      throw createError({ statusCode: 404, statusMessage: 'Material not found' })
    }

    // Build update payload from allowed fields only
    const updateData: Record<string, unknown> = {}
    if (typeof data.title === 'string') updateData.title = data.title
    if (typeof data.content === 'string') updateData.content = data.content
    if (typeof data.type === 'string') updateData.type = data.type
    if (typeof data.llmModel === 'string') updateData.llmModel = data.llmModel
    if (typeof data.llmPrompt === 'string' || data.llmPrompt === null) {
      updateData.llmPrompt = data.llmPrompt
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null
    }

    if (Object.keys(updateData).length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
    }

    // Update material
    const updated = await prisma.material.update({
      where: { id: data.id },
      data: updateData
    })

    // Optional: assert response shape in development
    if (process.env.NODE_ENV === 'development') {
      MaterialSchema.parse(updated)
    }

    return updated
  } catch (error) {
    console.error('Error updating material:', error)
    throw ErrorFactory.create(
      ErrorType.Validation,
      'Materials',
      'Failed to update material'
    )
  }
})
