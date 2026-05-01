---
name: responsive-layout
description: "Make UI production-ready and responsive across all screen sizes. Use when: fixing mobile layout issues, auditing responsive breakpoints, making a component or page work on small screens, applying responsive treatment to review/study/board/language components, ensuring smooth layout on mobile/tablet/desktop, implementing mobile-first Tailwind classes, adding snap scroll or layout paradigm shifts for mobile, checking production-readiness of responsive behavior, responsive audit, layout consistency across screens."
argument-hint: "Component or page path to make responsive (e.g. app/components/review/CardReviewInterface.vue)"
---

# Responsive Layout — Production-Ready

Makes any component or page fully responsive and production-ready across mobile (< 768px), tablet (768–1023px), and desktop (1024px+) using the project's design system.

## When to Use

- A component or page has no (or incomplete) responsive classes
- Layout breaks on mobile or tablet
- Starting a new component that must work on all screens
- Running a full responsive audit before a release

## Design System Reference

Always consult these files before adding any classes:

| File | Purpose |
|------|---------|
| [app/DESIGN.md](../../app/DESIGN.md) | **Authoritative spec** — breakpoints, tokens, typography rules, do/don'ts |
| [app/assets/css/main.css](../../app/assets/css/main.css) | CSS variable definitions (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`) |
| [app/composables/ui/useResponsive.ts](../../app/composables/ui/useResponsive.ts) | `isMobile`, `isTablet`, `isDesktop`, `isSm`…`is2Xl` helpers |
| [STYLEGUIDE.md](../../STYLEGUIDE.md) | Nuxt UI theming & Tailwind v4 patterns |

**Breakpoints (Tailwind defaults):**

| Token | Value | Semantic |
|-------|-------|----------|
| `sm` | 640px | Small phones (rare; prefer `md` as mobile cutoff) |
| `md` | 768px | Tablet / mobile breakpoint |
| `lg` | 1024px | Desktop layout shifts |
| `xl` | 1280px | Wide-desktop refinements |
| `2xl` | 1536px | Ultra-wide (use sparingly) |

## Procedure

### 1. Load Context

Read the component/page to audit. Identify:
- Whether `useResponsive()` is already imported
- Existing responsive classes (if any)
- Hardcoded widths/heights that prevent fluid layout
- Fixed pixel values that should become relative or token-based

```bash
# Quick audit — find missing responsive classes
grep -n "class=" <file> | grep -v "sm:\|md:\|lg:\|xl:"
```

### 2. Classify the Layout Type

Choose the correct responsive strategy based on the component:

| Component Type | Strategy |
|---------------|----------|
| **Page / full-screen view** | Fluid grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, responsive padding `px-4 md:px-8 lg:px-12` |
| **Card / content block** | Max-width wrapper + `w-full`, text scales `text-sm md:text-base` only for headings |
| **Navigation** | Hamburger/sheet on mobile (`hidden lg:flex`), full bar on desktop |
| **Complex interaction** (Kanban, review) | Two paradigms: mobile uses scroll-snap / bottom-sheet; desktop uses drag / sidebar |
| **Modal / dialog** | `w-full max-w-sm md:max-w-lg lg:max-w-2xl`, avoid fixed px widths |
| **Data table / list** | Stack to cards on mobile (`flex flex-col md:table`), or horizontal scroll |
| **Form** | Single-column on mobile, two-column on md+: `grid grid-cols-1 md:grid-cols-2` |

### 3. Apply Mobile-First Classes

Always write **base class → `md:` → `lg:`** (never desktop-first):

```vue
<!-- ✅ Mobile-first -->
<div class="flex flex-col gap-4 px-4 md:flex-row md:gap-8 md:px-8 lg:gap-12 lg:px-12">

<!-- ❌ Desktop override (avoid) -->
<div class="flex flex-row gap-12 px-12 max-md:flex-col">
```

**Typography:** Scale headings only, not body text:
```vue
<h1 class="text-2xl md:text-4xl lg:text-5xl font-bold">
<p class="text-sm leading-relaxed">  <!-- body stays fixed -->
```

**Spacing:** Use design tokens via CSS variables or Tailwind spacing units (4px grid):
```vue
<div class="p-4 md:p-6 lg:p-8">   <!-- 16px → 24px → 32px -->
```

### 4. Handle Paradigm Shifts with `useResponsive()`

For complex UI that changes behavior (not just appearance) between mobile and desktop:

```vue
<script setup>
const { isMobile, isDesktop } = useResponsive()
</script>

<template>
  <!-- Mobile: sheet drawer -->
  <USheet v-if="isMobile" v-model="open">...</USheet>

  <!-- Desktop: inline sidebar -->
  <aside v-else class="hidden lg:block w-64 shrink-0">...</aside>
</template>
```

Scroll-snap for horizontal mobile lists:
```vue
<div class="flex overflow-x-auto snap-x snap-mandatory lg:overflow-visible lg:snap-none">
  <div class="snap-start shrink-0 w-[85vw] lg:w-80">...</div>
</div>
```

### 5. Production-Readiness Checklist

Run through this before marking done:

#### Layout
- [ ] No hardcoded `px` widths that clip on mobile (replace with `w-full`, `max-w-*`, or `min-w-0`)
- [ ] No `overflow: hidden` that swallows content on small screens
- [ ] Padded safe areas: at minimum `px-4` on any full-width container
- [ ] Touch targets ≥ 44px tall (`min-h-[44px]` or `py-3`) on mobile

#### Typography
- [ ] Body text is always `text-sm leading-relaxed` (never scaled)
- [ ] Headings scale with breakpoints
- [ ] No text truncation without tooltip fallback on mobile

#### Interaction
- [ ] All interactive elements reachable by thumb (bottom half of viewport preference)
- [ ] No hover-only affordances: pair `hover:` states with `focus-visible:` equivalents
- [ ] Drag-and-drop disabled on `isMobile`; tap-to-reorder or long-press used instead

#### Performance
- [ ] No layout shift caused by media queries switching display values late
- [ ] Images use `sizes` attribute if responsive: `sizes="(max-width: 768px) 100vw, 50vw"`
- [ ] No `v-if` on layout wrappers that causes DOM flicker on resize — prefer `class` toggling

#### Design tokens
- [ ] Colors use CSS variables (`bg-[var(--color-surface)]`) not raw hex values
- [ ] Border radius uses `rounded-[var(--radius-lg)]` (cards use `--radius-2xl`)
- [ ] Shadows only on interactive/elevated elements — never static surfaces

### 6. Cross-Screen Smoke Test

After applying changes, validate visually at these widths:

| Width | Device Class | Key Check |
|-------|-------------|-----------|
| 375px | iPhone SE / small phone | No overflow, readable text, thumb-reachable CTAs |
| 430px | iPhone Pro Max | Standard mobile layout |
| 768px | iPad portrait / breakpoint | `md:` classes kick in, layout transitions |
| 1024px | iPad landscape / small laptop | `lg:` classes active, desktop layout |
| 1440px | Desktop | Full layout, no stretched content |

In the browser devtools:
1. Open DevTools → Toggle Device Toolbar (`Cmd+Shift+M`)
2. Test at each width above
3. Check: no horizontal scrollbar on body, no clipped text, buttons are tappable

### 7. Common Patterns for This Codebase

**Review interface (CardReviewInterface, ReviewHeader):**
```vue
<!-- Grade buttons: stack on mobile, row on desktop -->
<div class="flex flex-wrap gap-2 md:flex-nowrap md:gap-4">
  <button class="flex-1 min-w-[80px] min-h-[44px] ...">Grade</button>
</div>
```

**Stats / badges row:**
```vue
<div class="flex flex-wrap gap-2 md:gap-4">
  <span class="badge shrink-0">...</span>
</div>
```

**Modal size:**
```vue
<UModal :ui="{ container: 'w-full max-w-sm md:max-w-2xl' }">
```

**Section layout (page):**
```vue
<section class="container mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-16">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

## Examples in This Codebase

| Pattern | Reference file |
|---------|---------------|
| ✅ Mobile-to-desktop paradigm shift | [app/components/board/BoardKanbanView.vue](../../app/components/board/BoardKanbanView.vue) |
| ✅ Fluid hero layout | [app/pages/index.vue](../../app/pages/index.vue) |
| ✅ Responsive grid | [app/pages/about.vue](../../app/pages/about.vue) |
| ✅ Mobile session UI | [app/components/language/LanguageSessionView.vue](../../app/components/language/LanguageSessionView.vue) |
| ❌ Needs mobile treatment | [app/components/review/CardReviewInterface.vue](../../app/components/review/CardReviewInterface.vue) |
| ❌ Needs mobile treatment | [app/components/review/ReviewHeader.vue](../../app/components/review/ReviewHeader.vue) |

## Anti-Patterns to Avoid

- `w-[500px]` — hardcoded widths that clip on mobile
- `absolute` positioning without `sm:` override — overlapping elements on mobile
- `grid-cols-3` on root container — no `md:` fallback, items shrink to unreadable sizes
- Relying solely on `useResponsive` for layout toggling when Tailwind classes suffice — adds JS overhead
- Using `sm:` as the primary mobile breakpoint — use `md:` (768px) as the mobile/desktop boundary per `DESIGN.md`
