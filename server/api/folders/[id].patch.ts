import { requireRole } from '~/../server/middleware/auth'
import { ErrorFactory, ErrorType } from '~/services/ErrorFactory'
import { LLM_MODELS } from '~~/shared/llm'
import { z } from 'zod'
import { UpdateFolderDTO, FolderSchema } from '~~/shared/folder.contract'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma
  const id = getRouterParam(event, 'id')

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
      where: { id: id, userId: user.id },
    })
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
    }

    // Build update payload from allowed fields only
    const folderData: Record<string, unknown> = {}
    if (typeof body.title === 'string') folderData.title = body.title
    if (typeof body.description === 'string' || body.description === null) folderData.description = body.description ?? null
    if (typeof body.order === 'number') folderData.order = body.order
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      folderData.metadata = body.metadata
    }
    if (typeof body.llmModel === 'string') {
      if (!LLM_MODELS.includes(body.llmModel as typeof LLM_MODELS[number])) {
        throw createError({ statusCode: 400, statusMessage: `Invalid llmModel: ${body.llmModel}` })
      }
      folderData.llmModel = body.llmModel
    }

    // Handle legacy rawText (deprecated but still supported)
    if (typeof body.rawText === 'string' || body.rawText === null) {
      folderData.rawText = body.rawText ?? null
    }

    // Handle material content (new preferred approach)
    let materialCreated = false
    if (body.materialContent) {
      const materialData = {
        folderId: id!,
        title: body.materialTitle || 'Folder Content',
        content: body.materialContent,
        type: body.materialType || 'text',
        llmModel: body.llmModel || existing.llmModel,
      }

      // Create or update material for this folder
      const existingMaterial = await prisma.material.findFirst({
        where: { folderId: id, title: materialData.title }
      })

      if (existingMaterial) {
        await prisma.material.update({
          where: { id: existingMaterial.id },
          data: {
            content: materialData.content,
            type: materialData.type,
            llmModel: materialData.llmModel,
          }
        })
      } else {
        await prisma.material.create({
          data: materialData
        })
      }
      materialCreated = true
    }    // Update folder if there are changes
    let updated = existing
    if (Object.keys(folderData).length > 0) {
      updated = await prisma.folder.update({
        where: { id: id },
        data: folderData,
        include: {
          materials: true,
          flashcards: true,
          questions: true,
        }
      })
    } else if (materialCreated) {
      // Fetch updated folder with materials if only material was created
      const freshFolder = await prisma.folder.findUnique({
        where: { id: id },
        include: {
          materials: true,
          flashcards: true,
          questions: true,
        }
      })
      if (freshFolder) {
        updated = freshFolder
      }
    } else {
      // Even if no changes, ensure we return folder with all relations
      const freshFolder = await prisma.folder.findUnique({
        where: { id: id },
        include: {
          materials: true,
          flashcards: true,
          questions: true,
        }
      })
      if (freshFolder) {
        updated = freshFolder
      }
    }

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
