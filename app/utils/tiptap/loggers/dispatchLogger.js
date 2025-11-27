// src/lib/tiptap/loggers/dispatchLogger.js
export function installDispatchLogger(editor) {
  if (!editor || !editor.view) {
    console.warn('installDispatchLogger: editor.view not available')
    return () => {}
  }

  const view = editor.view
  const originalDispatch = view.dispatch.bind(view)

  const teardown = () => {
    try {
      // restore original dispatch by re-setting props without dispatchTransaction
      view.setProps({ dispatchTransaction: originalDispatch })
    } catch (err) {
      // no-op
    }
  }

  view.setProps({
    dispatchTransaction: (tr) => {
      if (typeof window !== 'undefined' && window.DEBUG_TIPTAP) {
        try {
          console.groupCollapsed('ProseMirror dispatchTransaction')
          console.log('steps count:', tr.steps.length)
          tr.steps.forEach((step, i) => {
            try {
              console.group(`step ${i} (${step.constructor.name})`)
              console.log(step.toJSON ? step.toJSON() : step)
              console.groupEnd()
            } catch (err) {
              console.warn('could not toJSON step', err)
            }
          })
          console.log('docBefore', editor.state.doc.toJSON())
        } catch (err) {
          console.warn('logger pre-dispatch error', err)
        }
      }

      // apply as usual
      originalDispatch(tr)

      if (typeof window !== 'undefined' && window.DEBUG_TIPTAP) {
        try {
          console.log('docAfter', editor.state.doc.toJSON())
          console.groupEnd()
        } catch (err) {
          console.warn('logger post-dispatch error', err)
        }
      }
    },
  })

  return teardown
}