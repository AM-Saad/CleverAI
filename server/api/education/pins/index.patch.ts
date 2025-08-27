import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { pinIds, action } = body
  if (!Array.isArray(pinIds) || pinIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'pinIds array is required.' }
  }
  if (action === 'revoke') {
    const result = await prisma.pinCode.updateMany({
      where: { id: { in: pinIds }, used: false },
      data: { locked: true },
    })
    return { revoked: result.count }
  } else {
    const result = await prisma.pinCode.updateMany({
      where: { id: { in: pinIds } },
      data: { printed: true },
    })
    return { updated: result.count }
  }
})
