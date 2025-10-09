// app/services/Folder.ts
import FetchFactory from "~/services/FetchFactory"
import { RESOURCES } from "~/utils/constants/resources.enum"
import type { IFolder, } from "~/types/models/folders"
import type { CreateFolderDTO,UpdateFolderDTO } from "~/types/dtos/folders"
import type { ZodSchema } from "zod"
import type { Result } from "~/types/Result"

class FoldersModule extends FetchFactory {
  private RESOURCE = RESOURCES.FOLDERS

  async getFolders(_validator?: ZodSchema<IFolder[]>): Promise<Result<IFolder[]>> {
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

  async getFolder(id: string, _validator?: ZodSchema<IFolder>): Promise<Result<IFolder>> {
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

  async postFolder(payload: Partial<CreateFolderDTO>): Promise<Result<IFolder>> {
    const fetchOptions = {
      headers: {
        "Accept-Language": "en-US",
      },
    }
    return this.call("POST", `${this.RESOURCE}`, payload, fetchOptions)
  }

  async updateFolder(
    id: string,
    payload: Partial<UpdateFolderDTO>,
  ): Promise<Result<IFolder>> {
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
