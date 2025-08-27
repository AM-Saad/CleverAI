import { requireRole } from '~/../server/middleware/auth'
import { ErrorFactory, ErrorType } from '~/services/ErrorFactory'
import { LLM_MODELS } from '~~/shared/llm'
import { z } from 'zod'
import { UpdateFolderDTO, FolderSchema } from '~~/shared/folder.contract'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  try {
    const raw = await readBody(event)

    // Validate request: require id + allow only fields from UpdateFolderDTO
    const ParsedUpdateDTO = UpdateFolderDTO.extend({ id: z.string() })
    const parsed = ParsedUpdateDTO.safeParse(raw)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
    }
    const body = parsed.data
    // Ensure folder belongs to the current user
    const existing = await prisma.folder.findFirst({
      where: { id: body.id, userId: user.id },
    })
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
    }

    // Build update payload from allowed fields only
    const data: Record<string, any> = {}
    if (typeof body.title === 'string') data.title = body.title
    if (typeof body.description === 'string' || body.description === null) data.description = body.description ?? null
    if (typeof body.rawText === 'string' || body.rawText === null) data.rawText = body.rawText ?? null
    if (typeof body.order === 'number') data.order = body.order
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      data.metadata = body.metadata
    }
    if (typeof body.llmModel === 'string') {
      if (!LLM_MODELS.includes(body.llmModel as any)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid llmModel: ${body.llmModel}` })
      }
      data.llmModel = body.llmModel
    }

    if (Object.keys(data).length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
    }

    const updated = await prisma.folder.update({
      where: { id: body.id },
      data,
    })

    // Optional: assert response shape in development
    if (process.env.NODE_ENV === 'development') {
      FolderSchema.parse(updated)
    }
    return updated
  } catch (error) {
    console.error('Error updating folder:', error)
    throw ErrorFactory.create(
      ErrorType.Validation,
      'Folders',
      'Failed to update folder',
    )
  }
})
