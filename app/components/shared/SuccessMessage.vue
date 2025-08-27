<script setup lang="ts">
const props = defineProps({
  message: {
    type: String,
    required: false,
    default: "",
  },
})
</script>

<template>
  <div v-if="props.message">
    <p
      class="bg-gray-100/50 dark:bg-transparent border dark:border-green-400 my-2 px-3 py-2 rounded-lg text-green-400 text-xs"
      v-html="props.message"
    ></p>
  </div>
</template>
