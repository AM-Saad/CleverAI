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
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="paper"]',
        getAttrs: (dom) => {
          try {
            return {
              lines: JSON.parse(dom.getAttribute('data-lines') || '[]'),
              height: parseInt(dom.getAttribute('data-height') || '280', 10),
            }
          } catch {
            return { lines: [], height: 280 }
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { lines, height, ...rest } = HTMLAttributes
    return [
      'div',
      mergeAttributes(rest, {
        'data-type': 'paper',
        'data-lines': JSON.stringify(lines || []),
        'data-height': String(height || 280),
      }),
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(Component)
  },
})