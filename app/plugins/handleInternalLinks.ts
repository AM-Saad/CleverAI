import type { Router } from "vue-router";

interface LinkHandledElement extends HTMLElement {
  _handleClick?: (event: MouseEvent) => void;
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = nuxtApp.$router as Router;

  nuxtApp.vueApp.directive("handleInternalLinks", {
    mounted(el: LinkHandledElement) {
      // Define the event handler as a named function and store it on the element
      el._handleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement | null;
        const link = target?.closest("a");
        const href = link?.getAttribute("href");

        if (!href?.startsWith("/")) return;

        event.preventDefault();
        void router.push(href);
      };
      // Add the event listener
      el.addEventListener("click", el._handleClick);
    },
    unmounted(el: LinkHandledElement) {
      // Remove the event listener using the same function reference
      if (el._handleClick) {
        el.removeEventListener("click", el._handleClick);
      }
    },
  });
});
