<template>
  <AccountPageFrame
    title="Data & privacy"
    subtitle="Export, import, and privacy controls."
  >
    <UiSettingsGroup title="Data & privacy">
      <UiSettingsRow
        title="Export data"
        description="Download account data when export tooling is connected"
        trailing-text="Coming soon"
      >
        <template #leading>
          <UiIcon name="i-lucide-download" class="h-4 w-4" />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="Import data"
        description="Restore from a backup when import tooling is connected"
        trailing-text="Coming soon"
      >
        <template #leading>
          <UiIcon name="i-lucide-upload" class="h-4 w-4" />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="Privacy controls"
        description="Analytics and error-reporting preferences are not connected yet"
        trailing-text="Unavailable"
      >
        <template #leading>
          <UiIcon name="i-lucide-shield" class="h-4 w-4" />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>
  </AccountPageFrame>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
</script>
