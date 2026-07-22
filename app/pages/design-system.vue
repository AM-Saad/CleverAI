<template>
  <div :class="{ dark: isDark }" class="min-h-screen bg-background text-content-on-background p-6 lg:p-10">
    <div class="max-w-6xl mx-auto flex flex-col gap-12">
      <header class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <UiTitle tag="h1" size="3xl" weight="bold">Design System</UiTitle>
          <UiParagraph color="content-secondary">
            Living catalog — tokens and primitives. Generated from
            <code class="font-mono">designTokenValues</code> + the <code class="font-mono">Ui*</code> components.
          </UiParagraph>
        </div>
        <UiButton
          :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
          tone="neutral"
          variant="soft"
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

      <section class="grid gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-4">
          <UiSubtitle size="lg" weight="semibold">Semantic text + focus</UiSubtitle>
          <div class="grid grid-cols-2 gap-3">
            <div v-for="t in semanticTextColors" :key="t.name" class="rounded-[var(--radius-lg)] border border-secondary bg-surface p-3">
              <p class="text-sm font-medium" :style="{ color: `var(${t.name})` }">{{ t.label }}</p>
              <p class="mt-1 text-xs font-mono text-content-secondary">{{ t.value }}</p>
            </div>
          </div>
          <UiButton class="w-fit" tone="neutral" variant="soft">
            Focusable sample
          </UiButton>
        </div>
        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <UiSubtitle size="sm" weight="semibold">Targets</UiSubtitle>
            <div v-for="t in targetTokens" :key="t.name" class="mt-2 flex items-center gap-2">
              <div class="rounded-[var(--radius-sm)] bg-primary/15" :style="{ width: `var(${t.name})`, height: `var(${t.name})` }" />
              <span class="text-xs font-mono text-content-secondary">{{ t.label }}</span>
            </div>
          </div>
          <div>
            <UiSubtitle size="sm" weight="semibold">Motion</UiSubtitle>
            <p v-for="t in motionTokens" :key="t.name" class="mt-2 text-xs font-mono text-content-secondary">
              {{ t.label }} · {{ t.value }}
            </p>
          </div>
          <div>
            <UiSubtitle size="sm" weight="semibold">Layers</UiSubtitle>
            <p v-for="t in layerTokens" :key="t.name" class="mt-2 text-xs font-mono text-content-secondary">
              {{ t.label }} · {{ t.value }}
            </p>
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
            <UiButton v-for="tone in buttonTones" :key="tone" :tone="tone" :variant="variant">{{ tone }}</UiButton>
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
        <UiSubtitle size="lg" weight="semibold">UiPill</UiSubtitle>
        <UiParagraph size="xs" color="content-secondary">
          Three-part anatomy (indicator / label / icon), presentational or a button/link. Workspace switcher, note status, tags, filters.
        </UiParagraph>
        <div class="flex flex-col gap-3">
          <div v-for="variant in pillVariants" :key="variant" class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">{{ variant }}</span>
            <UiPill :variant="variant" label="Default" color="var(--color-primary)" />
            <UiPill :variant="variant" label="Active" color="var(--color-primary)" active />
            <UiPill :variant="variant" label="Clickable" color="var(--color-primary)" clickable />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">sizes</span>
            <UiPill size="md" label="md" color="var(--color-primary)" variant="outline" active />
            <UiPill size="sm" label="sm" color="var(--color-primary)" variant="outline" active />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">indicator</span>
            <UiPill label="Workspace" color="var(--color-accent-indigo)" clickable>
              <template #indicator>
                <UiPillIndicator color="var(--color-accent-indigo)" />
              </template>
            </UiPill>
            <UiPill label="caught up" color="var(--color-success)" variant="outline" active>
              <template #icon>
                <UiPillIcon name="i-lucide-check" size="sm" />
              </template>
            </UiPill>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">removable</span>
            <UiPill label="# tag" color="var(--color-primary)" variant="outline" active>
              <template #icon>
                <UiPillIcon name="i-lucide-x" button size="sm" label="Remove tag" />
              </template>
            </UiPill>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-16 text-xs text-content-secondary">truncation</span>
            <UiPill label="A very long label that gets truncated with an ellipsis once it exceeds the pill's max width" color="var(--color-primary)" variant="outline" />
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

      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Surface taxonomy</UiSubtitle>
        <div class="grid gap-4 lg:grid-cols-4">
          <UiCard variant="outline">
            <template #header>Card</template>
            <UiParagraph size="sm">
              Discrete content object: a note, workspace, stat card, or review object.
            </UiParagraph>
          </UiCard>

          <UiPanel variant="surface">
            <template #header>Panel</template>
            <UiParagraph size="sm">
              Structural region: filters, sidebars, settings groups, and workspace panes.
            </UiParagraph>
          </UiPanel>

          <UiInteractiveCard
            :selected="interactiveSelected"
            selectable
            aria-label="Toggle example interactive card"
            @click="interactiveSelected = !interactiveSelected"
          >
            <template #header>InteractiveCard</template>
            <UiParagraph size="sm">
              One clickable/selectable surface. Avoid nested link/button controls inside.
            </UiParagraph>
            <template #footer>
              {{ interactiveSelected ? "Selected" : "Not selected" }}
            </template>
          </UiInteractiveCard>

          <UiOverlaySurface kind="popover" layer="popover">
            <UiSubtitle size="sm" weight="semibold">OverlaySurface</UiSubtitle>
            <UiParagraph size="sm">
              Visual shell for modal, drawer, popover, menu, toast, and tooltip surfaces.
            </UiParagraph>
          </UiOverlaySurface>
        </div>
      </section>

      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Toolbar + icon actions</UiSubtitle>
        <UiToolbar label="Catalog toolbar">
          <UiToolbarButton icon="i-lucide-bold" label="Bold" :active="true" />
          <UiToolbarButton icon="i-lucide-italic" label="Italic" />
          <UiToolbarButton icon="i-lucide-link" label="Add link" />
        </UiToolbar>
      </section>

      <section class="grid sm:grid-cols-3 gap-6">
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
          <UiSubtitle size="lg" weight="semibold">UiLoadingState</UiSubtitle>
          <div class="rounded-[var(--radius-lg)] border border-secondary bg-surface">
            <UiLoadingState label="Loading…" />
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
        <UiParagraph size="sm" color="content-secondary">
          Click or keyboard-focus each control. Every field uses one inset focus indicator and the same disabled/error semantics.
        </UiParagraph>

        <div class="grid gap-3 rounded-[var(--radius-lg)] border border-secondary bg-surface p-4 lg:grid-cols-3">
          <UiFormField label="Input">
            <UiInput v-model="textVal" placeholder="Type here…" icon="i-lucide-search" />
          </UiFormField>
          <UiFormField label="Select">
            <UiSelect v-model="selectVal" :items="selectItems" placeholder="Choose a theme" />
          </UiFormField>
          <UiFormField label="Textarea">
            <UiTextarea v-model="areaVal" :rows="2" placeholder="Multi-line…" />
          </UiFormField>
        </div>

        <UiSubtitle size="base" weight="semibold">Field states</UiSubtitle>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UiFormField label="Disabled">
            <UiInput model-value="Disabled value" disabled />
          </UiFormField>
          <UiFormField label="Read-only">
            <UiInput model-value="Read-only value" readonly />
          </UiFormField>
          <UiFormField label="Loading">
            <UiInput model-value="Loading value" loading />
          </UiFormField>
          <UiFormField label="Required" required>
            <UiInput required placeholder="Required value" />
          </UiFormField>
          <UiFormField label="Invalid through FormField" error="This field is required">
            <UiInput placeholder="Errored input" />
          </UiFormField>
          <UiFormField label="Explicit error" error="Needs attention">
            <UiInput model-value="Needs attention" error="Needs attention" />
          </UiFormField>
          <UiFormField label="Disabled textarea">
            <UiTextarea model-value="Disabled copy" disabled />
          </UiFormField>
          <UiFormField label="Read-only textarea">
            <UiTextarea model-value="Read-only copy" readonly />
          </UiFormField>
          <UiFormField label="Invalid select" error="Choose an option">
            <UiSelect :items="selectItems" placeholder="Select an option" />
          </UiFormField>
        </div>

        <UiSubtitle size="base" weight="semibold">Checkbox and switch states</UiSubtitle>
        <div class="grid gap-4 lg:grid-cols-2">
          <UiPanel size="sm" variant="subtle">
            <template #header>Checkbox</template>
            <div class="grid gap-3 sm:grid-cols-2">
              <UiCheckbox v-model="checked" label="Checked" />
              <UiCheckbox v-model="unchecked" label="Unchecked" />
              <UiCheckbox v-model="indeterminate" label="Indeterminate" />
              <UiCheckbox v-model="checked" label="Disabled checked" disabled />
              <UiCheckbox v-model="checked" indicator="end" label="Indicator at end" />
            </div>
          </UiPanel>
          <UiPanel size="sm" variant="subtle">
            <template #header>Switch</template>
            <div class="grid gap-3 sm:grid-cols-2">
              <UiSwitch v-model="switchOn" label="Checked" />
              <UiSwitch v-model="switchOff" label="Unchecked" />
              <UiSwitch v-model="switchOn" label="Disabled checked" disabled />
              <UiSwitch v-model="switchOn" label="Loading" loading />
              <UiSwitch v-model="switchOn" label="With icons" checked-icon="i-lucide-check" unchecked-icon="i-lucide-x" />
            </div>
          </UiPanel>
        </div>

        <UiSubtitle size="base" weight="semibold">Segmented control</UiSubtitle>
        <UiSegmentedControl
          v-model="segmentValue"
          label="Catalog view"
          :items="segmentItems"
        />

        <UiSubtitle size="base" weight="semibold">Action-menu states</UiSubtitle>
        <div class="flex flex-wrap items-center gap-3">
          <UiActionMenu :items="catalogMenuItems" label="Catalog actions" />
          <UiActionMenu :items="catalogMenuItems" label="Disabled actions" disabled />
          <UiParagraph size="xs" color="content-secondary">
            Menu includes normal, active, disabled, loading, and destructive items.
          </UiParagraph>
        </div>
      </section>

      <!-- ── Feedback ───────────────────────────────────── -->
      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Feedback</UiSubtitle>
        <div class="flex flex-col gap-3 max-w-2xl">
          <UiAlert v-for="tone in tones" :key="tone" :tone="tone" :title="`${tone} alert`" description="Inline status message." />
          <UiTooltip text="Tooltip content">
            <UiButton variant="soft" size="sm">Hover for tooltip</UiButton>
          </UiTooltip>
        </div>
      </section>

      <!-- ── Overlays ───────────────────────────────────── -->
      <section class="flex flex-col gap-4">
        <UiSubtitle size="lg" weight="semibold">Overlays</UiSubtitle>
        <div class="flex flex-wrap gap-2">
          <UiButton @click="modalOpen = true">Open UiModal</UiButton>
          <UiButton tone="error" @click="confirmOpen = true">Open UiConfirmDialog</UiButton>
          <UiButton variant="soft" @click="sheetOpen = true">Open UiSheet</UiButton>
          <UiPopover>
            <UiButton variant="soft">Open UiPopover</UiButton>
            <template #content>
              <UiOverlaySurface kind="popover" size="sm">
                <UiParagraph size="sm">Popover panel content.</UiParagraph>
              </UiOverlaySurface>
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
        <UiSheet v-model:open="sheetOpen" title="Example sheet">
          <div class="flex flex-col gap-3">
            <UiParagraph size="sm">
              Bottom sheet with drag-to-dismiss. Toggling the block below
              springs the panel height (animate-resize).
            </UiParagraph>
            <UiButton variant="soft" size="sm" @click="sheetExpanded = !sheetExpanded">
              {{ sheetExpanded ? "Shrink content" : "Grow content" }}
            </UiButton>
            <UiCard v-if="sheetExpanded" variant="outline">
              <div class="flex flex-col gap-2 py-2">
                <UiParagraph v-for="i in 6" :key="i" size="sm">
                  Extra content row {{ i }} — the sheet grows and shrinks with
                  a gentle overshoot instead of snapping.
                </UiParagraph>
              </div>
            </UiCard>
          </div>
        </UiSheet>
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
import type { ActionTone, ControlSize, SemanticTone } from "~/components/ui/variants";

definePageMeta({ layout: false });

if (!process.dev) {
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
const semanticTextColors = pick("--color-").filter((t) => /-(success|warning|error|info)-text$/.test(t.name));
const motionTokens = pick("--duration-").concat(pick("--ease-"));
const layerTokens = pick("--z-");
const targetTokens = pick("--target-");

const tones: SemanticTone[] = ["primary", "neutral", "success", "warning", "error", "info"];
const sizes: ControlSize[] = ["xs", "sm", "md", "lg"];
// Canonical action emphasis ladder.
const buttonVariants = ["solid", "soft", "ghost", "link"] as const;
const buttonTones: ActionTone[] = ["primary", "neutral", "error"];
const badgeVariants = ["outline", "soft", "subtle"] as const;
const segmentValue = ref("list");
const segmentItems = [
  { value: "list", label: "List", icon: "i-lucide-list" },
  { value: "grid", label: "Grid", icon: "i-lucide-grid-2x2" },
] as const;
const pillVariants = ["soft", "fill", "outline", "dashed", "ghost"] as const;
const cardVariants = ["default", "outline", "ghost", "surface"] as const;

// Theme toggle (also drives light/dark visual-regression snapshots).
const isDark = ref(false);

// Demo state for interactive primitives.
const textVal = ref("");
const areaVal = ref("");
const selectVal = ref<string | null>(null);
const switchOn = ref(true);
const switchOff = ref(false);
const checked = ref(true);
const unchecked = ref(false);
const indeterminate = ref<boolean | "indeterminate">("indeterminate");
const modalOpen = ref(false);
const confirmOpen = ref(false);
const sheetOpen = ref(false);
const sheetExpanded = ref(false);
const interactiveSelected = ref(true);
const selectItems = ["Light", "Sepia", "Dark"];
const catalogMenuItems = [
  [
    { label: "Open", icon: "i-lucide-folder-open" },
    { label: "Selected", icon: "i-lucide-check", active: true },
    { label: "Loading", icon: "i-lucide-loader-2", loading: true },
    { label: "Disabled", icon: "i-lucide-ban", disabled: true },
  ],
  [
    {
      id: "catalog-delete",
      label: "Delete",
      icon: "i-lucide-trash-2",
      color: "error",
      requiresDoubleTap: true,
      confirmLabel: "Tap again to delete",
    },
  ],
];
</script>
