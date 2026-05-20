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
            }
          } catch {
            return { lines: [] }
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { lines, ...rest } = HTMLAttributes
    return [
      'div',
      mergeAttributes(rest, {
        'data-type': 'paper',
        'data-lines': JSON.stringify(lines || []),
      }),
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(Component)
  },
})