// https://nuxt.com/docs/api/configuration/nuxt-config
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import vueDevTools from "vite-plugin-vue-devtools";

const isDevelopment = process.env.NODE_ENV === "development";
const railwayDomain =
  process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
const railwayBaseUrl = railwayDomain
  ? railwayDomain.startsWith("http")
    ? railwayDomain
    : `https://${railwayDomain}`
  : undefined;
const appBaseUrl =
  process.env.APP_BASE_URL ||
  process.env.AUTH_ORIGIN ||
  process.env.SERVER_URL ||
  railwayBaseUrl ||
  (isDevelopment ? "http://localhost:8080" : "");
const serverUrl = process.env.SERVER_URL || appBaseUrl;
const appSurface = process.env.APP_SURFACE || "all";
const dailyUpstream = process.env.DAILY_UPSTREAM || "http://127.0.0.1:8081";
const learningUpstream =
  process.env.LEARNING_UPSTREAM || "http://127.0.0.1:8082";
const surfacePort =
  appSurface === "daily" ? 24679 : appSurface === "learning" ? 24680 : 24678;
const proxyRules =
  appSurface === "platform"
    ? {
        "/day": { proxy: `${dailyUpstream}/day` },
        "/day/**": { proxy: `${dailyUpstream}/day/**` },
        "/api/daily/**": { proxy: `${dailyUpstream}/api/daily/**` },
        "/learn": { proxy: `${learningUpstream}/learn` },
        "/learn/**": { proxy: `${learningUpstream}/learn/**` },
        "/language": { proxy: `${learningUpstream}/language` },
        "/language/**": { proxy: `${learningUpstream}/language/**` },
        "/materials": { proxy: `${learningUpstream}/materials` },
        "/materials/**": { proxy: `${learningUpstream}/materials/**` },
        "/review": { proxy: `${learningUpstream}/review` },
        "/review/**": { proxy: `${learningUpstream}/review/**` },
        "/workspaces": { proxy: `${learningUpstream}/workspaces` },
        "/workspaces/**": { proxy: `${learningUpstream}/workspaces/**` },
        "/api/language": { proxy: `${learningUpstream}/api/language` },
        "/api/language/**": { proxy: `${learningUpstream}/api/language/**` },
        "/api/materials": { proxy: `${learningUpstream}/api/materials` },
        "/api/materials/**": { proxy: `${learningUpstream}/api/materials/**` },
        "/api/review": { proxy: `${learningUpstream}/api/review` },
        "/api/review/**": { proxy: `${learningUpstream}/api/review/**` },
        "/api/workspaces": { proxy: `${learningUpstream}/api/workspaces` },
        "/api/workspaces/**": {
          proxy: `${learningUpstream}/api/workspaces/**`,
        },
        "/api/questions": { proxy: `${learningUpstream}/api/questions` },
        "/api/questions/**": { proxy: `${learningUpstream}/api/questions/**` },
        "/api/flashcards": { proxy: `${learningUpstream}/api/flashcards` },
        "/api/flashcards/**": {
          proxy: `${learningUpstream}/api/flashcards/**`,
        },
        "/api/workspace-integrations": {
          proxy: `${learningUpstream}/api/workspace-integrations`,
        },
        "/api/workspace-integrations/**": {
          proxy: `${learningUpstream}/api/workspace-integrations/**`,
        },
      }
    : {};

if (
  process.env.NODE_ENV === "production" &&
  !process.env.NUXT_AUTH_SECRET &&
  !process.env.RAILWAY_ENVIRONMENT
) {
  console.warn(
    "[WARN] NUXT_AUTH_SECRET not present at build time (expected on Railway).",
  );
}
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: isDevelopment },
  debug: isDevelopment,
  // Use the existing `app/` workspace as Nuxt source directory
  srcDir: "app",
  buildDir: appSurface === "all" ? ".nuxt" : `.nuxt-${appSurface}`,
  routeRules: proxyRules,

  // System by default; users switch via UiColorModeToggle (light/dark/system).
  // Dark tokens live in app/design-system/tokens/index.cjs and flip under .dark.
  colorMode: {
    preference: "system",
    fallback: "light",
  },

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
  // Fonts are loaded by the existing stylesheet link. Never download remote
  // font assets during a production build; builds must be network-independent.
  fonts: {
    providers: {
      adobe: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      google: false,
      googleicons: false,
    },
    families: [
      { name: "Saira", provider: "none" },
      { name: "Nunito", provider: "none" },
    ],
  },
  // App icons are local SVGs in a sprite; @nuxt/icon exists only for Nuxt UI's
  // own internal `i-lucide-*` defaults (select chevrons, checkbox ticks, ...).
  // Inline those into the client bundle: the server-bundle route would be an
  // `/api/` call, and the service worker deliberately never caches `/api/`, so
  // they would break offline. `scan` also walks Nuxt UI's runtime templates.
  // Nuxt UI's defaults live in node_modules, which `scan` does not walk, so they
  // are listed explicitly. Regenerate with:
  //   grep -rho "i-lucide-[a-z0-9-]*" node_modules/@nuxt/ui/dist/ | sort -u
  icon: {
    clientBundle: {
      icons: [
        "lucide:arrow-down",
        "lucide:arrow-left",
        "lucide:arrow-right",
        "lucide:arrow-up",
        "lucide:arrow-up-right",
        "lucide:check",
        "lucide:chevron-down",
        "lucide:chevron-left",
        "lucide:chevron-right",
        "lucide:chevron-up",
        "lucide:chevrons-left",
        "lucide:chevrons-right",
        "lucide:circle-alert",
        "lucide:circle-check",
        "lucide:circle-x",
        "lucide:copy",
        "lucide:copy-check",
        "lucide:ellipsis",
        "lucide:eye",
        "lucide:eye-off",
        "lucide:file",
        "lucide:folder",
        "lucide:folder-open",
        "lucide:grip-vertical",
        "lucide:hash",
        "lucide:info",
        "lucide:lightbulb",
        "lucide:loader-circle",
        "lucide:menu",
        "lucide:minus",
        "lucide:monitor",
        "lucide:moon",
        "lucide:panel-left-close",
        "lucide:panel-left-open",
        "lucide:plus",
        "lucide:rotate-ccw",
        "lucide:search",
        "lucide:square",
        "lucide:sun",
        "lucide:terminal",
        "lucide:triangle-alert",
        "lucide:upload",
        "lucide:x",
      ],
      scan: true,
    },
  },
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
          "AUTH_ORIGIN",
          "VAPID_PUBLIC_KEY",
          "VAPID_PRIVATE_KEY",
          "SENDGRID_API_KEY",
          "AUTH_SECRET",
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "DATABASE_URL",
          "SW",
          "OPENROUTER_API_KEY",
        ];
        const missing = required.filter(
          (k) => !process.env[k as keyof NodeJS.ProcessEnv],
        );
        if (missing.length) {
          console.warn(
            "[env] Missing variables in development:",
            missing.join(", "),
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
      title: "Cognilo | Your AI-powered Learning Assistant",
      meta: [
        {
          name: "description",
          content:
            "Cognilo is your AI-powered learning assistant, designed to help you learn more effectively and efficiently.",
        },
        { name: "theme-color", content: "#f3f4f6" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "Cognilo" },
        { name: "msapplication-TileColor", content: "#f3f4f6" },
        {
          name: "msapplication-TileImage",
          content: "/AppImages/windows11/Square150x150Logo.scale-200.png",
        },
        { name: "msapplication-config", content: "/browserconfig.xml" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "application-name", content: "Cognilo" },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Saira:ital,wght@0,100..900;1,100..900&display=swap",
        },
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
          // Predictionary word-prediction library — self-hosted, client-side only
          src: "/scripts/vendor/predictionary.js",
          defer: true,
          tagPosition: "bodyClose",
        },
        {
          type: "application/ld+json",
          innerHTML: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Cognilo",
            url: "https://cognilo.app",
            logo: "https://cognilo.app/logo.png",
            description:
              "Cognilo is an AI-powered spaced repetition learning platform offering adaptive flashcards, offline learning, and personalized study schedules.",
          }),
        },
      ],
    },
  },
  appConfig: {
    // toaster: {
    //   position: "bottom-center" as const,
    //   duration: 5000,
    //   max: 5,
    //   expand: true,
    // },
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
    output:
      appSurface === "all"
        ? undefined
        : { dir: resolve(__dirname, `.output/${appSurface}`) },
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
        port: surfacePort,
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
    plugins: [tailwindcss(), vueDevTools()],
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
    },
  },
  ssr: false,
  // routeRules: {
  //   "/about": { prerender: true },
  //   "/": { prerender: true },
  //   "/pricing": { prerender: true },

  //   "/auth/**": { ssr: false },
  //   "/settings/**": { ssr: false },
  //   "/review/**": { ssr: false },
  //   "/workspaces/**": { ssr: false },
  // },
  css: ["~/assets/css/main.css"],

  typescript: {
    shim: true,
  },
  runtimeConfig: {
    // Server-only
    redisUrl: process.env.REDIS_URL,
    openrouterKey: process.env.OPENROUTER_API_KEY,
    openrouterModel: process.env.OPENROUTER_MODEL || "openrouter/auto",
    openrouterTimeoutMs: process.env.OPENROUTER_TIMEOUT_MS || "45000",
    databaseUrl: process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,

    // Auth / secrets (server only)
    auth: {
      secret:
        process.env.NUXT_AUTH_SECRET ||
        process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET,
    },
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    jiraClientId: process.env.JIRA_CLIENT_ID,
    jiraClientSecret: process.env.JIRA_CLIENT_SECRET,
    notionClientId: process.env.NOTION_CLIENT_ID,
    notionClientSecret: process.env.NOTION_CLIENT_SECRET,
    integrationTokenSecret: process.env.INTEGRATION_TOKEN_SECRET,
    appSurface,
    dailyUpstream,
    learningUpstream,

    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,

    // Public (exposed to client)
    public: {
      AUTH_ORIGIN: process.env.AUTH_ORIGIN || appBaseUrl,
      APP_BASE_URL: appBaseUrl,
      SERVER_URL: serverUrl,
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
      APPLIXIR_SITE_ID: process.env.APPLIXIR_SITE_ID,
      notesCollabEnabled:
        process.env.NUXT_PUBLIC_NOTES_COLLAB_ENABLED === "true",
      collabWsUrl:
        process.env.NUXT_PUBLIC_COLLAB_WS_URL || "ws://127.0.0.1:1234",
      // Single dev toggle for the app service worker.
      // Production always enables the service worker regardless of this flag.
      serviceWorkerEnabledInDev:
        process.env.NUXT_PUBLIC_SERVICE_WORKER_IN_DEV === "true",
      // Can be set to "false" to hold the new local-first runtime during a
      // staged rollout. It defaults on for this pre-user environment.
      offlineV2: process.env.NUXT_PUBLIC_OFFLINE_V2 !== "false",
      appSurface,
    },
  },
});
