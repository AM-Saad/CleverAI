# Nuxt UI Styling — The Straight, Centralized Guide (Tailwind v4 + AppConfig)

This is the blueprint for **how to add, change, and update styling** across the app the *right* way with Nuxt UI v3+ and Tailwind v4.

---

## 1) The theming model (what’s actually happening)

- **Tailwind v4** puts your design tokens in CSS via `@theme`. Those tokens become **utilities** (e.g., `bg-green-500`) *and* **runtime CSS variables** you can reference (e.g., `var(--color-green-500)`). It replaces most of `theme.extend` from v3.
- **Nuxt UI** skins components using a **Tailwind Variants** system. You set **global defaults** in `app.config.ts`, and do **per-instance** overrides via the `ui` prop when necessary.
- **Color mode** (light/dark) is just CSS variables switching under a class on `<html>` (e.g., `.dark`), handled by the Nuxt Color Mode module.

---

## 2) File layout (single source of truth)

- `` → **Design tokens** and global CSS variables with `@theme` (colors, fonts, radii) + light/dark overrides.
- `` → **Global component defaults** (colors/variants/slots/sizes) for Nuxt UI theme. HMR-friendly.
- `` → **Build-time color alias list** and **safelist for dynamic colors** so classes don’t get tree-shaken.

---

## 3) Define tokens with `@theme` (Tailwind v4)

``

```css
@import "tailwindcss";
@import "@nuxt/ui";

/* 1) Design tokens create utilities + CSS vars */
@theme static {
  --font-sans: "Helvetica Neue", sans-serif;

  /* Example brand palette */
  --color-mint-50:  #E6FFF7;
  --color-mint-400: #00E0B8;
  --color-mint-500: #00BD9D; /* primary shade */
  --color-mint-600: #009C83;
}

/* 2) App-wide component variables */
:root {
  --ui-radius: .5rem;                         /* global shape */
  --ui-primary: var(--color-mint-500);        /* used by components */
}

/* 3) Dark mode overrides */
.dark {
  --ui-primary: var(--color-mint-400);
}
```

> If some classes live in non-scanned files (MD/JSON), Tailwind v4 supports `@source` to hint paths from CSS.

---

## 4) Register color aliases + defaults (Nuxt UI theme)

``

```ts
export default defineAppConfig({
  ui: {
    // Semantic aliases (what components see as `color="..."`)
    colors: {
      primary: 'mint',    // <- maps to your @theme mint-* shades
      neutral: 'zinc',
      tertiary: 'indigo'  // optional extra alias
    },

    // BUTTONS — defaults and shape
    button: {
      default: { color: 'primary', variant: 'solid', size: 'md' },
      base: 'font-semibold rounded-[var(--ui-radius)]'
    },

    // INPUTS — outline variant driven by --ui-primary (focus rings, etc.)
    input: {
      variant: {
        outline:
          'shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white ' +
          'ring-1 ring-inset ring-[--ui-primary]/50 focus:ring-2 focus:ring-[--ui-primary]'
      },
      default: { variant: 'outline', size: 'md' }
    },

    // TEXTAREA — mirror input behavior
    textarea: {
      variant: {
        outline:
          'shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white ' +
          'ring-1 ring-inset ring-[--ui-primary]/50 focus:ring-2 focus:ring-[--ui-primary]'
      },
      default: { variant: 'outline', size: 'md' }
    },

    // SELECT — base styles + radius/rings
    select: {
      base: 'rounded-[var(--ui-radius)] ring-1 ring-inset ring-[--ui-primary]/50 focus:ring-2 focus:ring-[--ui-primary]',
      default: { size: 'md' }
    },

    // CARD — shape + subtle elevation
    card: {
      base: 'rounded-[var(--ui-radius)] shadow-sm dark:shadow'
    }
  }
})
```

---

## 5) Make aliases available at build time (and safelist dynamics)

``

```ts
export default defineNuxtConfig({
  ui: {
    theme: {
      // ensure these aliases generate classes (color="..."):
      colors: ['primary','secondary','tertiary','info','success','warning','error']
    },
    // keep these colors if passed dynamically (runtime):
    safelistColors: ['orange','tertiary']
  }
})
```

---

## 6) The “how do I…” cookbook

### A) Set a specific border radius

- **Global**: edit `--ui-radius` in `:root` (e.g., `.375rem`), then use `rounded-[var(--ui-radius)]` in AppConfig defaults.
- **Per component default**: tweak in `app.config.ts` (e.g., `button.base`, `card.base`).
- **Per instance**: use the `ui` prop.

```vue
<UButton :ui="{ base: 'rounded-xl' }">Rounded XL</UButton>
```

### B) Give a component a shadow

- **Global** (Card): `card.base = 'rounded-[var(--ui-radius)] shadow-sm dark:shadow'`
- **Per instance**: `:ui="{ base: 'shadow-md hover:shadow-lg transition-shadow' }"`

### C) Change border/ring color

- Prefer **rings** for inputs/focus states; anchor to `--ui-primary` so dark mode works:

```ts
input: {
  variant: {
    outline: 'ring-1 ring-inset ring-[--ui-primary]/50 focus:ring-2 focus:ring-[--ui-primary]'
  }
}
```

- For classic borders (e.g., Card dividers):

```ts
card: { base: 'rounded-[var(--ui-radius)] border border-zinc-200 dark:border-zinc-800' }
```

### D) Configure component states (hover, focus, active, disabled)

- Add Tailwind state modifiers in `base` or `variant` strings in `app.config.ts`.

```ts
button: {
  base: 'font-semibold rounded-[var(--ui-radius)] disabled:opacity-60 disabled:cursor-not-allowed active:translate-y-px transition-[box-shadow,transform]'
}
```

### E) Add a brand-new color and use it everywhere

1. Define shades in `@theme` (e.g., `--color-oja-50..600`).
2. Map alias in `app.config.ts` → `ui.colors.oja = 'oja'` or swap `primary`.
3. Whitelist in `nuxt.config.ts` → `ui.theme.colors` and `safelistColors` if dynamic.
4. Use it: `<UButton color="oja">Buy Now</UButton>`.

### F) Dark mode adjustments

- Override CSS vars under `.dark { ... }` in `main.css` (e.g., `--ui-primary`).
- No need to duplicate Tailwind classes for dark; variables do the work.

---

## 7) Per-instance overrides (only when you need them)

```vue
<UButton
  :ui="{
    base: 'rounded-xl',
    color: { primary: { solid: 'shadow-sm ring-1 ring-inset ring-[--ui-primary]' } }
  }"
  color="primary"
  variant="solid"
>
  Custom Primary
</UButton>
```

---

## 8) Quick templates

``

```css
@import "tailwindcss";
@import "@nuxt/ui";
@theme static { /* define color scales here */ }
:root { --ui-radius: .5rem; --ui-primary: var(--color-primary-500); }
.dark { --ui-primary: var(--color-primary-400); }
```

``

```ts
export default defineAppConfig({
  ui: {
    colors: { primary: 'primary', neutral: 'zinc' },
    button:  { default: { color: 'primary', variant: 'solid', size: 'md' }, base: 'font-semibold rounded-[var(--ui-radius)]' },
    input:   { variant: { outline: 'ring-1 ring-inset ring-[--ui-primary]/50 focus:ring-2 focus:ring-[--ui-primary]' }, default: { variant: 'outline', size: 'md' } },
    textarea:{ variant: { outline: 'ring-1 ring-inset ring-[--ui-primary]/50 focus:ring-2 focus:ring-[--ui-primary]' }, default: { variant: 'outline', size: 'md' } },
    select:  { base: 'rounded-[var(--ui-radius)] ring-1 ring-inset ring-[--ui-primary]/50 focus:ring-2 focus:ring-[--ui-primary]', default: { size: 'md' } },
    card:    { base: 'rounded-[var(--ui-radius)] shadow-sm dark:shadow' }
  }
})
```

``

```ts
export default defineNuxtConfig({
  ui: {
    theme: { colors: ['primary','secondary','tertiary','info','success','warning','error'] },
    safelistColors: ['tertiary','orange']
  }
})
```
