// [File]: plugins/api.ts

import type { $Fetch } from "ofetch"
import { ServiceFactory } from "~/services/ServiceFactory"

export default defineNuxtPlugin((nuxtApp) => {
  const baseURL = useRuntimeConfig().public.APP_BASE_URL

  const apiFetcher = $fetch.create({
    baseURL: baseURL,
    onRequest({ options }) {
      const token = useCookie("auth_token").value
      if (token) {
        if (!options.headers) options.headers = new Headers()
        ;(options.headers as Headers).set("Authorization", `Bearer ${token}`)
      }
    },
  })
  const apiServiceFactory = new ServiceFactory(apiFetcher as $Fetch)

  return {
    provide: {
      api: {
        folders: apiServiceFactory.create("folders"),
        auth: apiServiceFactory.create("auth"),
      },
    },
  }
})
