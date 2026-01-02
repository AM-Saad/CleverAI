import FetchFactory from "./FetchFactory";
import type { Result } from "@/types/Result";
import type {
  Material,
  CreateMaterialDTO,
  UpdateMaterialDTO,
} from "~/shared/utils/material.contract";

export interface MaterialGeneratedContent {
  flashcardsCount: number;
  questionsCount: number;
}

/**
 * Response from file upload endpoint
 */
export interface UploadMaterialResponse {
  materialId: string;
  tokenEstimate: number;
  charCount: number;
  pageCount?: number;
  title: string;
}

export class MaterialService extends FetchFactory {
  private readonly RESOURCE = "/api/materials";
  private readonly UPLOAD_RESOURCE = "/api/materials/upload";

  /**
   * Get all materials for a folder
   */
  async getByFolder(folderId: string): Promise<Result<Material[]>> {
    return this.call<Material[]>(
      "GET",
      `${this.RESOURCE}?folderId=${folderId}`
    );
  }

  /**
   * Get a single material by ID
   */
  async getMaterial(id: string): Promise<Result<Material>> {
    return this.call<Material>("GET", `${this.RESOURCE}/${id}`);
  }

  /**
   * Get generated content counts for a material
   */
  async getGeneratedContent(
    materialId: string
  ): Promise<Result<MaterialGeneratedContent>> {
    return this.call<MaterialGeneratedContent>(
      "GET",
      `${this.RESOURCE}/${materialId}/generated`
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
    payload: UpdateMaterialDTO
  ): Promise<Result<Material>> {
    return this.call<Material>("PATCH", this.RESOURCE, { id, ...payload });
  }

  /**
   * Delete a material
   */
  async delete(
    id: string
  ): Promise<Result<{ success: boolean; message: string }>> {
    return this.call<{ success: boolean; message: string }>(
      "DELETE",
      this.RESOURCE,
      { id }
    );
  }

  /**
   * Upload a file and create a material with extracted text
   */
  async uploadFile(
    file: File,
    folderId: string,
    title?: string
  ): Promise<Result<UploadMaterialResponse>> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", folderId);
    if (title) formData.append("title", title);

    return this.call<UploadMaterialResponse>(
      "POST",
      this.UPLOAD_RESOURCE,
      formData,
      {
        timeout: 120000, // 2 minutes for large files
      }
    );
  }
}
