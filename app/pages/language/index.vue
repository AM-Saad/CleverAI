<template>
  <shared-page-wrapper title="Language" subtitle="Build your vocabulary word by word">
    <div class="space-y-6 mt-6">
      <!-- Status card -->
      <language-language-status-card />

      <!-- Quick capture inline shortcut -->
      <div class="flex items-center justify-between">
        <ui-subtitle size="base" color="content-on-surface">My Word Bank</ui-subtitle>
        <div class="flex items-center gap-2">
          <u-button size="sm" variant="ghost" color="neutral" @click="showPreferences = !showPreferences">
            <Icon name="i-lucide-sliders-horizontal" class="w-3.5 h-3.5 mr-1" />
            Preferences
          </u-button>
          <u-button size="sm" variant="soft" @click="openCapture">
            <Icon name="i-lucide-plus" class="w-3.5 h-3.5 mr-1" />
            Add Word
          </u-button>
        </div>
      </div>

      <language-preferences-module v-if="showPreferences" compact @saved="showPreferences = false" />

      <language-word-bank-list ref="wordBankRef" />
    </div>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
const { open: openCapture } = useQuickCaptureModal();
const wordBankRef = ref<any>(null);
const showPreferences = ref(false);
</script>
