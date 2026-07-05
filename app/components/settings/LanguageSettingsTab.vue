<template>
  <UiPanel variant="surface" size="md">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="min-w-0">
        <UiSubtitle size="base">Language settings live in one place</UiSubtitle>
        <UiParagraph size="sm" class="mt-1 text-content-secondary">
          Manage learning language, native language, quick capture, auto-enroll,
          and session size from the dedicated language settings page.
        </UiParagraph>
      </div>
      <UiButton
        to="/account/language"
        tone="primary"
        variant="solid"
        leading-icon="i-lucide-settings"
      >
        Open Language Settings
      </UiButton>
    </div>
  </UiPanel>
</template>
