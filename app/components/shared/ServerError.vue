<template>
  <UiCard v-if="typedError && !loading" class="max-w-xl mx-auto text-center" variant="outline" shadow="none" size="sm">
    <div class="flex items-center gap-2">
      <div v-if="typedError.status" class="text-white mt-1">
        <u-icon v-if="typedError.status < 500" name="i-heroicons-bell" :size="UI_CONFIG.ICON_SIZE" />
        <u-icon v-else name="i-heroicons-bell-slash" :size="UI_CONFIG.ICON_SIZE" />
      </div>
      <ui-subtitle size="sm" v-if="typedError.details">
        {{ typedError.details.data?.message }}.
      </ui-subtitle>
      <ui-subtitle size="sm" v-else>
        {{ typedError.message || 'An unexpected error occurred. Please try again later.' }}
      </ui-subtitle>
    </div>
    <DevOnly>
      <ui-paragraph size="xs" :center="false" color="muted" class="mt-2" v-if="typedError.details">
        {{ typedError.details ? ` ${typedError.details.data.code} - ${typedError.details.data.message}` : '' }}
      </ui-paragraph>
    </DevOnly>
  </UiCard>
</template>

<script setup lang="ts">

defineProps<{
  loading: boolean;
}>();
const typedError = defineModel<
  import("/Users/Bodda/cleverAI/app/services/FetchFactory").APIError | null
>("typedError", { required: true });
</script>
