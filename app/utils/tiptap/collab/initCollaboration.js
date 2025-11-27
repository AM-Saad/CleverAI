// // utils/tiptap/collab/initCollaboration.js
// export async function initCollaboration(editor, { roomName = 'demo-room', websocketUrl = 'wss://demos.yjs.dev' } = {}) {
//   if (typeof window === 'undefined') {
//     // SSR - nothing to do server-side
//     return { ok: false, reason: 'ssr' }
//   }

//   if (!editor) {
//     throw new Error('initCollaboration: editor not available')
//   }

//   try {
//     // dynamic import so bundler won't fail at SSR / prebundle time if deps missing
//     const [Ymod, WebsocketProviderMod, collabMod, cursorMod] = await Promise.all([
//       import('yjs').catch(() => null),
//       import('y-websocket').catch(() => null),
//       import('@tiptap/extension-collaboration').catch(() => null),
//       import('@tiptap/extension-collaboration-cursor').catch(() => null), // optional
//     ])

//     if (!Ymod || !WebsocketProviderMod || !collabMod) {
//       console.warn(
//         'initCollaboration: missing packages. Install: npm install yjs y-websocket @tiptap/extension-collaboration'
//       )
//       return { ok: false, reason: 'missing-packages' }
//     }

//     // Normalise module shapes
//     const Y = Ymod.default || Ymod
//     const WebsocketProvider = WebsocketProviderMod.WebsocketProvider || WebsocketProviderMod.default || WebsocketProviderMod
//     const CollaborationExt = collabMod.Collaboration || collabMod.default || collabMod
//     const CollaborationCursorExt = cursorMod ? (cursorMod.CollaborationCursor || cursorMod.default || cursorMod) : null

//     if (!CollaborationExt || typeof CollaborationExt.configure !== 'function') {
//       console.warn('initCollaboration: could not find Collaboration extension in imported module')
//       return { ok: false, reason: 'bad-module' }
//     }

//     // Create Yjs doc + provider
//     const ydoc = new Y.Doc()
//     const provider = new WebsocketProvider(websocketUrl, roomName, ydoc)
//     const yXmlFragment = ydoc.getXmlFragment('prosemirror')

//     // Build TipTap extension instance(s)
//     const collabExtension = CollaborationExt.configure({ document: yXmlFragment })
//     let cursorExtension = null
//     if (CollaborationCursorExt) {
//       cursorExtension = CollaborationCursorExt.configure({ provider }) // or awareness: provider.awareness
//     }

//     // Register plugin(s) with running editor.
//     // Tip: adding extensions dynamically may require editor.registerPlugin or editor.registerExtension depending on TipTap version.
//     // We'll try both approaches defensively:
//     const registered = []
//     try {
//       // If the extension exposes `plugin` or is a TipTap Extension instance we can:
//       if (typeof editor.registerPlugin === 'function') {
//         editor.registerPlugin(collabExtension) // common case if collabExtension is a ProseMirror plugin or TipTap plugin wrapper
//         registered.push('plugin')
//         if (cursorExtension) {
//           editor.registerPlugin(cursorExtension)
//         }
//       } else if (typeof editor.registerExtension === 'function') {
//         // Some TipTap builds expose registerExtension
//         editor.registerExtension(collabExtension)
//         registered.push('extension')
//         if (cursorExtension) editor.registerExtension(cursorExtension)
//       } else if (typeof editor.register === 'function') {
//         // fallback to a generic API
//         editor.register(collabExtension)
//         registered.push('register')
//         if (cursorExtension) editor.register(cursorExtension)
//       } else {
//         // As a last resort, re-create the editor with the new extension list:
//         console.warn('initCollaboration: dynamic extension registration not available; you may need to recreate editor with collab extension at creation time')
//         // Do NOT attempt to mutate internal state here (dangerous).
//       }
//     } catch (err) {
//       console.warn('initCollaboration: failed to register collaboration extension dynamically', err)
//       // still return the internals so caller can retry/decide
//     }

//     // Return created internals and a cleanup function
//     const cleanup = async () => {
//       try {
//         provider.disconnect && provider.disconnect()
//         provider.destroy && provider.destroy()
//       } catch (e) { /* ignore */ }
//       try {
//         ydoc.destroy && ydoc.destroy()
//       } catch (e) { /* ignore */ }
//       // note: removing the plugin from the running editor is non-trivial and differs by TipTap versions;
//       // you may need to recreate the editor to remove the plugin. If editor supports unregisterPlugin/unregisterExtension, call them here.
//     }

//     return { ok: true, ydoc, provider, collabExtension, cursorExtension, cleanup, registered }
//   } catch (err) {
//     console.error('initCollaboration failed', err)
//     return { ok: false, reason: 'error', error: err }
//   }
// }
// utils/tiptap/collab/initCollaboration.js
export async function initCollaboration(editor, { roomName = 'demo-room', websocketUrl = 'wss://demos.yjs.dev' } = {}) {
  if (typeof window === 'undefined') {
    // SSR - nothing to do server-side
    return { ok: false, reason: 'ssr' }
  }

  if (!editor) {
    throw new Error('initCollaboration: editor not available')
  }

  try {
    // dynamic import so bundler won't fail at SSR / prebundle time if deps missing
    const [Ymod, WebsocketProviderMod, collabMod, cursorMod] = await Promise.all([
      import('yjs').catch(() => null),
      import('y-websocket').catch(() => null),
      import('@tiptap/extension-collaboration').catch(() => null),
      import('@tiptap/extension-collaboration-cursor').catch(() => null), // optional
    ])

    // report exactly which packages are missing
    const missing = []
    if (!Ymod) missing.push('yjs')
    if (!WebsocketProviderMod) missing.push('y-websocket')
    if (!collabMod) missing.push('@tiptap/extension-collaboration')
    if (!cursorMod) missing.push('@tiptap/extension-collaboration-cursor (optional)')

    if (missing.length) {
      console.warn('initCollaboration: missing packages:', missing.join(', '))
      return { ok: false, reason: 'missing-packages', missing }
    }

    // Normalise module shapes
    const Y = Ymod.default || Ymod
    const WebsocketProvider = WebsocketProviderMod.WebsocketProvider || WebsocketProviderMod.default || WebsocketProviderMod
    const CollaborationExt = collabMod.Collaboration || collabMod.default || collabMod
    const CollaborationCursorExt = cursorMod ? (cursorMod.CollaborationCursor || cursorMod.default || cursorMod) : null

    if (!CollaborationExt || typeof CollaborationExt.configure !== 'function') {
      console.warn('initCollaboration: could not find Collaboration extension in imported module')
      return { ok: false, reason: 'bad-module' }
    }

    // Create Yjs doc + provider (defensive)
    const ydoc = new Y.Doc()
    let provider
    try {
      provider = new WebsocketProvider(websocketUrl, roomName, ydoc)
    } catch (err) {
      console.error('initCollaboration: provider creation failed', err)
      try { ydoc.destroy && ydoc.destroy() } catch (e) { /* ignore */ }
      return { ok: false, reason: 'provider-failed', error: err }
    }

    // If provider emits status events, log them to help debugging
    try {
      if (provider && provider.on) {
        provider.on('status', (ev) => {
          // ev.status = 'connected' | 'disconnected'
          console.info('y-websocket provider status', ev)
        })
      }
    } catch (e) { /* ignore */ }

    const yXmlFragment = ydoc.getXmlFragment('prosemirror')

    // Build TipTap extension instance(s)
    const collabExtension = CollaborationExt.configure({ document: yXmlFragment })
    let cursorExtension = null
    if (CollaborationCursorExt) {
      // some cursor extensions expect provider or awareness object
      cursorExtension = CollaborationCursorExt.configure({ provider })
    }

    // helper to register plugins when editor is ready
    const registered = []

    const doRegister = () => {
      try {
        // guard: editor.state must exist (ProseMirror state)
        if (!editor.state) {
          throw new Error('editor.state is not ready')
        }

        if (typeof editor.registerPlugin === 'function') {
          editor.registerPlugin(collabExtension)
          registered.push('plugin')
          if (cursorExtension) editor.registerPlugin(cursorExtension)
        } else if (typeof editor.registerExtension === 'function') {
          editor.registerExtension(collabExtension)
          registered.push('extension')
          if (cursorExtension) editor.registerExtension(cursorExtension)
        } else if (typeof editor.register === 'function') {
          editor.register(collabExtension)
          registered.push('register')
          if (cursorExtension) editor.register(cursorExtension)
        } else {
          console.warn('initCollaboration: dynamic extension registration not available; you may need to recreate editor with collab extension at creation time')
        }

        return { ok: true }
      } catch (err) {
        console.warn('initCollaboration: failed to register collaboration extension dynamically', err)
        return { ok: false, error: err }
      }
    }

    // If editor.state isn't ready yet, wait for TipTap to initialize view
    let regResult = null
    if (!editor.state) {
      // TipTap emits 'create' when editor view/state are ready. Try to use it.
      try {
        if (typeof editor.on === 'function') {
          const once = (payload) => {
            // small safety: remove handler if possible
            try { editor.off && editor.off('create', once) } catch (e) { /* ignore */ }
            regResult = doRegister()
          }
          editor.on('create', once)
        } else {
          // fallback: schedule a microtask to attempt registration later
          setTimeout(() => { regResult = doRegister() }, 0)
        }
      } catch (e) {
        // last resort: attempt immediate registration
        regResult = doRegister()
      }
    } else {
      regResult = doRegister()
    }

    // Return created internals and a cleanup function
    const cleanup = async () => {
      try {
        provider.disconnect && provider.disconnect()
        provider.destroy && provider.destroy()
      } catch (e) { /* ignore */ }
      try {
        ydoc.destroy && ydoc.destroy()
      } catch (e) { /* ignore */ }
      // note: removing the plugin from the running editor is non-trivial and differs by TipTap versions;
      // you may need to recreate the editor to remove the plugin. If editor supports unregisterPlugin/unregisterExtension, call them here.
    }

    return { ok: true, ydoc, provider, collabExtension, cursorExtension, cleanup, registered, registrationResult: regResult }
  } catch (err) {
    console.error('initCollaboration failed', err)
    return { ok: false, reason: 'error', error: err }
  }
}