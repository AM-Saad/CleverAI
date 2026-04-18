// import { $fetch } from "ofetch";
// import type { IApiInstance } from "~/types/api";
// import { ServiceFactory } from "~/services/ServiceFactory";

// export default defineNuxtPlugin(() => {
//   const config = useRuntimeConfig();

//   const baseURL = config.public.SERVER_URL || config.public.APP_BASE_URL || "";
//   const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

//   const fetcher = $fetch.create({
//     baseURL,
//     credentials: "include",
//     headers,
//   });

//   const factory = new ServiceFactory(fetcher);

//   const api: IApiInstance = {
//     workspaces: factory.create("workspaces"),
//     auth: factory.create("auth"),
//     review: factory.create("review"),
//     materials: factory.create("materials"),
//     notes: factory.create("notes"),
//     user: factory.create("user"),
//     gateway: factory.create("gateway"),
//   };

//   return {
//     provide: {
//       api,
//     },
//   };
// });


// [File]: plugins/api.ts

import { ServiceFactory } from "@/services/ServiceFactory";
import type { $Fetch } from "ofetch";

export default defineNuxtPlugin((_nuxtApp) => {
  console.log("🌐 [API PLUGIN] Initializing API plugin");

  const baseURL = useRuntimeConfig().public.APP_BASE_URL;

  const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

  const apiFetcher = $fetch.create({
    baseURL: baseURL,
    credentials: "include",
    headers: headers as HeadersInit,
    onRequest({ options }) {
      // console.log("🌐 [API PLUGIN] Making request:", options.method);
      // We rely on httpOnly cookies. Removing useAuth() call here to prevent potential reactivity/context loops.
    },
    onRequestError({ error }) {
      console.error("🌐 [API PLUGIN] Request error:", error);
    },
    onResponseError({ response }) {
      // console.error("🌐 [API PLUGIN] Response error:", response);
    },
  });

  const apiServiceFactory = new ServiceFactory(apiFetcher as $Fetch);

  const services = {
    workspaces: apiServiceFactory.create("workspaces"),
    materials: apiServiceFactory.create("materials"),
    notes: apiServiceFactory.create("notes"),
    boardItems: apiServiceFactory.create("boardItems"),
    boardColumns: apiServiceFactory.create("boardColumns"),
    auth: apiServiceFactory.create("auth"),
    review: apiServiceFactory.create("review"),
    user: apiServiceFactory.create("user"),
    userTags: apiServiceFactory.create("userTags"),
    gateway: apiServiceFactory.create("gateway"),
    language: apiServiceFactory.create("language"),
  };

  // Phase 4: Wire FetchFactory to report failures to the network monitor
  const networkMonitor = useNetworkStatus();
  Object.values(services).forEach((service) => {
    service.setOnError(async (error) => {
      if (error.code === "FETCH_ERROR" || error.code === "TIMEOUT") {
        await networkMonitor.reportFailure();
      }
    });
  });

  console.log("🌐 [API PLUGIN] API services created:", Object.keys(services));

  console.log("🌐 [API PLUGIN] API plugin initialized successfully");

  return {
    provide: {
      api: services,
    },
  };
});
