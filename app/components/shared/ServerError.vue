<template>
  <UiCard v-if="typedError && !loading" class=" mx-auto text-center" variant="outline" shadow="none" size="sm">
    <div class="flex items-center gap-2">
      <div v-if="typedError.status" class="text-white mt-1">
        <u-icon v-if="typedError.status < 500" name="i-heroicons-bell" :size="UI_CONFIG.ICON_SIZE" />
        <u-icon v-else name="i-heroicons-bell-slash" :size="UI_CONFIG.ICON_SIZE" />
      </div>
      <ui-subtitle size="sm" v-if="errorDetails">
        {{ errorDetails.data?.message }}.
      </ui-subtitle>
      <ui-subtitle size="sm" v-else>
        {{ online ? typedError.message || 'An unexpected error occurred. Please try again later.' :
          'You are currently offline. Please check your internet connection and try again.' }}
      </ui-subtitle>
    </div>
    <DevOnly>
      <ui-paragraph size="xs" :center="false" color="content-secondary" class="mt-2" v-if="errorDetails">
        {{ ` ${errorDetails.data?.code ?? ''} - ${errorDetails.data?.message ?? ''}` }}
      </ui-paragraph>
    </DevOnly>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { APIError } from '@/services/FetchFactory'

interface ErrorDetailsPayload {
  data?: {
    code?: string
    message?: string
  }
}

defineProps<{
  loading: boolean;
  refresh?: () => void;
}>();
const typedError = defineModel<APIError | null>('typedError', { required: true });
const { isVerifiedOnline: online } = useNetworkStatus()
const errorDetails = computed(
  () => typedError.value?.details as ErrorDetailsPayload | undefined,
)

</script>
