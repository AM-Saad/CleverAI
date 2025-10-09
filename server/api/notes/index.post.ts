import { requireRole } from '~/../server/middleware/auth'
import { CreateNoteDTO, NoteSchema } from '~~/shared/note.contract'
import { Errors, success } from '~~/server/utils/error'
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  const body = await readBody(event)
  let data
  try {
    data = CreateNoteDTO.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest('Invalid request body', err.issues.map(i => ({ path: i.path, message: i.message })))
    }
    throw Errors.badRequest('Invalid request body')
  }

  const folder = await prisma.folder.findFirst({ where: { id: data.folderId, userId: user.id } })
  if (!folder) {
    throw Errors.notFound('Folder')
  }

  const note = await prisma.note.create({
    data: {
      folderId: data.folderId,
      content: data.content,
    }
  })

  if (process.env.NODE_ENV === 'development') {
    NoteSchema.parse(note)
  }

  return success(note, { message: 'Note created successfully', noteId: note.id, folderId: data.folderId })
})
