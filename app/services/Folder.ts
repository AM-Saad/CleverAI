// app/services/Folder.ts
import FetchFactory from "~/services/FetchFactory";
import { RESOURCES } from "~/utils/constants/resources.enum";
import type { ZodSchema } from "zod";
import type { Result } from "~/types/Result";
import type {
  Flashcard,
  CreateFlashcardDTO,
  UpdateFlashcardDTO,
  DeleteFlashcardResponse,
} from "@@/shared/utils/flashcard.contract";

class FoldersModule extends FetchFactory {
  private RESOURCE = RESOURCES.FOLDERS;

  async getFolders(
    _validator?: ZodSchema<Folder[]>
  ): Promise<Result<Folder[]>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    };
    return this.call(
      "GET",
      `${this.RESOURCE}`,
      undefined,
      fetchOptions
      //   validator,
    );
  }

  async getFolder(
    id: string,
    _validator?: ZodSchema<Folder>
  ): Promise<Result<Folder>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    };
    return this.call(
      "GET",
      `${this.RESOURCE}/${id}`,
      undefined,
      fetchOptions
      //   validator,
    );
  }

  async create(
    payload: Partial<typeof CreateFolderDTO>
  ): Promise<Result<Folder>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    };
    return this.call("POST", `${this.RESOURCE}`, payload, fetchOptions);
  }

  async update(
    id: string,
    payload: Partial<typeof UpdateFolderDTO>
  ): Promise<Result<Folder>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    };
    return this.call(
      "PATCH",
      `${this.RESOURCE}/${id}`,
      { ...payload },
      fetchOptions
    );
  }

  async delete(id: string): Promise<Result<{ success: boolean }>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    };
    return this.call("DELETE", `${this.RESOURCE}`, { id }, fetchOptions);
  }

  // ==========================================
  // Flashcard Methods
  // ==========================================

  async createFlashcard(
    payload: CreateFlashcardDTO
  ): Promise<Result<Flashcard>> {
    return this.call("POST", "/api/flashcards", payload);
  }

  async updateFlashcard(
    id: string,
    payload: UpdateFlashcardDTO
  ): Promise<Result<Flashcard>> {
    return this.call("PATCH", `/api/flashcards/${id}`, payload);
  }

  async deleteFlashcard(id: string): Promise<Result<DeleteFlashcardResponse>> {
    return this.call("DELETE", `/api/flashcards/${id}`);
  }
}

export default FoldersModule;
