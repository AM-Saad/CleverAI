import { EnrollCardResponseSchema, GradeCardResponseSchema, ReviewQueueResponseSchema, type EnrollCardRequest, type EnrollCardResponse, type GradeCardRequest, type GradeCardResponse, type ReviewQueueResponse } from '~~/shared/review.contract'
import FetchFactory from './FetchFactory'
import { z } from 'zod'

const EnrollmentStatusResponseSchema = z.object({
  enrollments: z.record(z.string(), z.boolean())
})
type EnrollmentStatusResponse = z.infer<typeof EnrollmentStatusResponseSchema>

export class ReviewService extends FetchFactory {
  private readonly RESOURCE = '/api/review'

  /**
   * Enroll a resource (material or flashcard) for spaced repetition review
   */
  async enroll(payload: EnrollCardRequest): Promise<EnrollCardResponse> {
    return this.call<EnrollCardResponse>(
      'POST',
      `${this.RESOURCE}/enroll`,
      payload,
      {},
      EnrollCardResponseSchema
    )
  }

  /**
   * Grade a review card using the SM-2 algorithm
   */
  async grade(payload: GradeCardRequest): Promise<GradeCardResponse> {
    return this.call<GradeCardResponse>(
      'POST',
      `${this.RESOURCE}/grade`,
      payload,
      {},
      GradeCardResponseSchema
    )
  }

  /**
   * Get the review queue with optional filtering
   */
  async getQueue(folderId?: string, limit: number = 20): Promise<ReviewQueueResponse> {
    const params = new URLSearchParams()
    if (folderId) params.append('folderId', folderId)
    params.append('limit', limit.toString())

    const queryString = params.toString()
    const url = queryString ? `${this.RESOURCE}/queue?${queryString}` : `${this.RESOURCE}/queue`

    return this.call<ReviewQueueResponse>(
      'GET',
      url,
      undefined,
      {},
      ReviewQueueResponseSchema
    )
  }

  /**
   * Check enrollment status for multiple resources
   */
  async getEnrollmentStatus(resourceIds: string[], resourceType?: 'material' | 'flashcard'): Promise<EnrollmentStatusResponse> {
    const params = new URLSearchParams()
    params.append('resourceIds', resourceIds.join(','))
    if (resourceType) params.append('resourceType', resourceType)

    const queryString = params.toString()
    const url = `${this.RESOURCE}/enrollment-status?${queryString}`

    return this.call<EnrollmentStatusResponse>(
      'GET',
      url,
      undefined,
      {},
      EnrollmentStatusResponseSchema
    )
  }
}
