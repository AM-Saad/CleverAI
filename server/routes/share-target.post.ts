import { defineEventHandler, readMultipartFormData, getQuery, sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
  let text = ''
  let url = ''
  let title = ''
  let fileName = ''

  try {
    const formData = await readMultipartFormData(event)
    if (formData) {
      for (const field of formData) {
        if (field.name === 'text') {
          text = field.data.toString('utf-8')
        } else if (field.name === 'url') {
          url = field.data.toString('utf-8')
        } else if (field.name === 'title') {
          title = field.data.toString('utf-8')
        } else if (field.name === 'media' && field.filename) {
          fileName = field.filename
          // For text/markdown files shared directly, read string content if text is empty
          if (!text && (field.type?.includes('text') || field.filename.endsWith('.txt') || field.filename.endsWith('.md'))) {
            text = field.data.toString('utf-8')
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse share-target multipart data:', err)
  }

  // Fallback to query params if available
  const query = getQuery(event)
  if (!text && typeof query.text === 'string') text = query.text
  if (!url && typeof query.url === 'string') url = query.url
  if (!title && typeof query.title === 'string') title = query.title

  // Construct target redirect URL
  const targetParams = new URLSearchParams()
  targetParams.set('shared', 'true')
  if (text) targetParams.set('text', text.slice(0, 2000))
  if (url) targetParams.set('url', url)
  if (title) targetParams.set('title', title)
  if (fileName) targetParams.set('fileName', fileName)

  return sendRedirect(event, `/share-target?${targetParams.toString()}`, 303)
})
