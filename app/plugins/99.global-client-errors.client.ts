export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return
  const log = (...args: unknown[]) => console.error('🛑 [GLOBAL-ERROR]', ...args)

  window.addEventListener('error', (event) => {
    log('window error:', event.message, event.filename, event.lineno, event.colno, event.error)
  })
  window.addEventListener('unhandledrejection', (event) => {
    log('unhandledrejection:', event.reason)
  })

  nuxtApp.hook('app:error', (error) => log('app:error', error))
  nuxtApp.hook('vue:error', (error, instance, info) => log('vue:error', error, info, instance?.$?.type?.name))
})
