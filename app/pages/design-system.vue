<template>
  <div :class="{ dark: isDark }" class="min-h-screen bg-background text-content-on-background p-6 lg:p-10">
    <div class="max-w-6xl mx-auto flex flex-col gap-12">
      <header class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <UiTitle size="3xl" weight="bold">Design System</UiTitle>
          <UiParagraph color="content-secondary">
            Living catalog — tokens and primitives. Generated from
            <code class="font-mono">designTokenValues</code> + the <code class="font-mono">Ui*</code> components.
          </UiParagraph>
        </div>
        <UiButton
          :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
          tone="neutral"
          variant="outline"
          size="sm"
          @click="isDark = !isDark"
        >
          {{ isDark ? "Light" : "Dark" }}
        </UiButton>
      </header>

      <!-- ── Tokens ─────────────────────────────────────── -->
      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Color</UiSubtitle>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div v-for="t in colors" :key="t.name" class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-[var(--radius-lg)] border border-secondary shrink-0"
              :style="{ background: `var(${t.name})` }"
            />
            <div class="min-w-0">
              <p class="text-sm text-content-on-surface truncate">{{ t.label }}</p>
              <p class="text-xs font-mono text-content-secondary truncate">{{ t.value }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Accent</UiSubtitle>
        <div class="flex flex-wrap gap-3">
          <div v-for="t in accents" :key="t.name" class="flex flex-col items-center gap-1">
            <div class="w-14 h-14 rounded-[var(--radius-lg)]" :style="{ background: `var(${t.name})` }" />
            <span class="text-xs text-content-secondary">{{ t.label }}</span>
          </div>
        </div>
      </section>

      <section class="grid sm:grid-cols-3 gap-8">
        <div class="flex flex-col gap-3">
          <UiSubtitle size="lg" weight="semibold">Spacing</UiSubtitle>
          <div v-for="t in spacing" :key="t.name" class="flex items-center gap-3">
            <div class="bg-primary h-3 rounded-[var(--radius-sm)]" :style="{ width: `var(${t.name})` }" />
            <span class="text-xs font-mono text-content-secondary">{{ t.label }} · {{ t.value }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <UiSubtitle size="lg" weight="semibold">Radius</UiSubtitle>
          <div v-for="t in radius" :key="t.name" class="flex items-center gap-3">
            <div
              class="w-12 h-12 bg-surface-strong border border-secondary"
              :style="{ borderRadius: `var(${t.name})` }"
            />
            <span class="text-xs font-mono text-content-secondary">{{ t.label }} · {{ t.value }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <UiSubtitle size="lg" weight="semibold">Shadow</UiSubtitle>
          <div v-for="t in shadows" :key="t.name" class="flex items-center gap-3">
            <div class="w-12 h-12 bg-surface rounded-[var(--radius-lg)]" :style="{ boxShadow: `var(${t.name})` }" />
            <span class="text-xs font-mono text-content-secondary">{{ t.label }}</span>
          </div>
        </div>
      </section>

      <!-- ── Typography ─────────────────────────────────── -->
      <section class="flex flex-col gap-3">
        <UiSubtitle size="lg" weight="semibold">Typography</UiSubtitle>
        <UiTitle size="4xl" weight="bold">Page Hero</UiTitle>
        <UiTitle size="2xl">Section Heading</UiTitle>
        <UiSubtitle>Card / Panel Heading</UiSubtitle>
        <UiParagraph>Body text — the default paragraph role, relaxed leading on surfaces.</UiParagraph>
        <UiParagraph size="xs" color="content-secondary">Caption / metadata.</UiParagraph>
      </section>

      <!-- ── Primitives ─────────────────────────────────── -->
      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">UiButton</UiSubtitle>
        <div class="flex flex-col gap-3">
          <div v-for="variant in buttonVariants" :key="variant" class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">{{ variant }}</span>
            <UiButton v-for="tone in tones" :key="tone" :tone="tone" :variant="variant">{{ tone }}</UiButton>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">sizes</span>
            <UiButton v-for="s in sizes" :key="s" :size="s">{{ s }}</UiButton>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">state</span>
            <UiButton loading>loading</UiButton>
            <UiButton disabled>disabled</UiButton>
            <UiButton icon="i-lucide-plus">with icon</UiButton>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">UiBadge</UiSubtitle>
        <div class="flex flex-col gap-3">
          <div v-for="variant in badgeVariants" :key="variant" class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">{{ variant }}</span>
            <UiBadge v-for="tone in tones" :key="tone" :tone="tone" :variant="variant">{{ tone }}</UiBadge>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">UiCard</UiSubtitle>
        <div class="grid sm:grid-cols-3 gap-4">
          <UiCard v-for="variant in cardVariants" :key="variant" :variant="variant">
            <template #header>{{ variant }}</template>
            <UiParagraph size="sm">Card body content using the {{ variant }} variant.</UiParagraph>
          </UiCard>
        </div>
      </section>

      <section class="grid sm:grid-cols-2 gap-6">
        <div class="flex flex-col gap-4">
          <UiSubtitle size="lg" weight="semibold">UiSkeleton</UiSubtitle>
          <div class="flex flex-col gap-2">
            <UiSkeleton shape="text" />
            <UiSkeleton shape="text" width="70%" />
            <div class="flex items-center gap-3">
              <UiSkeleton shape="circle" width="2.5rem" height="2.5rem" />
              <UiSkeleton shape="rect" width="8rem" height="2.5rem" />
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <UiSubtitle size="lg" weight="semibold">UiEmptyState</UiSubtitle>
          <UiCard variant="outline">
            <UiEmptyState
              icon="i-lucide-inbox"
              title="Nothing here yet"
              description="Empty states share one primitive."
              action-label="Create"
              action-icon="i-lucide-plus"
            />
          </UiCard>
        </div>
      </section>

      <!-- ── Form controls ──────────────────────────────── -->
      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Form controls</UiSubtitle>
        <div class="grid sm:grid-cols-2 gap-6 max-w-3xl">
          <UiFormField label="Text input" hint="UiInput inside UiFormField">
            <UiInput v-model="textVal" placeholder="Type here…" icon="i-lucide-search" />
          </UiFormField>
          <UiFormField label="Select" description="UiSelect">
            <UiSelect v-model="selectVal" :items="selectItems" placeholder="Choose a theme" />
          </UiFormField>
          <UiFormField label="Textarea" class="sm:col-span-2">
            <UiTextarea v-model="areaVal" :rows="3" placeholder="Multi-line…" />
          </UiFormField>
          <UiFormField label="Invalid example" error="This field is required">
            <UiInput placeholder="Errored input" />
          </UiFormField>
          <div class="flex flex-col gap-3 justify-center">
            <UiSwitch v-model="switchOn" label="Switch (UiSwitch)" />
            <UiCheckbox v-model="checked" label="Checkbox (UiCheckbox)" />
          </div>
        </div>
      </section>

      <!-- ── Feedback ───────────────────────────────────── -->
      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Feedback</UiSubtitle>
        <div class="flex flex-col gap-3 max-w-2xl">
          <UiAlert v-for="tone in tones" :key="tone" :tone="tone" :title="`${tone} alert`" description="Inline status message." />
          <div class="flex flex-col gap-2 pt-2">
            <UiProgress :value="35" />
            <UiProgress :value="70" tone="success" />
            <UiProgress :value="null" />
          </div>
          <UiTooltip text="Tooltip content">
            <UiButton variant="outline" size="sm">Hover for tooltip</UiButton>
          </UiTooltip>
        </div>
      </section>

      <!-- ── Overlays ───────────────────────────────────── -->
      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Overlays</UiSubtitle>
        <div class="flex flex-wrap gap-2">
          <UiButton @click="modalOpen = true">Open UiModal</UiButton>
          <UiButton tone="error" @click="confirmOpen = true">Open UiConfirmDialog</UiButton>
          <UiPopover>
            <UiButton variant="outline">Open UiPopover</UiButton>
            <template #content>
              <div class="p-3"><UiParagraph size="sm">Popover panel content.</UiParagraph></div>
            </template>
          </UiPopover>
        </div>
        <UiModal v-model:open="modalOpen" title="Example modal" description="A centered dialog.">
          <UiParagraph size="sm">Modal body content goes here.</UiParagraph>
        </UiModal>
        <UiConfirmDialog
          v-model:open="confirmOpen"
          title="Delete item?"
          description="This action cannot be undone."
          confirm-label="Delete"
          @confirm="confirmOpen = false"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * /design-system — internal living catalog. Dev-only (404 in production).
 * Renders the token palettes (from the generated token map) and every primitive
 * across its variants/sizes/states. Update when adding a primitive.
 */
import { designTokenValues } from "~/design-system/tokens.generated";
import type { Size, Tone } from "~/components/ui/variants";

definePageMeta({ layout: false });

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: "Not found" });
}

const entries = Object.entries(designTokenValues);
const humanize = (name: string, prefix: string) =>
  name.replace(prefix, "").replace(/-/g, " ") || name;

const pick = (prefix: string, exclude?: RegExp) =>
  entries
    .filter(([n]) => n.startsWith(prefix) && (!exclude || !exclude.test(n)))
    .map(([name, value]) => ({ name, value, label: humanize(name, prefix) }));

const colors = pick("--color-", /^--color-accent-/);
const accents = pick("--color-accent-");
const spacing = pick("--space-");
const radius = pick("--radius-");
const shadows = pick("--shadow-");

const tones: Tone[] = ["primary", "neutral", "success", "warning", "error", "info"];
const sizes: Size[] = ["xs", "sm", "md", "lg", "xl"];
const buttonVariants = ["solid", "outline", "soft", "subtle", "ghost", "link"] as const;
const badgeVariants = ["solid", "outline", "soft", "subtle"] as const;
const cardVariants = ["default", "outline", "ghost", "surface", "surface-strong"] as const;

// Theme toggle (also drives light/dark visual-regression snapshots).
const isDark = ref(false);

// Demo state for interactive primitives.
const textVal = ref("");
const areaVal = ref("");
const selectVal = ref<string | null>(null);
const switchOn = ref(true);
const checked = ref(true);
const modalOpen = ref(false);
const confirmOpen = ref(false);
const selectItems = ["Light", "Sepia", "Dark"];
</script>
