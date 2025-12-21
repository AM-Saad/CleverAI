

# Deployment Bugs & Fixes – cleverAI (Nuxt + Railway + sidebase-auth)

This document records all major deployment and authentication issues encountered while deploying cleverAI to Railway, including their real root causes and the exact fixes applied.

The goal is to prevent regressions and make future debugging significantly faster.

---

## 1. `/api/auth/session` returning 500 (UNHANDLED_ERROR)

### Symptoms
- `/api/auth/session` returned `500 Internal Server Error`
- Frontend failed during app initialization
- Nuxt logged:
  ```
  [GET] "/api/auth/session": 500
  ```
- Browser console spammed fetch errors

### Root Cause
Authentication session logic (`getServerSession`, `safeGetServerSession`, `requireAuth`) was executed inside **global Nitro server middleware**.

Nitro middleware runs **before API routes are registered**.  
`@sidebase/nuxt-auth` requires the auth handler to be fully mounted before session access.

This caused:
```
Tried to get server session without setting up an endpoint to handle authentication
```

### Fix
- Removed all auth/session access from `server/middleware/*`
- Enforced authentication only inside:
  - API route handlers
  - Client route middleware (`app/middleware/*.ts`) using `useAuth()`

---

## 2. Nitro plugin swallowing auth errors

### Symptoms
- Errors were inconsistent and hard to trace
- Logs showed `UNHANDLED_ERROR` without useful context

### Root Cause
A Nitro plugin (`server/plugins/session-error-handler.ts`) intercepted errors globally using:

```ts
nitroApp.hooks.hook("error", ...)
```

It matched auth-related error messages and returned early, suppressing control-flow errors intentionally thrown by auth.js.

Auth.js relies on thrown errors internally. Catching them globally breaks its lifecycle.

### Fix
- Removed the plugin entirely (or reduced it to pure logging only)
- Allowed auth errors to propagate naturally

---

## 3. Missing `next-auth` dependency

### Symptoms
- Nuxt build failed with:
  ```
  Cannot find package 'next-auth'
  ```

### Root Cause
`@sidebase/nuxt-auth` requires `next-auth` as a peer dependency when using the `authjs` provider.

### Fix
Installed the required peer dependency and updated the lockfile:

```bash
yarn add next-auth@~4.21.1
```

---

## 4. Prisma schema not found during Docker build

### Symptoms
- Docker build failed with:
  ```
  Provided --schema at server/prisma/schema.prisma doesn't exist
  ```

### Root Cause
The Prisma schema was copied **after** dependency installation and client generation.

### Fix
- Moved schema to the canonical location: `/prisma/schema.prisma`
- Updated Dockerfile order:

```dockerfile
COPY prisma ./prisma
RUN yarn install
RUN npx prisma generate
```

---

## 5. `AUTH_NO_SECRET` error in production

### Symptoms
- `/api/auth/session` still returned 500
- Logs showed:
  ```
  AUTH_NO_SECRET: No `secret` - this is an error in production
  ```

### Root Cause
The authentication secret existed as an environment variable, but **was wired to the wrong runtimeConfig key**.

Sidebase expects:
```ts
runtimeConfig.auth.secret
```

The project previously used:
```ts
runtimeConfig.nuxtAuthSecret
```

### Fix
Updated `nuxt.config.ts`:

```ts
runtimeConfig: {
  auth: {
    secret:
      process.env.NUXT_AUTH_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET,
  },
}
```

Ensured a single valid secret exists in Railway:

```env
NUXT_AUTH_SECRET=<long-random-string>
```

---

## 6. Railway build vs runtime environment mismatch

### Symptoms
- Build failed with:
  ```
  NUXT_AUTH_SECRET is missing in production environment
  ```

### Root Cause
Railway separates **build-time** and **runtime** environments.  
Secrets are injected at runtime only, unless explicitly exposed.

A strict build-time guard incorrectly assumed runtime env availability.

### Fix
Made the guard Railway-aware:

```ts
if (
  process.env.NODE_ENV === "production" &&
  !process.env.NUXT_AUTH_SECRET &&
  !process.env.RAILWAY_ENVIRONMENT
) {
  console.warn(
    "[WARN] NUXT_AUTH_SECRET not present at build time (expected on Railway)."
  );
}
```

---

## 7. Confusion around routes without `/api`

### Symptoms
- Visiting `/folders` triggered auth/session requests
- Confusing because URL did not include `/api`

### Root Cause
Routes like `/folders/**` had SSR disabled:

```ts
routeRules: {
  "/folders/**": { ssr: false },
}
```

Client-side boot initializes sidebase, which always calls `/api/auth/session`.

### Fix
No fix required. This is expected behavior.

---

## Final State

- `/api/auth/session` returns 200
- No `AUTH_NO_SECRET` errors
- No Nitro lifecycle violations
- No swallowed auth errors
- Prisma, Docker, and build pipelines stable
- Railway deployment healthy

---

## Key Lessons

- Never access auth session in Nitro middleware
- Never intercept auth errors globally
- Always wire secrets through `runtimeConfig.auth.secret`
- Railway build-time ≠ runtime environment
- Sidebase errors are precise and meaningful

---

**Status:** ✅ RESOLVED  
**Deployment:** ✅ LIVE