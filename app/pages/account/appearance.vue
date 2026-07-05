<template>
  <AccountPageFrame title="Appearance" subtitle="Theme and display preference.">
    <UiSettingsGroup title="Theme">
      <UiSettingsRow
        title="Theme"
        description="Use the app in light, dark, or system mode"
      >
        <template #leading>
          <UiIcon name="i-lucide-sun-moon" class="h-4 w-4" />
        </template>
        <template #control>
          <UiColorModeToggle class="account-appearance__theme" />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>
  </AccountPageFrame>
</template>

<script setup lang="ts">
import UiColorModeToggle from "~/components/ui/UiColorModeToggle.vue";

definePageMeta({ middleware: "auth" });
</script>

<style scoped>
.account-appearance__theme {
  max-width: 100%;
}
</style>
