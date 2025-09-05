import { requireRole } from '~/../server/middleware/auth'

function isTimedOut(attempt: any, exam: any) {
  if (!exam.timed || !exam.duration) return false;
  const started = new Date(attempt.startedAt).getTime();
  const now = Date.now();
  return now > started + exam.duration * 60 * 1000;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoSubmitExamAttempt(prisma: any, attempt: any, exam: any, timedOut: boolean): Promise<void> {
  const questions = await prisma.question.findMany({ where: { examId: attempt.examId } });
  const answers = attempt.answers || {};
  let score = 0;
  for (const q of questions as any[]) {
    if (q.type === 'MULTIPLE_CHOICE' && answers[q.id] && q.correctAnswer && answers[q.id] === q.correctAnswer) {
      score++;
    }
  }
  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      status: timedOut ? 'timed_out' : 'submitted',
      submittedAt: new Date(),
      score,
      timedOut,
    },
  });
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['STUDENT'])
  const prisma = event.context.prisma
  const body = await readBody(event)
  const { attemptId } = body
  if (!attemptId) {
    setResponseStatus(event, 400)
    return { error: 'attemptId is required.' }
  }
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } })
  if (!attempt || attempt.studentId !== user.id) {
    setResponseStatus(event, 403)
    return { error: 'Not authorized.' }
  }
  if (attempt.status !== 'in_progress') {
    setResponseStatus(event, 409)
    return { error: 'Exam is not in progress.' }
  }
  const exam = await prisma.exam.findUnique({ where: { id: attempt.examId } })
  if (isTimedOut(attempt, exam)) {
    await autoSubmitExamAttempt(prisma, attempt, exam, true)
    setResponseStatus(event, 410)
    return { error: 'Time is up. Exam auto-submitted.' }
  }
  await autoSubmitExamAttempt(prisma, attempt, exam, false)
  return { message: 'Exam submitted.' }
})
