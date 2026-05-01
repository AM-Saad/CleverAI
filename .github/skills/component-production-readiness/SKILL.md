---
name: component-production-readiness
description: "Audit and fix Vue components for production-readiness beyond layout: accessibility (ARIA attributes, keyboard navigation, focus states), touch target sizing, screen reader support, interactive element semantics. Use when: checking accessibility before release, fixing missing aria-label or role attributes, ensuring keyboard navigability, auditing touch targets for mobile, finding div click handlers that should be buttons, adding focus-visible states, checking interactive elements for a11y compliance, production-readiness review, WCAG compliance check."
argument-hint: "Component or page to audit (e.g. app/components/shared/CreditsWallet.vue)"
---

# Component Production Readiness

Audits and fixes Vue components for accessibility (ARIA, keyboard navigation, focus states, screen reader semantics) and touch target sizing. Ensures production quality beyond visual layout.

## When to Use

- Pre-release accessibility audit
- A component has `@click` on a non-interactive element (`div`, `span`, `li`)
- Keyboard navigation is broken or untested
- Touch targets feel too small on mobile
- New interactive component needs ARIA attributes
- Screen reader is not announcing content correctly

## Reference Files

| File | Purpose |
|------|---------|
| [app/DESIGN.md](../../app/DESIGN.md) | Touch target rules, interactive states |
| [app/assets/css/main.css](../../app/assets/css/main.css) | Focus ring tokens |
| [app/composables/ui/useResponsive.ts](../../app/composables/ui/useResponsive.ts) | `isMobile` for conditional touch-target sizing |

## Procedure

### 1. Scan for Violations

Run these grep commands on the target file or directory:

```bash
# div/span/li with click handlers (should be <button> or have role)
grep -n '@click\|v-on:click' <file> | grep -v '<button\|<a \|<router\|<NuxtLink'

# Buttons with no accessible label
grep -n '<button' <file>
# Then check: does each button have visible text, aria-label, or aria-labelledby?

# Images with empty or missing alt
grep -n '<img' <file> | grep -v 'alt='

# Form inputs missing label association
grep -n '<input\|<textarea\|<select' <file>

# Interactive elements missing focus-visible
grep -n 'focus-visible\|focus:ring\|focus:outline' <file>

# Roles and aria attributes present
grep -n 'role=\|aria-' <file>
```

### 2. Classify Issues by Severity

| Severity | Issue | Example |
|----------|-------|---------|
| 🔴 **Critical** | Click handler on non-semantic element — no keyboard access | `<div @click="...">` with no `role` or `tabindex` |
| 🔴 **Critical** | Form input with no associated label | `<input>` with no `<label for>` or `aria-label` |
| 🟠 **High** | Icon-only button with no label | `<button><Icon /></button>` no `aria-label` |
| 🟠 **High** | Missing focus-visible state | Interactive element with no `focus-visible:` class |
| 🟡 **Medium** | Image with empty alt on informational image | `<img alt="">` on non-decorative image |
| 🟡 **Medium** | Touch target below 44px | `<button class="p-1">` — 8px padding ≈ 24px tall |
| 🟢 **Low** | Missing `aria-live` on dynamic content regions | Status updates not announced to screen readers |

### 3. Fix Patterns

#### 3a. Replace `div @click` with `<button>`

```vue
<!-- ❌ Not keyboard-accessible -->
<div @click="selectPack(pack.id)" class="cursor-pointer p-4">
  {{ pack.name }}
</div>

<!-- ✅ Semantic + keyboard accessible -->
<button
  type="button"
  class="p-4 text-left w-full focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none"
  :aria-label="`Select ${pack.name} credits pack`"
  @click="selectPack(pack.id)"
>
  {{ pack.name }}
</button>
```

If a visual button reset is undesirable, use `role="button"` + `tabindex="0"` + `@keydown.enter` + `@keydown.space`:

```vue
<div
  role="button"
  tabindex="0"
  :aria-label="`Select ${pack.name}`"
  class="cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none"
  @click="selectPack(pack.id)"
  @keydown.enter.prevent="selectPack(pack.id)"
  @keydown.space.prevent="selectPack(pack.id)"
>
```

#### 3b. Icon-only buttons

```vue
<!-- ❌ Screen reader reads nothing -->
<button @click="close">
  <Icon name="x" />
</button>

<!-- ✅ Explicit label -->
<button type="button" aria-label="Close dialog" @click="close">
  <Icon name="x" aria-hidden="true" />
</button>
```

Always `aria-hidden="true"` on decorative icons inside labeled buttons to avoid double-reading.

#### 3c. Form inputs

```vue
<!-- ❌ Input with no label -->
<input v-model="query" type="text" placeholder="Search..." />

<!-- ✅ Visually hidden label -->
<label for="search-input" class="sr-only">Search cards</label>
<input
  id="search-input"
  v-model="query"
  type="text"
  placeholder="Search..."
  aria-label="Search cards"
/>
```

#### 3d. Focus-visible states

Every interactive element must have a visible focus state for keyboard users. Use the primary ring:

```vue
<button class="... focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none rounded-[var(--radius-lg)]">
```

For dark surfaces:
```vue
<button class="... focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
```

**Never remove focus outlines entirely** (`outline-none` alone without a visible replacement).

#### 3e. Images

```vue
<!-- ❌ Empty alt on informational image -->
<img :src="user.avatar" alt="" />

<!-- ✅ Descriptive alt -->
<img :src="user.avatar" :alt="`${user.name}'s avatar`" />

<!-- ✅ Decorative image — empty alt is correct -->
<img src="/decorative-wave.svg" alt="" aria-hidden="true" />
```

#### 3f. Dynamic content regions

For content that updates without page navigation (scores, status, counts):

```vue
<p aria-live="polite" aria-atomic="true">
  {{ statusMessage }}
</p>
```

Use `aria-live="assertive"` only for critical errors; `"polite"` for everything else.

#### 3g. Modal / dialog semantics

```vue
<div
  role="dialog"
  aria-modal="true"
  :aria-labelledby="titleId"
  :aria-describedby="descId"
>
  <h2 :id="titleId">Confirm action</h2>
  <p :id="descId">This cannot be undone.</p>
</div>
```

### 4. Touch Target Checklist

Minimum 44×44px for all interactive elements on mobile. Verify with:

```bash
grep -n 'p-1\b\|p-0\b\|py-1\b\|px-1\b\|h-6\b\|h-7\b\|w-6\b\|w-7\b' <file>
```

Fix undersized targets:

```vue
<!-- ❌ Too small (24px × 24px icon button) -->
<button class="p-1"><Icon name="edit" class="w-4 h-4" /></button>

<!-- ✅ 44px touch target with visually-small icon -->
<button class="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Edit">
  <Icon name="edit" class="w-4 h-4" aria-hidden="true" />
</button>
```

On desktop where a smaller target is visually preferred, constrain via responsive:
```vue
<button class="p-1 md:p-3 min-h-[44px] md:min-h-0">
```

### 5. Production-Readiness Checklist

Run through this for every interactive component before shipping:

#### Semantics
- [ ] All clickable elements are `<button>`, `<a>`, `<router-link>`, or have `role="button"` + `tabindex="0"`
- [ ] All form fields have associated `<label>` or `aria-label`
- [ ] All icon-only buttons have `aria-label`; icons inside have `aria-hidden="true"`
- [ ] Images have meaningful `alt` text; purely decorative ones have `alt=""` + `aria-hidden="true"`
- [ ] Modals/dialogs have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`

#### Keyboard Navigation
- [ ] Tab order is logical (matches visual order unless explicitly overridden with `tabindex`)
- [ ] Focus is trapped inside open modals/drawers (Headless UI / Nuxt UI components handle this automatically — verify)
- [ ] Escape key closes modals, drawers, and dropdowns
- [ ] Enter/Space activate buttons and custom `role="button"` elements

#### Focus States
- [ ] Every interactive element has a visible `focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]` or equivalent
- [ ] No bare `outline-none` without a visual focus replacement
- [ ] Focus ring is visible on both light and dark surfaces

#### Touch Targets
- [ ] All interactive elements ≥ 44×44px on mobile (`min-h-[44px]`, `py-3` minimum)
- [ ] Tap targets have sufficient spacing (≥ 8px gap between adjacent buttons)
- [ ] No interactive elements under 32px in any dimension

#### Screen Reader
- [ ] Dynamic content regions use `aria-live="polite"`
- [ ] Loading states announce progress: `aria-live="polite"` + `aria-busy="true"` on loading containers
- [ ] Error messages bound to inputs via `aria-describedby`
- [ ] Status after action (save, delete, submit) announced via `aria-live`

### 6. Known Issues in This Codebase

| File | Issue | Fix |
|------|-------|-----|
| [app/components/shared/CreditsWallet.vue](../../app/components/shared/CreditsWallet.vue) line ~234 | `<div @click>` no role/keyboard | Replace with `<button>` |
| [app/components/ui/DropdownMenu.vue](../../app/components/ui/DropdownMenu.vue) line ~21 | `<img alt="">` on logo | Add `alt="App logo"` |
| [app/components/board/BoardListView.vue](../../app/components/board/BoardListView.vue) line ~155 | Button lacks contextual `aria-label` | Add descriptive label |

### 7. Good Examples to Reference

| Pattern | File |
|---------|------|
| ✅ `role="region"` + `aria-label` on content sections | [app/components/review/CardDisplay.vue](../../app/components/review/CardDisplay.vue) |
| ✅ `aria-modal`, `aria-labelledby`, `focus-visible` on drawer | [app/components/ui/Drawer.vue](../../app/components/ui/Drawer.vue) |
| ✅ `aria-label` on icon-close button | [app/components/workspace/hub/ContextSlideOver.vue](../../app/components/workspace/hub/ContextSlideOver.vue) |
| ✅ `aria-live="polite" aria-atomic="true"` for toast | [app/components/shared/ResendBlockedToast.vue](../../app/components/shared/ResendBlockedToast.vue) |

## Anti-Patterns

- `tabindex="-1"` to hide elements from tab order without providing an alternative focus path
- `aria-label` duplicating visible text exactly — only needed when text is absent or insufficient
- Adding `role="button"` to a `<button>` (redundant)
- Using `aria-disabled="true"` without also setting `:disabled` on the actual element
- `aria-hidden="true"` on a container that holds focusable children — this hides keyboard focus from AT
