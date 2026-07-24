import { mergeAttributes, Node, VueNodeViewRenderer } from '@tiptap/vue-3'

import Component from './PaperComponent.vue'

export default Node.create({
  name: 'paper',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      lines: {
        default: [],
      },
      height: {
        default: 280,
      },
      width: {
        default: null,
      },
      xOffset: {
        default: 0,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="paper"]',
        getAttrs: (dom) => {
          try {
            const width = dom.getAttribute('data-width')
            const xOffset = dom.getAttribute('data-x-offset')
            return {
              lines: JSON.parse(dom.getAttribute('data-lines') || '[]'),
              height: parseInt(dom.getAttribute('data-height') || '280', 10),
              width: width ? parseInt(width, 10) : null,
              xOffset: xOffset ? parseInt(xOffset, 10) : 0,
            }
          } catch {
            return { lines: [], height: 280, width: null, xOffset: 0 }
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { lines, height, width, xOffset, ...rest } = HTMLAttributes
    return [
      'div',
      mergeAttributes(rest, {
        'data-type': 'paper',
        'data-lines': JSON.stringify(lines || []),
        'data-height': String(height || 280),
        ...(width ? { 'data-width': String(width) } : {}),
        ...(xOffset ? { 'data-x-offset': String(xOffset) } : {}),
      }),
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(Component)
  },
})