import { requireRole } from '~/../server/middleware/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER', 'STUDENT'])
  const prisma = event.context.prisma
  const query = getQuery(event)
  const studentId = query.studentId as string | undefined
  const examId = query.examId as string | undefined
  const analytics = query.analytics === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: any = {}
  if (user.role === 'STUDENT') {
    where.studentId = user.id
  } else {
    if (studentId) where.studentId = studentId
    if (examId) where.examId = examId
  }

  const attempts = await prisma.examAttempt.findMany({
    where,
    include: {
      exam: { include: { lesson: true } },
      student: { select: { id: true, name: true, phone: true, grade: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  if (!analytics) {
    return attempts
  }

  // Analytics summary
  const scores = attempts.map((a: any) => a.score ?? 0)
  const total = attempts.length
  const average = total ? scores.reduce((a: number, b: number) => a + b, 0) / total : 0
  const best = total ? Math.max(...scores) : null
  const worst = total ? Math.min(...scores) : null

  return {
    total,
    average,
    best,
    worst,
    attempts,
  }
})
