import FetchFactory from './FetchFactory'
import type { CreateNoteDTO, UpdateNoteDTO, Note } from '~~/shared/note.contract'
import type { Result } from '~/types/Result'

export class NoteService extends FetchFactory {
  private readonly RESOURCE = '/api/notes'

  /**
   * Get all notes for a folder
   */
  async getByFolder(folderId: string): Promise<Result<Note[]>> {
    return this.call<Note[]>('GET', `${this.RESOURCE}?folderId=${folderId}`)
  }

  /**
   * Create a new note
   */
  async create(payload: CreateNoteDTO): Promise<Result<Note>> {
    return this.call<Note>('POST', this.RESOURCE, payload)
  }

  /**
   * Update an existing note
   */
  async update(id: string, payload: UpdateNoteDTO): Promise<Result<Note>> {
    return this.call<Note>('PATCH', `${this.RESOURCE}/${id}`, { id, ...payload })
  }

  /**
   * Delete a note
   */
  async delete(id: string): Promise<Result<{ success: boolean; message: string }>> {
    return this.call<{ success: boolean; message: string }>('DELETE', this.RESOURCE, { id })
  }
}
