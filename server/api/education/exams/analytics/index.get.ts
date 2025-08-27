import { requireRole } from '~/../server/middleware/auth'

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['TEACHER', 'STUDENT'])
  const prisma = event.context.prisma
  const query = getQuery(event)
  const examId = query.examId as string | undefined
  const studentId = query.studentId as string | undefined
  const lessonId = query.lessonId as string | undefined
  const chapterId = query.chapterId as string | undefined
  const trend = query.trend === 'true'

  let examIds: string[] = []
  if (examId) {
    examIds = [examId]
  } else if (lessonId) {
    const exams = await prisma.exam.findMany({ where: { lessonId } })
    examIds = exams.map((e: any) => e.id)
  } else if (chapterId) {
    const lessons = await prisma.lesson.findMany({ where: { chapterId } })
    const lessonIds = lessons.map((l: any) => l.id)
    const exams = await prisma.exam.findMany({ where: { lessonId: { in: lessonIds } } })
    examIds = exams.map((e: any) => e.id)
  }
  if (!examIds.length) {
    setResponseStatus(event, 400)
    return { error: 'examId, lessonId, or chapterId is required.' }
  }
  // Get all attempts for these exams (optionally filter by student)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { examId: { in: examIds } }
  if (user.role === 'STUDENT') where.studentId = user.id
  if (user.role === 'TEACHER' && studentId) where.studentId = studentId
  const attempts = await prisma.examAttempt.findMany({ where })
  // Get all questions for these exams
  const questions = await prisma.question.findMany({ where: { examId: { in: examIds } } })
  // Aggregate stats
  const scores = attempts.map((a: any) => a.score ?? 0)
  const total = attempts.length
  const average = total ? scores.reduce((a: number, b: number) => a + b, 0) / total : 0
  const best = total ? Math.max(...scores) : null
  const worst = total ? Math.min(...scores) : null
  const passRate = total ? scores.filter((s: number) => s >= questions.length / 2).length / total : 0
  // Per-question stats
  const questionStats = questions.map((q: any) => {
    let correct = 0, totalAnswered = 0
    for (const a of attempts) {
      if (a.answers && a.answers[q.id] !== undefined) {
        totalAnswered++
        if (q.type === 'MULTIPLE_CHOICE' && q.correctAnswer && a.answers[q.id] === q.correctAnswer) {
          correct++
        }
      }
    }
    return {
      questionId: q.id,
      text: q.text,
      correct,
      totalAnswered,
      percentCorrect: totalAnswered ? correct / totalAnswered : 0,
    }
  })
  // Trends over time (by day)
  let trends: any[] = []
  if (trend) {
    const byDay: Record<string, number[]> = {}
    for (const a of attempts) {
      const day = formatDate(new Date(a.startedAt))
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(a.score ?? 0)
    }
    trends = Object.entries(byDay).map(([date, scores]) => ({
      date,
      averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      attempts: scores.length,
    }))
  }
  return {
    totalAttempts: total,
    averageScore: average,
    bestScore: best,
    worstScore: worst,
    passRate,
    questionStats,
    trends,
    attempts,
  }
})
