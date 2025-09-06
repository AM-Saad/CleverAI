// https://nuxt.com/docs/api/configuration/nuxt-config
import process from "node:process"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "node:path";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
    debug: true,

  modules: [
    "@sidebase/nuxt-auth",
    "@pinia/nuxt",
    // "@vite-pwa/nuxt",
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/scripts',
    "@nuxt/icon",
    "@nuxt/ui",
'@nuxt/devtools',

  ],
    future: {
    typescriptBundlerResolution: true,
  },
  alias: {
    string_decoder: "string_decoder/",
    '~/shared': resolve(__dirname, './shared'),
      '#shared': resolve(__dirname, './shared'),   // optional extra alias
        '@shared': resolve(__dirname, './shared'),   // optional extra alias
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
        const missing = required.filter((k) => !process.env[k as keyof NodeJS.ProcessEnv]);
        if (missing.length) {
          console.warn("[env] Missing variables in development:", missing.join(", "));
        } else {
          console.log("[env] All required variables present.");
        }
      }
    },
  },
  experimental: {
    debugModuleMutation:false,

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
      link: [{ rel: 'manifest', href: '/manifest.webmanifest' }],
      meta: [{ name: 'theme-color', content: '#f3f4f6' }]
    }
  },
  appConfig: {
    // you don't need to include this: only for testing purposes
    buildDate: new Date().toISOString(),
    ui: {
      colors: {
        primary: 'secondary',
        secondary: 'green',
        neutral: 'zinc'
      },
    button: {
      slots: {
        base: 'rounded-lg', // use --radius-md
      }
    }
    },
  },
 auth: {
    isEnabled: true,
    originEnvKey: "AUTH_ORIGIN",
    baseURL: process.env.AUTH_ORIGIN + "/api/auth",
    provider: {
      type: "authjs",
      trustHost: true,
      // defaultProvider: "google",
      // addDefaultCallbackUrl: true,
    },
    sessionRefresh: {
      enablePeriodically: false,
      enableOnWindowFocus: true,
      // handler: "./config/AuthRefreshHandler.ts",
    },
    globalAppMiddleware: {
      isEnabled: false,
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
    },
    esbuild: {
      // drop: ["console", "debugger"],
    },
    plugins: [
        tailwindcss(),

    ],
  },

  build: {
    // transpile: ['trpc-nuxt']
  },

  ssr: false,
  css: ["./app/assets/css/main.css"],

  typescript: {
    shim: true,
  },
  runtimeConfig: {
    // Private (server only)
  redisUrl: process.env.REDIS_URL,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,           // ← add this
    databaseUrl: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,


    // Public (exposed to client)
    public: {
      AUTH_ORIGIN: process.env.AUTH_ORIGIN,
      APP_BASE_URL: process.env.APP_BASE_URL,
      SERVER_URL: process.env.SERVER_URL,
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    },
  },

})
