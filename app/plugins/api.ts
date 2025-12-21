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
//     folders: factory.create("folders"),
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
