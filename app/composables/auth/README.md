# Auth Composables Guide

This directory provides composables for authentication and verification flows. Core goals:
- Consistent UX for email + password verification steps
- Centralized resend throttling, attempts, cooldown visuals
- Clear separation between multi-step verification flows and one-off submission flows

## Overview

| Flow | Composable | Purpose | Includes resend/throttle? | Uses base factory? |
|------|------------|---------|---------------------------|--------------------|
| Email account verification | `useEmailVerification` | Send + verify account code | Yes | Yes (`createVerificationFlow`) |
| Password reset verification | `usePasswordResetVerification` | Send + verify reset code (obtain token) | Yes | Yes (`createVerificationFlow`) |
| Password creation (new/reset) | `useCreatePassword` | Submit password with issued token | No | No |

## When to Use Which

Use `useEmailVerification` when the user must validate email ownership for account activation.
Use `usePasswordResetVerification` when the user is resetting a password and needs a code to obtain a password creation token.
Use `useCreatePassword` only after you have a valid JWT/token (first-set or reset) and you want to collect and submit the new password.

## Base Factory vs Standalone

`createVerificationFlow` (in `_verificationBase.ts`) centralizes:
- State: `{ emailSent, emailsCount, seconds, remainingAttempts, verified, token, credentials }`
- Actions: `handleSendEmail`, `handleSubmit`, `submitForm`
- Throttle: integrates `useResendThrottle` for cooldown persistence, attempt exhaustion UI, progress percent

You SHOULD use the base factory when:
1. There are two phases: (a) send code, (b) verify code.
2. You need resend throttling, remaining attempts, or persistence across reloads.
3. You want a shared shape across multiple verification flows.

You SHOULD NOT use the base factory when:
1. The flow is a single submit (e.g. password creation with a token).
2. There is no resend or attempts concept.

## Mini Flow Chart

```text
         ┌────────────────────┐
         │ Need code + verify?│
         └─────────┬──────────┘
                   │ Yes
                   v
        ┌────────────────────────────┐
        │ Use createVerificationFlow │
        └─────────┬──────────────────┘
                  │
      ┌───────────┴───────────┐
      v                       v
useEmailVerification   usePasswordResetVerification

                   │ No
                   v
            useCreatePassword
```

## Throttling & Attempts
All verification flows rely on `useResendThrottle`:
- `canResend`: countdown complete AND attempts not exhausted
- `inlineHintVisible`: attempts exhausted AND countdown still running
- `showToast`: attempts exhausted while cooling down (for toast component)
- `progressPercent`: (elapsed / total) * 100 used for ring & bar UI
- Persistence: sessionStorage keyed by `persistKey` (e.g. `verify-throttle`, `reset-throttle`)

## Adding a New Code Verification Flow
1. Implement API endpoints that return: `{ message, resetSeconds?, remainingAttempts?, redirect?, token? }`.
2. Create a thin composable wrapping `createVerificationFlow` with proper `send` and `verify` functions.
3. Decide if `onVerifySuccess` should handle token persistence or redirects.
4. Wire page/component state using the returned properties.
5. Add a unique `persistKey` if you want cooldown persistence.

Example skeleton:
```ts
import { createVerificationFlow } from '@/composables/auth/_verificationBase'
import { useNuxtApp } from '#app'
export function useMagicLinkVerification() {
  const { $api } = useNuxtApp()
  return createVerificationFlow({
    send: (email) => $api.auth.sendMagicLink(email),
    verify: (email, code) => $api.auth.verifyMagicLink(email, code),
    persistKey: 'magiclink-throttle',
    initialSeconds: 0,
    onVerifySuccess: (payload, { router }) => {
      if (payload.redirect) router.push(payload.redirect)
    }
  })
}
```

## Common Gotchas
- Ensure resend functions return a `Result<T>` with `resetSeconds` & `remainingAttempts` so throttle updates immediately.
- Avoid local additive countdown logic if server provides authoritative `resetSeconds`—keep logic server-centric when possible.
- When adding new flows, name `persistKey` uniquely to avoid shared cooldown collisions across pages.

## Future Improvements
- Extract a smaller standalone submit base for pure single-step flows (low priority).
- Add automated vitest specs for `createVerificationFlow` throttle persistence and attempt exhaustion transitions.
- Consider server-provided dynamic attempt windows (e.g. sliding rate-limit or per-model limits) unified in responses.

## Deprecations
- `usePasswordReset` removed; replaced by `usePasswordResetVerification`.
- `useVerifyPasswordCode` legacy stub slated for removal; not required with new verification base.

## Reference Types
Minimal expected shape from send endpoint:
```ts
interface SendResponse {
  message: string
  remainingAttempts?: number
  resetSeconds?: number
}
```

Minimal expected shape from verify endpoint:
```ts
interface VerifyResponse {
  message: string
  redirect?: string
  token?: string
}
```

Keep responses normalized to reduce enumeration risk (avoid revealing user existence state differences).

---
Last updated: autogenerated during refactor consolidation.
