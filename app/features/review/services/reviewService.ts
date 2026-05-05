import { z } from "zod";
import FetchFactory from "~/services/FetchFactory";
import type { Result } from "~/types/Result";
import {
  EnrollCardResponseSchema,
  GradeCardResponseSchema,
  ReviewQueueResponseSchema,
  ReviewSummaryStatsSchema,
} from "@shared/utils/review.contract";
import type {
  EnrollCardRequest,
  EnrollCardResponse,
  GradeCardRequest,
  GradeCardResponse,
  ReviewQueueResponse,
  ReviewSummaryStats,
} from "@shared/utils/review.contract";

const EnrollmentStatusResponseSchema = z.object({
  enrollments: z.record(z.string(), z.boolean()),
});
export type EnrollmentStatusResponse = z.infer<
  typeof EnrollmentStatusResponseSchema
>;

export class ReviewService extends FetchFactory {
  private readonly RESOURCE = "/api/review";

  async enroll(payload: EnrollCardRequest): Promise<Result<EnrollCardResponse>> {
    return this.call(
      "POST",
      `${this.RESOURCE}/enroll`,
      payload,
      {},
      EnrollCardResponseSchema,
    );
  }

  async grade(payload: GradeCardRequest): Promise<Result<GradeCardResponse>> {
    return this.call(
      "POST",
      `${this.RESOURCE}/grade`,
      payload,
      {},
      GradeCardResponseSchema,
    );
  }

  async getQueue(
    workspaceId?: string,
    limit: number = 20,
  ): Promise<Result<ReviewQueueResponse>> {
    const params = new URLSearchParams();
    if (workspaceId) params.append("workspaceId", workspaceId);
    params.append("limit", limit.toString());

    const queryString = params.toString();
    const url = queryString
      ? `${this.RESOURCE}/queue?${queryString}`
      : `${this.RESOURCE}/queue`;

    return this.call("GET", url, undefined, {}, ReviewQueueResponseSchema);
  }

  async getEnrollmentStatus(
    resourceIds?: string[],
    resourceType?: "material" | "flashcard" | "question",
    workspaceId?: string,
  ): Promise<Result<EnrollmentStatusResponse>> {
    const params = new URLSearchParams();
    if (resourceIds && resourceIds.length > 0) {
      params.append("resourceIds", resourceIds.join(","));
    }
    if (workspaceId) params.append("workspaceId", workspaceId);
    if (resourceType) params.append("resourceType", resourceType);

    const queryString = params.toString();
    const url = `${this.RESOURCE}/enrollment-status?${queryString}`;

    return this.call("GET", url, undefined, {}, EnrollmentStatusResponseSchema);
  }

  async getStats(workspaceId?: string): Promise<Result<ReviewSummaryStats>> {
    const params = new URLSearchParams();
    if (workspaceId) params.append("workspaceId", workspaceId);

    const queryString = params.toString();
    const url = queryString
      ? `${this.RESOURCE}/stats?${queryString}`
      : `${this.RESOURCE}/stats`;

    return this.call("GET", url, undefined, {}, ReviewSummaryStatsSchema);
  }
}
