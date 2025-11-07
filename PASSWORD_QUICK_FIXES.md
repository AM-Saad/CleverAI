# Password Flow - Quick Fixes Needed

## Issues Found (Minimal Changes Required)

### 1. ❌ **CRITICAL: Wrong Email Function Used**
**File**: `server/api/auth/password/forgot.post.ts` (line 33)

**Issue**: Using `sendEmail()` which sends verification email template, not password reset email

**Current**:
```typescript
await sendEmail(parsed.email, code);
```

**Fix**:
```typescript
await sendPasswordResetEmail(parsed.email, code);
```

**Impact**: Users receive wrong email template (verification instead of password reset)

---

### 2. ❌ **CRITICAL: Wrong URL in Email Template**
**File**: `server/api/templates/email/password-reset.ts` (line 14)

**Issue**: Email links to `/auth/reset-password` which doesn't exist

**Current**:
```typescript
const finalResetUrl = customResetUrl || `${brandInfo.websiteUrl}/auth/reset-password?token=${resetToken}`
```

**Fix**:
```typescript
const finalResetUrl = customResetUrl || `${brandInfo.websiteUrl}/auth/editPassword?token=${resetToken}`
```

**Impact**: Users get 404 when clicking email link

---

### 3. ⚠️ **Security: Email Enumeration Vulnerability**
**File**: `server/api/auth/password/forgot.post.ts` (lines 23-28)

**Issue**: Returns error if user doesn't exist, revealing account existence

**Current**:
```typescript
const user = await prisma.user.findUnique({ where: { email: parsed.email } });
if (!user) {
  throw Errors.notFound("User");
}
if (!user.email_verified) {
  throw Errors.badRequest("Email not verified");
}
```

**Fix**: Always return success message
```typescript
const user = await prisma.user.findUnique({ where: { email: parsed.email } });
if (!user || !user.email_verified) {
  // Return success but don't send email
  return success({
    message: "If an account exists with this email, a password reset code has been sent",
    redirect: "/auth/editPassword",
  });
}
```

**Impact**: Attackers can enumerate registered emails

---

### 4. 🐛 **Broken Countdown Timer**
**File**: `app/pages/auth/editPassword.vue` (line 59)

**Issue**: Interval multiplied by emailsCount, making it extremely slow

**Current**:
```typescript
const interval = setInterval(() => {
  if (countDown.value === 0) {
    clearInterval(interval);
    return;
  }
  countDown.value--;
}, emailsCount.value * 1000);
```

**Fix**:
```typescript
const interval = setInterval(() => {
  if (countDown.value === 0) {
    clearInterval(interval);
    return;
  }
  countDown.value--;
}, 1000); // Always 1 second
```

**Impact**: After 2nd resend, countdown takes 2 seconds per tick (very slow)

---

### 5. ⚠️ **JWT Token Expires Too Fast**
**File**: `server/api/auth/password/verify.post.ts` (line 36)

**Issue**: Token expires in 1 minute, too short for users

**Current**:
```typescript
const token = jwt.sign(
  { email: user.email, password_verification: newCode },
  process.env.AUTH_SECRET!,
  { expiresIn: "1m" }
);
```

**Fix**:
```typescript
const token = jwt.sign(
  { email: user.email, password_verification: newCode },
  process.env.AUTH_SECRET!,
  { expiresIn: "15m" } // 15 minutes
);
```

**Impact**: Users have only 60 seconds to create password before token expires

---

### 6. 🔧 **URL Parameter Not Pre-filled**
**File**: `app/pages/auth/editPassword.vue` (line 26)

**Issue**: Email link includes `?token=CODE` but code field not pre-filled

**Current**: Only email is pre-filled from query params

**Fix**: Add token pre-fill in onMounted:
```typescript
onMounted(() => {
  if (route.query.email) {
    credentials.value.email = route.query.email as string;
  }
  if (route.query.token && !verified.value) {
    credentials.value.verification = route.query.token as string;
    emailSent.value = true; // Show verification form
  }
});
```

**Impact**: Users have to manually type code even though it's in the URL

---

## Priority Order

1. **Fix #1** - Wrong email function (CRITICAL - breaks entire flow)
2. **Fix #2** - Wrong URL in template (CRITICAL - 404 error)
3. **Fix #4** - Countdown timer (UX issue, easy fix)
4. **Fix #6** - Pre-fill verification code (UX improvement)
5. **Fix #5** - Token expiry (annoying but not breaking)
6. **Fix #3** - Email enumeration (security, but requires careful testing)

---

## Estimated Time
- Fixes #1-2: 2 minutes
- Fix #4: 1 minute
- Fix #6: 3 minutes
- Fix #5: 1 minute
- Fix #3: 5 minutes (need to test flow)

**Total**: ~15 minutes for all fixes
