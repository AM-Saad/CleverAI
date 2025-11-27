// [File]: plugins/api.ts

import { ServiceFactory } from "@/services/ServiceFactory";
import type { $Fetch } from "ofetch";

export default defineNuxtPlugin((_nuxtApp) => {
  console.log("🌐 [API PLUGIN] Initializing API plugin");

  const baseURL = useRuntimeConfig().public.APP_BASE_URL;
  console.log("🌐 [API PLUGIN] Base URL:", baseURL);

  const apiFetcher = $fetch.create({
    baseURL: baseURL,
    onRequest({ options }) {
      console.log("🌐 [API PLUGIN] Making request:", options);
      const token = useCookie("auth_token").value;
      if (token) {
        if (!options.headers) options.headers = new Headers();
        (options.headers as Headers).set("Authorization", `Bearer ${token}`);
        console.log("🌐 [API PLUGIN] Added auth token to request");
      } else {
        console.log("🌐 [API PLUGIN] No auth token found");
      }
    },
    onRequestError({ error }) {
      console.error("🌐 [API PLUGIN] Request error:", error);
    },
    onResponseError({ response }) {
      console.error("🌐 [API PLUGIN] Response error:", response);
    },
  });

  const apiServiceFactory = new ServiceFactory(apiFetcher as $Fetch);
  console.log("🌐 [API PLUGIN] Service factory created");

  const services = {
    folders: apiServiceFactory.create("folders"),
    materials: apiServiceFactory.create("materials"),
    notes: apiServiceFactory.create("notes"),
    auth: apiServiceFactory.create("auth"),
    review: apiServiceFactory.create("review"),
    user: apiServiceFactory.create("user"),
    gateway: apiServiceFactory.create("gateway"),
  };

  console.log("🌐 [API PLUGIN] API services created:", Object.keys(services));

  console.log("🌐 [API PLUGIN] API plugin initialized successfully");

  return {
    provide: {
      api: services,
    },
  };
});
