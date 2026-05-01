import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const now = new Date();

  const [total, due, mastered] = await Promise.all([
    prisma.languageCardReview.count({
      where: { userId: user.id, suspended: false },
    }),
    prisma.languageCardReview.count({
      where: { userId: user.id, suspended: false, nextReviewAt: { lte: now } },
    }),
    prisma.languageWord.count({
      where: { userId: user.id, status: "mastered" },
    }),
  ]);

  const enrolled = await prisma.languageWord.count({
    where: { userId: user.id, status: { in: ["enrolled", "mastered"] } },
  });

  return success({ total, due, enrolled, mastered });
});
