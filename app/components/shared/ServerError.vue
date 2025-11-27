<template>
  <UiCard v-if="typedError && !loading" class="max-w-lg mx-auto text-center" variant="outline" shadow="none" size="sm">
    <div class="flex items-center">
      <div v-if="typedError.status">
        <img v-if="typedError.status < 500" class="w-7" src="~/assets/images/icons/alert-removebg.png"
          alt="Alert Icon" />
        <img v-else class="w-7" src="~/assets/images/icons/error-removebg.png" alt="Error Icon" />
      </div>
      <UiSubtitle size="sm">
        Oops! An error occurred:
        <DevOnly>
          {{ typedError.message }}
        </DevOnly>
        {{ typedError.details ? `  ${typedError.details}` : '' }}
      </UiSubtitle>
    </div>
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
