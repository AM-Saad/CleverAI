export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive("handleInternalLinks", {
    mounted(el) {
      // Define the event handler as a named function and store it on the element
      el._handleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement
        if (
          target.tagName === "A" &&
          target.getAttribute("href")?.startsWith("/")
        ) {
          event.preventDefault()
          const href = target.getAttribute("href") as string
          nuxtApp.$router.push(href) // Programmatic navigation using Nuxt's router
        }
      }
      // Add the event listener
      el.addEventListener("click", el._handleClick)
    },
    unmounted(el: HTMLElement) {
      // Remove the event listener using the same function reference
      el.removeEventListener("click", el._handleClick)
    },
  })
})
