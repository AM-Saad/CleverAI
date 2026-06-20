<template>
  <shared-page-wrapper title="Language" subtitle="Build your vocabulary word by word">
    <div class="space-y-6 mt-6">
      <LanguageStatusCard />

      <div class="flex items-center justify-between">
        <ui-subtitle size="base" color="content-on-surface">My Word Bank</ui-subtitle>
        <div class="flex items-center gap-2">
          <ui-button
            size="sm"
            variant="ghost"
            color="neutral"
            to="/language/settings"
          >
            <Icon name="i-lucide-sliders-horizontal" class="w-3.5 h-3.5 mr-1" />
            Settings
          </ui-button>
          <ui-button size="sm" variant="soft" @click="openCapture">
            <Icon name="i-lucide-plus" class="w-3.5 h-3.5 mr-1" />
            Add Word
          </ui-button>
        </div>
      </div>

      <WordBankList ref="wordBankRef" />
    </div>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
import LanguageStatusCard from "~/features/language-learning/components/LanguageStatusCard.vue";
import WordBankList from "~/features/language-learning/components/WordBankList.vue";
const { open: openCapture } = useQuickCaptureModal();
const wordBankRef = ref<unknown>(null);
</script>
