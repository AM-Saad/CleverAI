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
    "@vite-pwa/nuxt",
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
    compileTemplate: true,
    templateUtils: true,
    relativeWatchPaths: true,
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
        port: 8080, // Match the dev server port
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

  pwa: {
    strategies: "generateSW",
    registerType: "autoUpdate",
    manifest: {
      name: "CleverAI",
      short_name: "CleverAI",
      theme_color: "#f3f4f6",
      start_url: "/",
      display: "standalone",
      id: "/",
      display_override: ["standalone", "minimal-ui", "fullscreen"],
      description: " CleverAI is a powerful AI assistant that helps you with your daily tasks and provides intelligent solutions.",
      lang: "en",
      dir: "ltr",
      background_color: "#f3f4f6",
      orientation: "any",
      categories: ["productivity", "ai", "assistant"],
      screenshots: [
        {
          src: "screenshots/desktop.png",
          sizes: "1280x720",
          type: "image/png",
          form_factor: "wide", // Specify this for desktop
        },
        {
          src: "screenshots/mobile.png",
          sizes: "640x360",
          type: "image/png",
          form_factor: "narrow",
        },
      ],
      icons: [
        { src: "icons/16x16.png", sizes: "16x16", type: "image/png" },
        { src: "icons/32x32.png", sizes: "32x32", type: "image/png" },
        { src: "icons/72x72.png", sizes: "72x72", type: "image/png" },
        { src: "icons/96x96.png", sizes: "96x96", type: "image/png" },
        { src: "icons/120x120.png", sizes: "120x120", type: "image/png" },
        { src: "icons/128x128.png", sizes: "128x128", type: "image/png" },
        { src: "icons/144x144.png", sizes: "144x144", type: "image/png" },
        { src: "icons/152x152.png", sizes: "152x152", type: "image/png" },
        { src: "icons/180x180.png", sizes: "180x180", type: "image/png" },
        { src: "icons/192x192.png", sizes: "192x192", type: "image/png" },
        { src: "icons/384x384.png", sizes: "384x384", type: "image/png" },
        { src: "icons/512x512.png", sizes: "512x512", type: "image/png" },
        {
          src: "icons/512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      protocol_handlers: [
        {
          protocol: "web+recwide",
          url: "/web+recwide?type=%s",
        },
      ],
      share_target: {
        action: "/share-target",
        method: "POST",
        params: {
          title: "",
          text: "text",
          url: "url",
        },
      },
    },

    client: {
      installPrompt: true,
      // you don't need to include this: only for testing purposes
      // if enabling periodic sync for update use 1 hour or so (periodicSyncForUpdates: 3600)
      periodicSyncForUpdates: 20,
    },
    devOptions: {
      enabled: true,
      suppressWarnings: false,
      navigateFallback: "/",
      navigateFallbackAllowlist: [/^\/.*$/], // Allow all routes to use offline fallback
      type: "module",
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,ico,png,svg}", "_nuxt/**/*"],
      navigateFallback: "/",
      navigateFallbackDenylist: [/^\/_/, /\/api\//], // Exclude internal and API routes
      runtimeCaching: [
        {
          urlPattern: /\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 44,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
            },
          },
        },
        {
          urlPattern: /^\/_nuxt\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'nuxt-assets',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 7 * 24 * 60 * 60,
            },
          },
        },
        {
          urlPattern: /\.(?:js|mjs|ts)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'javascript',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 7 * 24 * 60 * 60,
            },
          },
        },
        {
          urlPattern: /\.(?:css)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'stylesheets',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 7 * 24 * 60 * 60,
            },
          },
        },
        {
          urlPattern: /^\/_nuxt\/@vite\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'vite-dev',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60, // 1 hour for dev tools
            },
            networkTimeoutSeconds: 3,
          },
        },
        {
          urlPattern: /^\/_nuxt\/@fs\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'nuxt-fs',
            expiration: {
              maxEntries: 30,
              maxAgeSeconds: 7 * 24 * 60 * 60,
            },
          },
        },
        {
          urlPattern: /^\/_nuxt\/@id\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'nuxt-virtual',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 3 * 24 * 60 * 60, // 3 days
            },
          },
        },
        {
          urlPattern: /^\/_nuxt\/@vite-plugin-pwa\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'pwa-assets',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 7 * 24 * 60 * 60,
            },
          },
        },
        {
          urlPattern: /\/_nuxt\/.*@vite\/client.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'vite-client',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 24 * 60 * 60, // 1 day
            },
          },
        },
        {
          urlPattern: /\/_nuxt\/.*virtual.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'virtual-modules',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 24 * 60 * 60, // 1 day
            },
          },
        },
        {
          urlPattern: /__x00__plugin-vue:export-helper/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'vite-plugin-vue',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 24 * 60 * 60, // 1 day
            },
          },
        },
        {
          urlPattern: /__x00__.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'vite-plugins',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 24 * 60 * 60, // 1 day
            },
          },
        },
        {
          urlPattern: /\/_nuxt\/pages\/.*\.vue(\?.*)?$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'vue-pages',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        },
        {
          urlPattern: /.*\.vue\?macro=true$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'vue-macro-pages',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        },
        {
          // Catch all _nuxt requests for debugging
          urlPattern: /\/_nuxt\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'nuxt-catch-all',
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        },
        {
          urlPattern: /\/_nuxt\/@fs\/.*\.vue$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'node-modules-vue',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        },
        {
          urlPattern: /\/_nuxt\/builds\/meta\/.*\.json$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'nuxt-build-meta',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 24 * 60 * 60, // 1 day
            },
          },
        },
        {
          urlPattern: /.*\.(png|jpg|jpeg|gif|svg|webp)\?import$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'image-imports',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        },
        {
          urlPattern: /\/api\/session$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-session',
            expiration: {
              maxEntries: 5,
              maxAgeSeconds: 5 * 60, // 5 minutes
            },
            networkTimeoutSeconds: 3,
          },
        },
        {
          urlPattern: /\/_nuxt\/.*\.vue$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'vue-components',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        },
        {
          urlPattern: /\/_nuxt\/assets\/images\/.*\.(png|jpg|jpeg|gif|svg|webp)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'static-images',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
        {
          urlPattern: /\/_nuxt\/.*\/node_modules\/.*$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'node-modules',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        },
        {
          urlPattern: /\/favicon\.ico$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'favicon',
            expiration: {
              maxEntries: 5,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
        {
          urlPattern: /\/screenshots\/.*\.(png|jpg|jpeg|gif|svg|webp)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'screenshots',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
        {
          urlPattern: /^https?:.*\.(html)$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 24 * 60 * 60, // 1 day
            },
          },
        },
        {
          // Ultimate catch-all for offline fallback
          urlPattern: /.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'offline-fallback',
            expiration: {
              maxEntries: 1000,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
            },
          },
        }
      ]
    }
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
