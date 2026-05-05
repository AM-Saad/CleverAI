import type {
  ResolvedReviewableResource,
  ReviewableResourceResolver,
  ReviewableResourceType,
} from "../ports/ReviewableResourceResolver";

export class PrismaReviewableResourceResolver
  implements ReviewableResourceResolver
{
  constructor(private readonly prisma: any) {}

  async resolve(input: {
    userId: string;
    resourceType: ReviewableResourceType;
    resourceId: string;
  }): Promise<ResolvedReviewableResource | null> {
    if (input.resourceType === "material") {
      const material = await this.prisma.material.findFirst({
        where: { id: input.resourceId, workspace: { userId: input.userId } },
        select: { id: true, workspaceId: true },
      });
      return material
        ? {
            resourceType: input.resourceType,
            resourceId: material.id,
            workspaceId: material.workspaceId,
          }
        : null;
    }

    if (input.resourceType === "flashcard") {
      const flashcard = await this.prisma.flashcard.findFirst({
        where: { id: input.resourceId, workspace: { userId: input.userId } },
        select: { id: true, workspaceId: true },
      });
      return flashcard
        ? {
            resourceType: input.resourceType,
            resourceId: flashcard.id,
            workspaceId: flashcard.workspaceId,
          }
        : null;
    }

    const question = await this.prisma.question.findFirst({
      where: { id: input.resourceId, workspace: { userId: input.userId } },
      select: { id: true, workspaceId: true },
    });

    return question
      ? {
          resourceType: input.resourceType,
          resourceId: question.id,
          workspaceId: question.workspaceId,
        }
      : null;
  }
}
