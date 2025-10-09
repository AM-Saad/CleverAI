import { requireRole } from '~/../server/middleware/auth'
import { UpdateNoteDTO, NoteSchema } from '~~/shared/note.contract'
import { Errors, success } from '~~/server/utils/error'
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  const body = await readBody(event)
  let data
  try {
    data = UpdateNoteDTO.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest('Invalid request body', err.issues.map(i => ({ path: i.path, message: i.message })))
    }
    throw Errors.badRequest('Invalid request body')
  }

  const { id } = body
  if (!id || typeof id !== 'string') {
    throw Errors.badRequest('Note ID is required')
  }

  // Find the note and verify ownership through folder
  const note = await prisma.note.findFirst({
    where: {
      id,
      folder: { userId: user.id }
    }
  })

  if (!note) {
    throw Errors.notFound('Note')
  }

  const updatedNote = await prisma.note.update({
    where: { id },
    data: {
      content: data.content,
    }
  })

  if (process.env.NODE_ENV === 'development') {
    NoteSchema.parse(updatedNote)
  }

  return success(updatedNote, { message: 'Note updated successfully', noteId: updatedNote.id })
})
