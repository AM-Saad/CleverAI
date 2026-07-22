# Application surfaces

Cognilo is one installed PWA and one public origin with three independently
deployable processes:

- **Platform** owns authentication, the app launcher, account/settings,
  subscriptions, the manifest, and the root service worker.
- **Daily** owns `/day/**` and `/api/daily/**`.
- **Learning** owns the learning home, workspaces, materials, language tools,
  flashcards, and review routes/APIs.

The default `yarn dev` and `yarn build` keep the modular monolith available for
simple local work. The split topology can be run in separate terminals:

```sh
yarn dev:platform
yarn dev:daily
yarn dev:learning
```

The Platform process listens on port 8080 and proxies Daily to 8081 and
Learning to 8082. Use `DAILY_UPSTREAM` and `LEARNING_UPSTREAM` while building,
or Nuxt's `NUXT_DAILY_UPSTREAM` and `NUXT_LEARNING_UPSTREAM` variables to
override the endpoints when starting an existing production build. Because
browsers only see the Platform origin, the processes share the same
authentication cookie and the PWA remains a single install.

Surface builds use independent Nuxt and Nitro output directories:

```sh
yarn build:platform
yarn build:daily
yarn build:learning
```

Daily remains usable from IndexedDB when its process is unavailable. The root
service worker treats proxy gateway failures as navigation failures and serves
the cached application shell; queued Daily commands synchronize when the
process returns.
