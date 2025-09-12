Quick validation steps for injected service worker (for reviewers / CI)

1) After the workflow runs, download the `sw-js` artifact from the workflow run.
2) Inspect the file to confirm `precacheAndRoute` has a large injected array. Search for `precacheAndRoute([` or `_nuxt/` entries.
3) Optional: start a preview server locally and check registration:
   - Build locally with `yarn build:inject`
   - Start preview: `yarn preview` (or `nuxt preview`)
   - Open Chrome DevTools -> Application -> Service Workers and verify `/sw.js` is registered and the precache is present.
4) Test offline: with the worker controlling the page, set Network -> Offline and refresh; verify pages and critical assets are served from cache.

If the artifact doesn't include the precache manifest, run `node scripts/inject-sw.cjs` locally against `.output/public` and report the output logs.
