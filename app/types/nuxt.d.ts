import type { IApiInstance } from '~/types/api'

declare module '#app' {
  interface NuxtApp {
    $api: IApiInstance
  }
  interface AppContext {
    $api: IApiInstance
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: IApiInstance
  }
}
