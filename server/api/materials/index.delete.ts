import { requireRole } from '~/../server/middleware/auth'
import { ErrorFactory, ErrorType } from '~/services/ErrorFactory'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  try {
    const body = await readBody(event)

    // Validate request body
    const schema = z.object({ id: z.string() })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
    }
    const { id } = parsed.data

    // Verify material exists and user owns the folder
    const material = await prisma.material.findFirst({
      where: {
        id,
        folder: { userId: user.id }
      }
    })
    if (!material) {
      throw createError({ statusCode: 404, statusMessage: 'Material not found' })
    }

    // Delete material
    await prisma.material.delete({
      where: { id }
    })

    return { success: true, message: 'Material deleted successfully' }
  } catch (error) {
    console.error('Error deleting material:', error)
    throw ErrorFactory.create(
      ErrorType.Validation,
      'Materials',
      'Failed to delete material'
    )
  }
})
