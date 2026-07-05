<template>
  <div class="mats">
    <WorkspacePill class="mats__wspill" />
    <header class="mats__header">
      <ui-title tag="h1" class="mats__title">Materials</ui-title>
      <UiButton
        size="sm"
        pill
        tone="primary"
        leading-icon="i-lucide-upload"
        :disabled="uploading"
        @click="pick"
      >
        Upload
      </UiButton>
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.txt,.md,.docx,image/*"
        class="mats__file"
        @change="onFile"
      />
      <!-- design-allow: native file input -->
    </header>

    <div v-if="uploading" class="mats__uploading">
      <UiSkeleton class="h-3 w-full rounded-[var(--radius-full)]" />
      <UiSkeleton class="h-3 w-3/4 rounded-[var(--radius-full)]" />
      <p>Uploading &amp; extracting…</p>
    </div>

    <div v-if="loading && !materials.length" class="mats__list">
      <UiSkeleton
        v-for="i in 3"
        :key="i"
        class="h-16 w-full rounded-[var(--radius-2xl)]"
      />
    </div>
    <div v-else-if="!materials.length && !uploading" class="mats__empty">
      <UiIcon
        name="i-lucide-file-stack"
        class="h-10 w-10 text-content-disabled"
      />
      <p class="mats__empty-title">No materials yet</p>
      <p class="mats__empty-sub">
        Upload a PDF or doc to generate cards from it.
      </p>
    </div>
    <ul v-else class="mats__list">
      <li v-for="m in materials" :key="m.id">
        <UiListCard
          clickable
          :description="`${typeLabel(m)} · ${metaFor(m)}`"
          :leading-background="tint(tileColor(m), 16)"
          :leading-color="tileColor(m)"
          @click="open(m.id)"
        >
          <template #title>
            <span dir="auto">{{ m.title || 'Untitled material' }}</span>
          </template>
          <template #leading>
            <span class="mats__tile-label" aria-hidden="true">{{
              typeLabel(m)
            }}</span>
          </template>
          <template #action>
            <UiIcon
              name="i-lucide-chevron-right"
              class="h-4 w-4"
              aria-hidden="true"
            />
          </template>
        </UiListCard>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { tint } from "~/composables/useAccentColor";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import type { Material } from "~/shared/utils/material.contract";

const { $api } = useNuxtApp();
const route = useRoute();
const toast = useToast();
const { activeId } = useActiveWorkspace();

const materials = ref<Material[]>([]);
const loading = ref(true);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const lastUploadToken = ref("");

function pick() {
  fileInput.value?.click();
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !activeId.value) return;
  uploading.value = true;
  try {
    const res = await $api.materials.uploadFile(
      file,
      activeId.value,
      file.name,
    );
    if (res.success) {
      await navigateTo(`/materials/${res.data.materialId}`);
    } else {
      toast.add({ title: "Upload failed", color: "error" });
    }
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

function open(id: string) {
  navigateTo(`/materials/${id}`);
}
function typeLabel(m: Material) {
  const t = (m.type ?? "").toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("image") || t.includes("png") || t.includes("jpg"))
    return "IMG";
  return "DOC";
}
function tileColor(m: Material) {
  const l = typeLabel(m);
  if (l === "PDF") return "var(--color-error)";
  if (l === "IMG") return "var(--color-accent-purple)";
  return "var(--color-accent-blue)";
}
function metaFor(m: Material) {
  const meta = m.metadata as Record<string, unknown> | undefined;
  const pages =
    typeof meta?.pageCount === "number" ? `${meta.pageCount} pages · ` : "";
  return `${pages}${new Date(m.createdAt as string).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

async function load() {
  if (!activeId.value) return;
  loading.value = true;
  try {
    const res = await $api.materials.getByWorkspace(activeId.value);
    if (res.success) materials.value = res.data;
  } finally {
    loading.value = false;
  }
}

function hasUploadIntent(value: typeof route.query.upload) {
  return Array.isArray(value) ? value.length > 0 : value != null;
}

function clearUploadIntent() {
  const { upload: _upload, capture: _capture, ...query } = route.query;
  void _upload;
  void _capture;
  void navigateTo({ path: route.path, query }, { replace: true });
}

function consumeUploadRoute(value: typeof route.query.upload) {
  if (!hasUploadIntent(value) || !activeId.value) return;
  const token = `${route.query.capture ?? ""}:${activeId.value}`;
  if (lastUploadToken.value === token) return;
  lastUploadToken.value = token;
  pick();
  clearUploadIntent();
}

watch(activeId, () => {
  void load();
});
watch(
  [() => route.query.upload, () => route.query.capture, activeId],
  ([upload]) => {
    consumeUploadRoute(upload);
  },
);

onMounted(async () => {
  await load();
  consumeUploadRoute(route.query.upload);
});
</script>

<style scoped>
.mats {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-8);
}
.mats__wspill {
  align-self: flex-start;
  margin-top: var(--space-2);
}
.mats__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mats__title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
}
.mats__file {
  display: none;
}
.mats__uploading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--color-surface-subtle);
  font-size: 13px;
  color: var(--color-content-secondary);
}
.mats__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: 0;
}
.mats__tile-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.mats__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-16) var(--space-6);
  text-align: center;
}
.mats__empty-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--color-content-on-surface-strong);
}
.mats__empty-sub {
  font-size: 14px;
  color: var(--color-content-secondary);
}
</style>
