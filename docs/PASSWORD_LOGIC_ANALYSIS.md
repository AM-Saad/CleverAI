# Password Logic - Comprehensive Analysis

**Date:** November 5, 2025  
**Scope:** Complete password flow analysis including registration, verification, reset, and authentication

---

## Table of Contents
1. [Flow Overview](#flow-overview)
2. [Critical Issues Found](#critical-issues-found)
3. [Security Vulnerabilities](#security-vulnerabilities)
4. [Logic Flaws](#logic-flaws)
5. [Email Template Issues](#email-template-issues)
6. [UX/UI Problems](#uxui-problems)
7. [Missing Features](#missing-features)
8. [Recommendations](#recommendations)

---

## Flow Overview

### 1. Registration Flow
```
User Registration → Email Verification → Password Creation (if needed) → Login
```

**Files Involved:**
- Frontend: `app/pages/auth/register.vue`, `app/composables/auth/useRegister.ts`
- Backend: `server/api/auth/register.post.ts`
- Email: `server/utils/resend.server.ts`, `server/api/templates/email/verification.ts`

**Current Process:**
1. User submits registration form (name, email, password, confirmPassword, phone, gender)
2. Backend hashes password with bcrypt
3. Generates 7-character verification code
4. Stores code in `register_verification` field
5. Sends verification email
6. Redirects to `/auth/verifyAccount?email={email}`

### 2. Email Verification Flow
```
Verification Email → Enter Code → Account Verified → Create Password (if no password) → Login
```

**Files Involved:**
- Frontend: `app/pages/auth/verifyAccount.vue`, `app/pages/auth/verifications.vue`
- Backend: `server/api/auth/verification/verify.post.ts`
- Component: `app/components/auth/createPassword.vue`

**Current Process:**
1. User enters verification code
2. Backend validates code against `register_verification`
3. Sets `email_verified = true`, clears `register_verification`
4. **If no password exists:** Generates new code, creates JWT token (1h expiry), stores in `password_verification`, redirects to create password page
5. **If password exists:** Redirects to sign in

### 3. Forgot Password Flow
```
Request Reset → Verification Code Email → Verify Code → Create New Password → Login
```

**Files Involved:**
- Frontend: `app/pages/auth/editPassword.vue`
- Backend: 
  - `server/api/auth/password/forgot.post.ts`
  - `server/api/auth/password/verify.post.ts`
  - `server/api/auth/password/create.post.ts`

**Current Process:**
1. User enters email on editPassword page
2. Backend validates user exists and `email_verified = true`
3. Generates verification code, stores in `password_verification`
4. Sends verification email (using `sendEmail()` not `sendPasswordResetEmail()`)
5. User enters code
6. Backend validates code, generates **NEW** code, creates JWT token (**1 minute expiry!**)
7. User redirected with token in query params
8. User creates new password within 1 minute window
9. Backend validates token, updates password, clears `password_verification`

### 4. Authentication Flow
```
Login → Validate Credentials → Check Account Status → Session Created
```

**Files Involved:**
- Frontend: `app/pages/auth/signin.vue`, `app/composables/auth/useLogin.ts`
- Backend: `server/api/auth/[...].ts` (NuxtAuth handler)

**Current Process:**
1. User submits email/password
2. Checks if user exists
3. Checks soft-delete status
4. Checks email verification
5. **If no password:** Generates verification code, stores in `password_verification`, shows error with link
6. Validates password with bcrypt
7. Creates session

---

## Critical Issues Found

### 🔴 CRITICAL SECURITY ISSUES

#### 1. **Wrong Email Template Used for Password Reset**
**Location:** `server/api/auth/password/forgot.post.ts:33`
```typescript
await sendEmail(parsed.email, code);
```

**Problem:** Uses `sendEmail()` which sends a **verification template**, not the password reset template. The `sendPasswordResetEmail()` function exists but is never used.

**Impact:** 
- User receives confusing "Email Verification" subject
- No reset link/URL provided
- Mismatched messaging ("verify your email" vs "reset password")
- Professional credibility damaged

**Fix Required:**
```typescript
// WRONG (current)
await sendEmail(parsed.email, code);

// CORRECT
await sendPasswordResetEmail(parsed.email, code);
```

#### 2. **Catastrophic Token Expiry (1 Minute)**
**Location:** `server/api/auth/password/verify.post.ts:37-40`
```typescript
const token = jwt.sign(
  { email: user.email, password_verification: newCode },
  process.env.AUTH_SECRET!,
  { expiresIn: "1m" }  // ⚠️ ONLY 1 MINUTE!
);
```

**Problem:** Password reset token expires in **1 minute**, but:
- User needs time to navigate to create password page
- User needs to type/confirm password
- Network latency, page loads, etc.
- Most users will fail

**Impact:** 
- Extremely high failure rate
- Users must restart entire flow
- Terrible UX
- Support burden

**Industry Standard:** 15 minutes to 1 hour

**Fix Required:**
```typescript
{ expiresIn: "15m" }  // Minimum 15 minutes
```

#### 3. **Double Password Hashing Bug**
**Location:** `server/api/auth/password/create.post.ts:31-32, 71`
```typescript
const hashedPassword = bcrypt.hashSync(parsed.password, 10);
console.log("Hashed password:", hashedPassword);  // Line 32

// ... 40 lines later ...

const hashedPassword = bcrypt.hashSync(parsed.password, 10);  // Line 71
```

**Problem:** Password is hashed **twice** in the same function with duplicate variable names.

**Impact:**
- First hash is computed but never used (wasted CPU)
- Confusing code
- Console.log exposes sensitive data in production

**Fix Required:**
```typescript
// Remove duplicate, keep only one hashing operation
// Remove console.log statements
```

#### 4. **Verification Code Regeneration Anti-Pattern**
**Location:** `server/api/auth/password/verify.post.ts:36-45`
```typescript
const newCode = await verificationCode();
const token = jwt.sign(
  { email: user.email, password_verification: newCode },
  process.env.AUTH_SECRET!,
  { expiresIn: "1m" }
);

await prisma.user.update({
  where: { email: parsed.email },
  data: { password_verification: newCode },
});
```

**Problem:** After user successfully verifies their code, the system:
1. Generates a **new** code
2. Stores it in the database
3. Embeds it in the JWT token

This creates a security vulnerability where the verification code changes after validation.

**Why This Is Dangerous:**
- Token contains different code than what user verified
- If token is intercepted, attacker has a fresh code
- Violates principle of least privilege
- Makes debugging harder

**Better Approach:** Use the verified code or generate a random session token.

#### 5. **Missing Password Validation**
**Location:** Multiple files

**Problem:** No password strength requirements enforced beyond length (8-30 chars).

**Missing Validations:**
- No uppercase requirement
- No lowercase requirement
- No number requirement
- No special character requirement
- Common password check
- Password breach check (Have I Been Pwned API)

**Impact:**
- Weak passwords like "password123" are accepted
- Account takeover risk
- Fails OWASP guidelines

#### 6. **Hardcoded Debug Hash in Production Code**
**Location:** `server/api/auth/[...].ts:95-96`
```typescript
const hashedPassword = bcrypt.hashSync('123456789', 10);
console.log("Hashed password:", hashedPassword);
```

**Problem:** Debug code left in production authentication handler.

**Impact:**
- Performance overhead on every login
- Console pollution
- Indicates poor code hygiene

### 🟡 HIGH PRIORITY LOGIC FLAWS

#### 7. **Countdown Timer Implementation Flaw**
**Location:** `app/pages/auth/editPassword.vue:60-62`
```typescript
const interval = setInterval(() => {
  if (countDown.value === 0) {
    clearInterval(interval);
    return;
  }
  countDown.value--;
}, emailsCount.value * 1000);  // ⚠️ BUG!
```

**Problem:** Interval delay multiplies by `emailsCount`, making countdown slower each resend:
- 1st send: 1000ms intervals (1 second) ✓
- 2nd send: 2000ms intervals (2 seconds) ✗
- 3rd send: 3000ms intervals (3 seconds) ✗

**Expected:** Should always be 1000ms

**Fix Required:**
```typescript
}, 1000);  // Always 1 second
```

**Same Bug Exists In:**
- `app/pages/auth/verifyAccount.vue:62`
- `app/pages/auth/verifications.vue:59`

#### 8. **Rate Limiting Missing for Password Reset**
**Location:** All password-related endpoints

**Problem:** No rate limiting on:
- Password reset requests
- Verification code attempts
- Email sending

**Impact:**
- Email bombing attacks possible
- Brute force verification codes (7 chars = ~3.5 trillion combinations, but still vulnerable)
- Account enumeration (can test which emails exist)
- Resource exhaustion

**Fix Required:** Implement rate limiting per IP and per email address.

#### 9. **Verification Code Expiry Missing**
**Location:** Database schema and validation logic

**Problem:** Verification codes (`register_verification`, `password_verification`) have no expiration timestamp.

**Impact:**
- Codes valid forever
- Old codes can be replayed
- Security window never closes
- Database bloat (codes never cleaned)

**Industry Standard:** 10-15 minute expiry

**Fix Required:**
- Add `register_verification_expires_at` field
- Add `password_verification_expires_at` field
- Validate expiry on verification
- Clean up expired codes

#### 10. **Email Enumeration Vulnerability**
**Location:** `server/api/auth/password/forgot.post.ts:25-27`
```typescript
const user = await prisma.user.findUnique({ where: { email: parsed.email } });
if (!user) {
  throw Errors.notFound("User");  // ⚠️ Information leak
}
```

**Problem:** Different error messages reveal if email exists:
- "User not found" = email not registered
- "Email not verified" = email registered but not verified
- "Reset code sent" = email registered and verified

**Impact:**
- Attackers can enumerate valid emails
- Privacy violation
- Targeted phishing campaigns

**Fix Required:** Always return same message regardless of email status:
```typescript
return success({ message: "If your email exists, you will receive a reset code" });
```

#### 11. **UI Shows Broken Submit Button**
**Location:** `app/pages/auth/editPassword.vue:147-158`

**Problem:** There's a submit button with validation checks (`isValidEmail && isValidPassword`) but:
1. These computed properties are not defined
2. Button appears to submit the verification code form, not the email form
3. Confusing dual-form structure

**Impact:**
- Button may not work
- Validation likely broken
- User confusion

#### 12. **Component vs Page Duplication**
**Location:** 
- `app/components/auth/createPassword.vue`
- `app/pages/auth/createPassword.vue`

**Problem:** Two nearly identical password creation implementations:
- Component uses `fetch()` directly with `/api/password/create`
- Page uses `$api.auth.createPassword()`
- Different error handling
- Different success messages
- Maintenance nightmare

**Impact:**
- Code duplication
- Inconsistent behavior
- Hard to maintain
- Which one is actually used?

---

## Email Template Issues

### ❌ Issue 1: Password Reset Template Never Used
**File:** `server/api/templates/email/password-reset.ts`

**Problem:** Beautiful password reset template exists with:
- Reset button
- Security notices
- Expiry warning
- Fallback URL

But it's **NEVER CALLED** in the forgot password flow!

### ❌ Issue 2: Wrong Expiry Time in Template
**File:** `server/api/templates/email/password-reset.ts:29`
```typescript
This password reset link will expire in 1 hour for security purposes.
```

**Problem:** Template says 1 hour, but actual token expires in **1 minute**.

### ❌ Issue 3: Template Says "Link" But Sends Code
**File:** `server/api/templates/email/password-reset.ts`

Template is designed for a **reset link/URL** workflow:
- Has "Reset Password" button
- Shows clickable URL
- Mentions "link expiry"

But current flow sends a **verification code** that user must manually type.

**Decision Needed:** Choose one approach:
1. **Link-based:** User clicks link → lands on reset page → enters new password
2. **Code-based:** User receives code → enters on separate page → verified → creates password

**Recommendation:** Link-based is better UX and security (prevents code interception).

### ❌ Issue 4: Email Expiry Message Mismatch
**File:** `server/api/templates/email/verification.ts:32`
```typescript
This verification code will expire in 10 minutes for security purposes.
```

**Problem:** Email says 10 minutes, but backend has no expiry enforcement.

### ❌ Issue 5: Email Environment Handling
**File:** `server/utils/resend.server.ts:66-73`

**Problem:** Development email redirection works, but:
- Always uses `process.env.RESEND_TEST_EMAIL`
- No fallback if not set
- No warning if email sending fails in dev

---

## UX/UI Problems

### 😕 Issue 1: Confusing Page Naming
- `editPassword.vue` - Actually handles "Forgot Password" flow, not "Edit Password"
- `createPassword.vue` - Used for both new accounts AND password resets
- `verifyAccount.vue` vs `verifications.vue` - Same functionality, different names

**Impact:** Developer confusion, hard to maintain

### 😕 Issue 2: Countdown Timer UX Issues
Multiple pages have countdown for resend:
```vue
Resend code in {{ countDown }}
```

**Problems:**
- No unit displayed (seconds? minutes?)
- Timer continues even if user leaves page
- Not persisted (refresh = reset)
- Countdown calculation bug (mentioned earlier)

### 😕 Issue 3: Success Message Timing
**Location:** `app/pages/auth/createPassword.vue:42`
```typescript
setTimeout(() => router.push("/auth/signIn"), 4000);
```

**Problems:**
- 4-second delay before redirect
- User can't skip
- No loading indicator
- User stuck staring at success message

**Better UX:** Auto-redirect after 2 seconds with skip button.

### 😕 Issue 4: Error Message HTML in API Responses
**Location:** `server/api/auth/[...].ts:128`
```typescript
throw new Error(
  `Password not set up. Please use the provider to login or create a password from <a class='font-bold' href='/auth/editPassword?newPassword=true'>here</a>`
);
```

**Problem:** Raw HTML in error messages:
- May not render correctly
- Security risk (XSS if not sanitized)
- Coupling backend with frontend styling
- Hard to translate/internationalize

**Better Approach:** Return error code + data, let frontend handle rendering.

### 😕 Issue 5: No Loading States in Some Forms
**Location:** `app/pages/auth/editPassword.vue`

**Problem:** First form (email entry) has loading state, but the button submission logic is unclear.

### 😕 Issue 6: Expired Token Messaging
When 1-minute token expires, user sees generic "Token has expired" error.

**Better UX:**
- "Your reset link has expired. Please request a new one."
- Auto-redirect to forgot password page
- Show timer warning before expiry

---

## Missing Features

### 🔧 Feature 1: Change Password (Authenticated Users)
**Status:** Missing entirely

**Problem:** No way for logged-in users to change their password.

**Required Flow:**
```
User Settings → Change Password → Enter Current Password → Enter New Password → Confirm → Update
```

**Files Needed:**
- `server/api/auth/password/change.post.ts`
- `app/pages/settings/password.vue`

### 🔧 Feature 2: Email Change with Verification
**Status:** Missing

**Problem:** Users cannot change their email address.

**Security Concern:** Email change should require:
1. Verify current password
2. Send verification to new email
3. Confirm verification
4. Update email

### 🔧 Feature 3: Password History
**Status:** Missing

**Problem:** Users can reuse old passwords.

**Security Best Practice:** Prevent reuse of last 5-10 passwords.

### 🔧 Feature 4: Account Lockout
**Status:** Missing

**Problem:** No protection against brute force attacks.

**Required:**
- Lock account after N failed login attempts
- Send email notification
- Require password reset to unlock
- Auto-unlock after time period

### 🔧 Feature 5: Session Management
**Status:** Unknown/Not visible

**Problem:** Cannot see:
- Active sessions
- Logout from other devices
- Login history
- Suspicious login alerts

### 🔧 Feature 6: Two-Factor Authentication
**Status:** Missing

**Recommendation:** Implement 2FA:
- TOTP (Google Authenticator, Authy)
- SMS backup
- Recovery codes

### 🔧 Feature 7: Password Reset Audit Log
**Status:** Missing

**Problem:** No tracking of:
- When password was reset
- From which IP
- How many times
- Success/failure

**Security Requirement:** Log all password-related actions.

### 🔧 Feature 8: Breached Password Detection
**Status:** Missing

**Recommendation:** Integrate with Have I Been Pwned API to reject compromised passwords.

---

## Recommendations

### Immediate Actions (Fix This Week)

1. **Fix Token Expiry**
   ```typescript
   // Change from 1m to 15m minimum
   { expiresIn: "15m" }
   ```

2. **Fix Email Template**
   ```typescript
   // In password/forgot.post.ts
   await sendPasswordResetEmail(parsed.email, code);
   ```

3. **Fix Countdown Timer Bug**
   ```typescript
   // All countdown implementations
   }, 1000);  // Not emailsCount * 1000
   ```

4. **Remove Debug Code**
   - Remove all `console.log` statements
   - Remove hardcoded hash generation

5. **Fix Double Hashing**
   - Remove duplicate hash operations

### Short Term (This Month)

6. **Add Verification Code Expiry**
   - Add expiry fields to schema
   - Implement validation
   - Add cleanup job

7. **Implement Rate Limiting**
   - Use Redis or in-memory rate limiter
   - Apply to all auth endpoints
   - Document limits

8. **Fix Email Enumeration**
   - Return generic messages
   - Same response time (use constant-time operations)

9. **Add Password Strength Validation**
   - Uppercase, lowercase, number, special char
   - Minimum entropy check
   - Common password blacklist

10. **Consolidate Duplicate Code**
    - Choose one createPassword implementation
    - Delete the other
    - Update references

### Medium Term (Next Quarter)

11. **Implement Link-Based Password Reset**
    - Generate unique reset tokens
    - Store in database with expiry
    - Use email template properly

12. **Add Change Password Feature**
    - For authenticated users
    - Require current password
    - Full validation

13. **Add Audit Logging**
    - Log all auth events
    - Include IP, timestamp, outcome
    - Retention policy

14. **Implement Account Lockout**
    - Failed attempt tracking
    - Progressive delays
    - Admin unlock capability

15. **Add Session Management UI**
    - View active sessions
    - Revoke sessions
    - Login history

### Long Term (6+ Months)

16. **Two-Factor Authentication**
    - TOTP implementation
    - Recovery codes
    - SMS backup (optional)

17. **Breached Password Detection**
    - Have I Been Pwned integration
    - Proactive user notification

18. **Password History**
    - Store hashed history
    - Prevent reuse

19. **Internationalization**
    - Translate all messages
    - Localized email templates

20. **Comprehensive Testing**
    - Unit tests for all flows
    - Integration tests
    - E2E tests
    - Security testing

---

## Security Checklist

- [ ] Token expiry is reasonable (15m - 1h)
- [ ] Verification codes expire (10-15 minutes)
- [ ] Rate limiting on all auth endpoints
- [ ] No email enumeration
- [ ] Strong password requirements
- [ ] Password breach checking
- [ ] Account lockout after failed attempts
- [ ] Audit logging for password changes
- [ ] Secure token generation (cryptographic random)
- [ ] HTTPS only (no plain HTTP)
- [ ] Secure cookies (httpOnly, secure, sameSite)
- [ ] CSRF protection
- [ ] XSS prevention (sanitize all inputs)
- [ ] SQL injection prevention (using ORM)
- [ ] Email verification before password reset
- [ ] No sensitive data in logs
- [ ] Error messages don't leak information
- [ ] Password reset links are single-use
- [ ] Old sessions invalidated on password change

---

## Testing Recommendations

### Manual Testing Checklist

#### Registration Flow
- [ ] Register with valid data
- [ ] Register with existing email (should fail)
- [ ] Register without required fields (should fail)
- [ ] Password mismatch (should fail)
- [ ] Weak password (should fail with new validation)
- [ ] Receive verification email
- [ ] Email contains correct code
- [ ] Code works within time limit
- [ ] Code doesn't work after expiry
- [ ] Code doesn't work twice

#### Password Reset Flow
- [ ] Request reset for valid email
- [ ] Request reset for invalid email (should show generic message)
- [ ] Request reset for unverified email (should fail)
- [ ] Receive reset email with correct template
- [ ] Reset link/code works within time limit
- [ ] Reset link/code expires correctly
- [ ] Can create new password
- [ ] New password works for login
- [ ] Old password doesn't work

#### Login Flow
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Login with unverified email (should show verification prompt)
- [ ] Login without password set (should show password creation prompt)
- [ ] Login with soft-deleted account (should show reactivation prompt)

#### Edge Cases
- [ ] Multiple verification emails (countdown works)
- [ ] Browser back button during flows
- [ ] Page refresh during flows
- [ ] Network errors during submission
- [ ] Extremely long inputs
- [ ] Special characters in password
- [ ] Unicode in email/name

---

## Conclusion

The password logic has **multiple critical security vulnerabilities** and **logic flaws** that need immediate attention. The most severe issues are:

1. ⚠️ **1-minute token expiry** (makes password reset nearly impossible)
2. ⚠️ **Wrong email template** (confuses users, unprofessional)
3. ⚠️ **No verification code expiry** (security hole)
4. ⚠️ **No rate limiting** (abuse vector)
5. ⚠️ **Email enumeration** (privacy concern)

These issues should be addressed **immediately** before proceeding with new features.

The codebase also has **technical debt** issues:
- Code duplication (2 createPassword implementations)
- Debug code in production
- Inconsistent naming
- Missing features (change password, 2FA, etc.)

**Estimated Effort:**
- Critical fixes: 2-3 days
- Short-term improvements: 1-2 weeks  
- Medium-term features: 1 month
- Long-term security hardening: 2-3 months

**Priority:** 🔴 **HIGH - Address critical issues immediately**
