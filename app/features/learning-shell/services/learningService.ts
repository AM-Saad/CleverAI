import FetchFactory from "~/services/FetchFactory";
import type { Result } from "~/types/Result";
import {
  LearningHomeSnapshotSchema,
  type LearningHomeSnapshot,
} from "@shared/utils/learning-home.contract";

export class LearningService extends FetchFactory {
  private readonly RESOURCE = "/api/learn";

  async getHome(
    timezoneOffsetMinutes: number,
  ): Promise<Result<LearningHomeSnapshot>> {
    const query = new URLSearchParams({
      timezoneOffsetMinutes: String(timezoneOffsetMinutes),
    });
    return this.call(
      "GET",
      `${this.RESOURCE}/home?${query.toString()}`,
      undefined,
      {},
      LearningHomeSnapshotSchema,
    );
  }
}
