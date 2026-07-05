<template>
  <AccountPageFrame title="About" subtitle="Product information and pricing.">
    <UiSettingsGroup title="About">
      <UiSettingsRow
        to="/about"
        title="About Cognilo"
        description="Product information"
      >
        <template #leading>
          <UiIcon name="i-lucide-info" class="h-4 w-4" />
        </template>
        <template #control>
          <UiIcon
            name="i-lucide-chevron-right"
            class="h-4 w-4 text-content-disabled"
          />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        to="/pricing"
        title="Plans & pricing"
        description="Compare available plans"
      >
        <template #leading>
          <UiIcon name="i-lucide-sparkles" class="h-4 w-4" />
        </template>
        <template #control>
          <UiIcon
            name="i-lucide-chevron-right"
            class="h-4 w-4 text-content-disabled"
          />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>
  </AccountPageFrame>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
</script>
