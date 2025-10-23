// app/services/Folder.ts
import FetchFactory from "~/services/FetchFactory"
import { RESOURCES } from "~/utils/constants/resources.enum"
import type { ZodSchema } from "zod"
import type { Result } from "~/types/Result"

class FoldersModule extends FetchFactory {
  private RESOURCE = RESOURCES.FOLDERS

  async getFolders(_validator?: ZodSchema<Folder[]>): Promise<Result<Folder[]>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    }
    return this.call(
      "GET",
      `${this.RESOURCE}`,
      undefined,
      fetchOptions,
    //   validator,
    )
  }

  async getFolder(id: string, _validator?: ZodSchema<Folder>): Promise<Result<Folder>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    }
    return this.call(
      "GET",
      `${this.RESOURCE}/${id}`,
      undefined,
      fetchOptions,
    //   validator,
    )
  }

  async postFolder(payload: Partial<typeof CreateFolderDTO>): Promise<Result<Folder>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    }
    return this.call("POST", `${this.RESOURCE}`, payload, fetchOptions)
  }

  async updateFolder(
    id: string,
    payload: Partial<typeof UpdateFolderDTO>,
  ): Promise<Result<Folder>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    }
    return this.call("PATCH", `${this.RESOURCE}/${id}`, { ...payload }, fetchOptions)

  }

  async deleteFolder(id: string): Promise<Result<{ success: boolean }>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    }
    return this.call(
      "DELETE",
      `${this.RESOURCE}`,
      { id },
      fetchOptions,
    )
  }
}

export default FoldersModule
