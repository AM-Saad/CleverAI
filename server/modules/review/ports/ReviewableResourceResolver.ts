export type ReviewableResourceType = "material" | "flashcard" | "question";

export interface ResolvedReviewableResource {
  resourceType: ReviewableResourceType;
  resourceId: string;
  workspaceId: string;
}

export interface ReviewableResourceResolver {
  resolve(input: {
    userId: string;
    resourceType: ReviewableResourceType;
    resourceId: string;
  }): Promise<ResolvedReviewableResource | null>;
}
