import { requireRole } from '~/../server/middleware/auth'
import { LLM_MODELS } from '~~/shared/llm'
import { CreateFolderDTO, FolderSchema } from '~~/shared/folder.contract'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  const body = await readBody(event)
  const parsed = CreateFolderDTO.safeParse(body)
  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { error: 'Invalid request body.' }
  }
  const { llmModel, metadata } = parsed.data
const title = parsed.data.title.trim()
const description = parsed.data.description?.trim() ?? null
  if (llmModel && !LLM_MODELS.includes(llmModel as any)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid LLM model.' }
  }

  // Compute next order for this user
  const maxOrder = await prisma.folder.aggregate({
    _max: { order: true },
    where: { userId: user.id },
  })
  const nextOrder = (maxOrder._max.order ?? 0) + 1

  const created = await prisma.folder.create({
    data: {
      title,
      description: description ?? null,
      llmModel: (llmModel as any) ?? 'gpt-3.5',
      metadata: metadata ?? null,
      order: nextOrder,
      user: { connect: { id: user.id } },
    },
  })

  // Optional: assert response shape in dev
  if (process.env.NODE_ENV === 'development') FolderSchema.parse(created)
  setResponseStatus(event, 201)
  return created
})
