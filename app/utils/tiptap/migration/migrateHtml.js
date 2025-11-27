// src/lib/tiptap/migration/migrateHtml.js
import { DOMParser as PMDOMParser } from 'prosemirror-model'

/**
 * Parse HTML string into ProseMirror JSON using a given editor instance/schema.
 * Returns null on failure.
 *
 * @param {Editor} editor - TipTap Editor instance (must be initialized)
 * @param {string} html - raw HTML string
 * @returns {object|null} - ProseMirror JSON doc or null
 */
export function migrateHtmlToJSON(editor, html) {
  if (!editor || !editor.schema) {
    throw new Error('migrateHtmlToJSON: editor or schema not available')
  }

  try {
    const parser = PMDOMParser.fromSchema(editor.schema)
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const pmNode = parser.parse(wrapper)
    return pmNode.toJSON()
  } catch (err) {
    console.error('migrateHtmlToJSON failed', err)
    return null
  }
}

/**
 * Convenience: parse HTML and set content of the editor if parsing succeeds.
 * Returns boolean success.
 */
export function runMigrationTest(editor, html) {
  const json = migrateHtmlToJSON(editor, html)
  if (!json) return false
  try {
    editor.commands.setContent(json)
    return true
  } catch (err) {
    console.error('runMigrationTest failed to set content', err)
    return false
  }
}