// https://nuxt.com/docs/api/configuration/nuxt-config
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  debug: true,
  // Use the existing `app/` folder as Nuxt source directory
  srcDir: "app",

  modules: [
    "@sidebase/nuxt-auth",
    "@pinia/nuxt", // "@vite-pwa/nuxt",
    "@nuxt/eslint",
    "@nuxt/image",
    "@nuxt/scripts",
    "@nuxt/icon",
    "@nuxt/ui",
    "@nuxt/devtools",
    "@vueuse/nuxt",
  ],
  future: {
    typescriptBundlerResolution: true,
    compatibilityVersion: 4,
  },
  alias: {
    string_decoder: "string_decoder/",
    "@server": resolve(__dirname, "./server"),
    "~/shared": resolve(__dirname, "./shared"),
    "#shared": resolve(__dirname, "./shared"), // optional extra alias
    "@shared": resolve(__dirname, "./shared"), // optional extra alias
  },
  hooks: {
    ready: async () => {
      if (process.env.NODE_ENV === "development") {
        const required = [
          "SERVER_URL",
          "APP_BASE_URL",
          "APP_PORT",
          "AUTH_ORIGIN",
          "VAPID_PUBLIC_KEY",
          "VAPID_PRIVATE_KEY",
          "SENDGRID_API_KEY",
          "AUTH_SECRET",
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "DATABASE_URL",
          "SW",
          "OPENAI_API_KEY",
        ];
        const missing = required.filter(
          (k) => !process.env[k as keyof NodeJS.ProcessEnv]
        );
        if (missing.length) {
          console.warn(
            "[env] Missing variables in development:",
            missing.join(", ")
          );
        } else {
          console.log("[env] All required variables present.");
        }
      }
    },
  },
  experimental: {
    debugModuleMutation: false,

    defaults: {
      useAsyncData: {
        deep: true,
      },
    },
  },

  unhead: {
    renderSSRHeadOptions: {
      omitLineBreaks: false,
    },
  },

  imports: {
    autoImport: true,
  },
  app: {
    head: {
      title: "CleverAI | Your AI-powered Learning Assistant",
      meta: [
        {
          name: "description",
          content:
            "CleverAI is your AI-powered learning assistant, designed to help you learn more effectively and efficiently.",
        },
        { name: "theme-color", content: "#f3f4f6" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "CleverAI" },
        { name: "msapplication-TileColor", content: "#f3f4f6" },
        {
          name: "msapplication-TileImage",
          content: "/AppImages/windows11/Square150x150Logo.scale-200.png",
        },
        { name: "msapplication-config", content: "/browserconfig.xml" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "application-name", content: "CleverAI" },
      ],
      link: [
        { rel: "manifest", href: "/manifest.webmanifest" },
        {
          rel: "icon",
          type: "image/x-icon",
          href: "/App_icon_16x16.ico",
          sizes: "16x16",
        },
        {
          rel: "icon",
          type: "image/x-icon",
          href: "/App_icon_32x32.ico",
          sizes: "32x32",
        },
        { rel: "shortcut icon", href: "/App_icon_16x16.ico" },
        {
          rel: "icon",
          type: "image/png",
          href: "/AppImages/ios/16.png",
          sizes: "16x16",
        },
        {
          rel: "icon",
          type: "image/png",
          href: "/AppImages/ios/32.png",
          sizes: "32x32",
        },
        {
          rel: "apple-touch-icon",
          href: "/AppImages/ios/180.png",
          sizes: "180x180",
        },
        {
          rel: "apple-touch-icon",
          href: "/AppImages/ios/152.png",
          sizes: "152x152",
        },
        {
          rel: "apple-touch-icon",
          href: "/AppImages/ios/120.png",
          sizes: "120x120",
        },
        {
          rel: "apple-touch-icon",
          href: "/AppImages/ios/76.png",
          sizes: "76x76",
        },
      ],
      script: [
        {
          type: "application/ld+json",
          innerHTML: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "CleverAI",
            url: "https://cleverai.app",
            logo: "https://cleverai.app/logo.png",
            description:
              "CleverAI is an AI-powered spaced repetition learning platform offering adaptive flashcards, offline learning, and personalized study schedules.",
          }),
        },
      ],
    },
  },
  appConfig: {
    toaster: {
      position: "bottom-center" as const,
      duration: 5000,
      max: 5,
      expand: true,
    },
  },
  auth: {
    isEnabled: true,
    originEnvKey: "AUTH_ORIGIN",
    baseURL: "/api/auth",
    provider: {
      type: "authjs",
      trustHost: true,
    },
    sessionRefresh: {
      enablePeriodically: false,
      enableOnWindowFocus: true,
    },
    globalAppMiddleware: {
      isEnabled: false,
    },
  },

  nitro: {
    preset: process.env.NODE_ENV === "production" ? "node-server" : undefined,
    esbuild: {
      options: {
        target: "es2022", // Support BigInt on server side
      },
    },
  },

  vite: {
    logLevel: "info",
    server: {
      hmr: {
        port: 3030, // Match the dev server port
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify("v1.0.0"),
    },
    build: {
      assetsInlineLimit: 4096, // inline assets under 4kb for better performance and reduce requests
      minify: "esbuild",
      target: "es2022", // Support BigInt and modern JS features
    },
    esbuild: {
      target: "es2022", // Support BigInt and modern JS features
      // drop: ["console", "debugger"],
    },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@tiptap/y-tiptap": "y-prosemirror",
      },
    },
    optimizeDeps: {
      include: [
        "@tiptap/extension-collaboration",
        "y-prosemirror",
        "yjs",
        "y-websocket",
      ],
      exclude: ["@xenova/transformers"], // Exclude transformers from optimization to avoid issues
    },
    worker: {
      format: "es", // Use ES modules for workers to preserve module dependencies
    },
  },

  build: {
    // transpile: ['trpc-nuxt']
    rollupOptions: {
      external: ["@xenova/transformers", "onnxruntime-web"], // Don't bundle transformers - causes ONNX Runtime webpack errors
    },
  },

  ssr: true,
  routeRules: {
    "/about": { prerender: true },
    "/": { prerender: true },
    "/pricing": { prerender: true },

    "/auth/**": { ssr: false },
    "/settings/**": { ssr: false },
    "/review/**": { ssr: false },
    "/folders/**": { ssr: false },
  },
  css: ["~/assets/css/main.css"],

  typescript: {
    shim: true,
  },
  runtimeConfig: {
    // Server-only
    redisUrl: process.env.REDIS_URL,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    databaseUrl: process.env.DATABASE_URL,

    // Auth / secrets (server only)
    nuxtAuthSecret: process.env.NUXT_AUTH_SECRET,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,

    enableLlmGateway: process.env.ENABLE_LLM_GATEWAY === "true",

    // Public (exposed to client)
    public: {
      AUTH_ORIGIN: process.env.AUTH_ORIGIN,
      APP_BASE_URL: process.env.APP_BASE_URL,
      SERVER_URL: process.env.SERVER_URL,
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

      enableLlmGateway: process.env.ENABLE_LLM_GATEWAY === "true",
    },
  },
});
