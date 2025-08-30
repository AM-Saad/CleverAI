import FetchFactory from './FetchFactory'
import type { CreateMaterialDTO, UpdateMaterialDTO, Material } from '~~/shared/material.contract'

export class MaterialService extends FetchFactory {
  private readonly RESOURCE = '/api/materials'

  /**
   * Get all materials for a folder
   */
  async getByFolder(folderId: string): Promise<Material[]> {
    return this.call<Material[]>('GET', `${this.RESOURCE}?folderId=${folderId}`)
  }

  /**
   * Create a new material
   */
  async create(payload: CreateMaterialDTO): Promise<Material> {
    return this.call<Material>('POST', this.RESOURCE, payload)
  }

  /**
   * Update an existing material
   */
  async update(id: string, payload: UpdateMaterialDTO): Promise<Material> {
    return this.call<Material>('PATCH', this.RESOURCE, { id, ...payload })
  }

  /**
   * Delete a material
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return this.call<{ success: boolean; message: string }>('DELETE', this.RESOURCE, { id })
  }
}
