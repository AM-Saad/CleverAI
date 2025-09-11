// Diagnostic plugin to trace app initialization
export default defineNuxtPlugin((nuxtApp) => {
  console.log('🔍 [DIAGNOSTIC] Starting diagnostic plugin');
  console.log('🔍 [DIAGNOSTIC] Nuxt app instance:', nuxtApp);
  console.log('🔍 [DIAGNOSTIC] Vue app instance:', nuxtApp.vueApp);
  console.log('🔍 [DIAGNOSTIC] Runtime config:', useRuntimeConfig());

  // Log when the app is created
  nuxtApp.hook('app:created', (vueApp) => {
    console.log('🔍 [DIAGNOSTIC] Vue app created:', vueApp);
  });

  // Log when the app is mounted
  nuxtApp.hook('app:mounted', (vueApp) => {
    console.log('🔍 [DIAGNOSTIC] Vue app mounted:', vueApp);
    console.log('🔍 [DIAGNOSTIC] Document ready state:', document.readyState);
    console.log('🔍 [DIAGNOSTIC] DOM body innerHTML length:', document.body.innerHTML.length);
    console.log('🔍 [DIAGNOSTIC] Nuxt root element:', document.querySelector('#__nuxt'));
  });

  // Log page transitions
  nuxtApp.hook('page:start', () => {
    console.log('🔍 [DIAGNOSTIC] Page transition started');
  });

  nuxtApp.hook('page:finish', () => {
    console.log('🔍 [DIAGNOSTIC] Page transition finished');
  });

  // Log when Vue is ready
  nuxtApp.hook('vue:setup', () => {
    console.log('🔍 [DIAGNOSTIC] Vue setup complete');
  });

  // Check if we're in client mode
  if (import.meta.client) {
    console.log('🔍 [DIAGNOSTIC] Running on client side');

    // Add a fallback check after a delay
    setTimeout(() => {
      console.log('🔍 [DIAGNOSTIC] 5-second check:');
      console.log('🔍 [DIAGNOSTIC] Document body content:', document.body.innerHTML.substring(0, 500));
      console.log('🔍 [DIAGNOSTIC] Nuxt element:', document.querySelector('#__nuxt'));
      console.log('🔍 [DIAGNOSTIC] Router ready:', nuxtApp.$router?.isReady?.());
    }, 5000);
  } else {
    console.log('🔍 [DIAGNOSTIC] Running on server side');
  }

  console.log('🔍 [DIAGNOSTIC] Diagnostic plugin setup complete');
});
