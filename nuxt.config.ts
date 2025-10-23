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
    "@pinia/nuxt",
    // "@vite-pwa/nuxt",
    "@nuxt/eslint",
    "@nuxt/image",
    "@nuxt/scripts",
    "@nuxt/icon",
    "@nuxt/ui",
    "@nuxt/devtools",
  ],
  future: {
    typescriptBundlerResolution: true,
    compatibilityVersion: 4,
  },
  alias: {
    string_decoder: "string_decoder/",
    "@server": resolve(__dirname, "./server"),
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
      link: [
        { rel: "manifest", href: "/manifest.webmanifest" },
        // Favicon hierarchy - ICO files for browser tabs and bookmarks
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
        { rel: "shortcut icon", href: "/App_icon_16x16.ico" }, // Fallback for older browsers
        // PNG alternatives for modern browsers
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
        // iOS specific icons
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
      meta: [
        { name: "theme-color", content: "#f3f4f6" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        // iOS specific meta tags
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "CleverAI" },
        // Microsoft specific meta tags
        { name: "msapplication-TileColor", content: "#f3f4f6" },
        {
          name: "msapplication-TileImage",
          content: "/AppImages/windows11/Square150x150Logo.scale-200.png",
        },
        { name: "msapplication-config", content: "/browserconfig.xml" },
        // Android/Chrome specific
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "application-name", content: "CleverAI" },
      ],
    },
  },
  //   appConfig: {
  //     // you don't need to include this: only for testing purposes
  //     buildDate: new Date().toISOString(),
  //     ui: {
  //       colors: {
  //         primary: 'primary',
  //         dark: 'dark',
  //         light: 'light',
  //         muted: 'muted',
  //       },
  //     button: {
  //     slots: {
  //     base: ['rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75'],
  //     label: 'truncate',
  //     leadingIcon: 'shrink-0',
  //     leadingAvatar: 'shrink-0',
  //     leadingAvatarSize: '',
  //     trailingIcon: 'shrink-0'
  //   },

  //     },
  //         input: {
  //       slots: {
  //         base: 'rounded-sm py-sm px-sm', // use --radius-md
  //       }
  //     },
  //     },
  //   },
  //     colorMode: {
  //     preference: 'light',
  //     fallback: 'light',
  //     hid: 'nuxt-color-mode-script',
  //     globalName: '__NUXT_COLOR_MODE__',
  //     componentName: 'ColorScheme',
  //     classPrefix: '',
  //     classSuffix: '',
  //     storageKey: 'nuxt-color-mode'
  //   },
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

  nitro: {
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
  },

  build: {
    // transpile: ['trpc-nuxt']
  },

  ssr: false,
  css: ["~/assets/css/main.css"],

  typescript: {
    shim: true,
  },
  runtimeConfig: {
    // Private (server only)
    redisUrl: process.env.REDIS_URL,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY, // ← add this
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
});
