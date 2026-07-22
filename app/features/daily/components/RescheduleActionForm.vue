<template>
  <form
    class="move-form"
    @submit.prevent="$emit('submit', targetDate, targetTime || null)"
  >
    <p class="move-form__title">{{ title }}</p>
    <UiFormField label="New date">
      <UiInput v-model="targetDate" type="date" required />
    </UiFormField>
    <UiFormField label="Time" hint="Leave empty to make it an all-day item">
      <UiInput v-model="targetTime" type="time" />
    </UiFormField>
    <UiButton type="submit" block :loading="saving">Move item</UiButton>
  </form>
</template>

<script setup lang="ts">
const props = defineProps<{
  title?: string;
  initialDate: string;
  initialTime: string | null;
  saving: boolean;
}>();
defineEmits<{ submit: [targetDate: string, targetTime: string | null] }>();
const targetDate = ref(props.initialDate);
const targetTime = ref<string | null>(props.initialTime);
watch(
  () => [props.initialDate, props.initialTime] as const,
  ([date, time]) => {
    targetDate.value = date;
    targetTime.value = time;
  },
);
</script>

<style scoped>
.move-form {
  display: flex;
  flex-direction: column;
}
.move-form__title {
  color: var(--color-content-secondary);
  font-weight: 600;
}
</style>
