import FetchFactory, { APIError } from "./FetchFactory";
import { Result as R, type Result } from "../types/Result";
import type {
  Material,
  MaterialGeneratedContent,
  CreateMaterialDTO,
  UpdateMaterialDTO,
} from "~/shared/utils/material.contract";
import type {
  CommitMaterialGenerationRequest,
  CommitMaterialGenerationResponse,
  UploadMaterialResponse,
} from "~/shared/utils/llm-generate.contract";

export type { UploadMaterialResponse } from "~/shared/utils/llm-generate.contract";

export class MaterialService extends FetchFactory {
  private readonly RESOURCE = "/api/materials";
  private readonly UPLOAD_RESOURCE = "/api/materials/upload";

  /**
   * Get all materials for a workspace
   */
  async getByWorkspace(workspaceId: string): Promise<Result<Material[]>> {
    return this.call<Material[]>(
      "GET",
      `${this.RESOURCE}?workspaceId=${workspaceId}`,
    );
  }

  /**
   * Get a single material by ID
   */
  async getMaterial(id: string): Promise<Result<Material>> {
    return this.call<Material>("GET", `${this.RESOURCE}/${id}`);
  }

  /**
   * Get a single material by ID (alias for Context Bridge)
   */
  async getById(id: string): Promise<Result<Material>> {
    return this.getMaterial(id);
  }

  /**
   * Get generated flashcards and questions for a material.
   */
  async getGeneratedContent(
    materialId: string,
  ): Promise<Result<MaterialGeneratedContent>> {
    return this.call<MaterialGeneratedContent>(
      "GET",
      `${this.RESOURCE}/${materialId}/generated`,
    );
  }

  /**
   * Persist reviewed AI output and add those selected items to the review queue.
   */
  async commitGeneratedContent(
    materialId: string,
    payload: CommitMaterialGenerationRequest,
  ): Promise<Result<CommitMaterialGenerationResponse>> {
    return this.call<CommitMaterialGenerationResponse>(
      "POST",
      `${this.RESOURCE}/${materialId}/generated`,
      payload,
    );
  }

  /**
   * Create a new material
   */
  async create(payload: CreateMaterialDTO): Promise<Result<Material>> {
    return this.call<Material>("POST", this.RESOURCE, payload);
  }

  /**
   * Update an existing material
   */
  async update(
    id: string,
    payload: UpdateMaterialDTO,
  ): Promise<Result<Material>> {
    return this.call<Material>("PATCH", `${this.RESOURCE}/${id}`, payload);
  }

  /**
   * Delete a material
   */
  async delete(
    id: string,
  ): Promise<Result<{ success: boolean; message: string }>> {
    return this.call<{ success: boolean; message: string }>(
      "DELETE",
      this.RESOURCE,
      { id },
    );
  }

  /**
   * Upload a file and create a material with extracted text
   */
  async uploadFile(
    file: File,
    workspaceId: string,
    title?: string,
    onProgress?: (progress: number) => void,
  ): Promise<Result<UploadMaterialResponse>> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspaceId", workspaceId);
    if (title) formData.append("title", title);

    if (onProgress && typeof XMLHttpRequest !== "undefined") {
      return this.uploadFileWithProgress(formData, onProgress);
    }

    return this.call<UploadMaterialResponse>(
      "POST",
      this.UPLOAD_RESOURCE,
      formData,
      {
        timeout: 120000, // 2 minutes for large files
      },
    );
  }

  private uploadFileWithProgress(
    formData: FormData,
    onProgress: (progress: number) => void,
  ): Promise<Result<UploadMaterialResponse>> {
    return new Promise((resolve) => {
      const request = new XMLHttpRequest();
      request.open("POST", this.UPLOAD_RESOURCE);
      request.withCredentials = true;
      request.timeout = 120000;

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };
      request.upload.onload = () => onProgress(100);
      request.onerror = () =>
        resolve(
          R.error(
            new APIError(
              "Upload failed. Check your connection and try again.",
              {
                status: 0,
                code: "FETCH_ERROR",
              },
            ),
          ),
        );
      request.ontimeout = () =>
        resolve(
          R.error(
            new APIError("Upload timed out. Try again.", {
              status: 408,
              code: "TIMEOUT",
            }),
          ),
        );
      request.onload = () => {
        let payload: unknown;
        try {
          payload = JSON.parse(request.responseText);
        } catch {
          resolve(
            R.error(
              new APIError("Upload returned an invalid response.", {
                status: request.status,
                code: "INVALID_RESPONSE",
              }),
            ),
          );
          return;
        }

        const envelope = payload as {
          success?: boolean;
          data?: UploadMaterialResponse;
          error?: { message?: string; code?: string; statusCode?: number };
        };
        if (
          request.status >= 200 &&
          request.status < 300 &&
          envelope.success === true &&
          envelope.data
        ) {
          resolve(R.success(envelope.data));
          return;
        }

        resolve(
          R.error(
            new APIError(envelope.error?.message ?? "Upload failed.", {
              status: envelope.error?.statusCode ?? request.status,
              code: envelope.error?.code ?? "UPLOAD_ERROR",
            }),
          ),
        );
      };

      onProgress(0);
      request.send(formData);
    });
  }
}
