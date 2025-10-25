<template>
  <div class="notifications-wrapper">
    <motion.div
      class="header"
      v-if="expanded"
      :initial="{ opacity: 0, y: -20 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ type: 'spring', stiffness: 300 }"
    >
      Notifications
    </motion.div>

    <motion.div
      class="stack-container"
      :variants="containerVariants"
      :initial="expanded ? 'expanded' : 'collapsed'"
      :animate="expanded ? 'expanded' : 'collapsed'"
    >
      <motion.div
        v-for="(note, i) in notes"
        :key="note.id as string"
        class="card"
        :variants="cardVariants"
        :custom="i"
        :initial="expanded ? 'expanded' : 'collapsed'"
        :animate="expanded ? 'expanded' : 'collapsed'"
        :transition="{ type: 'spring', damping: 20, stiffness: 200 }"
      >
        {{ note.text }}
      </motion.div>
    </motion.div>

    <button @click="toggle">
      {{ expanded ? 'Collapse' : 'Expand' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { motion } from 'motion-v'
interface Props {
    items: Array<Record<string, unknown>>;
}
const props = defineProps<Props>();

const expanded = ref(false)
const notes = ref(props.items)

function toggle() {
  expanded.value = !expanded.value
}

const containerVariants = {
  collapsed: { /* optionally define something for wrapper */ },
  expanded: { /* optionally define something when expanded */ },
}

const cardVariants = {
  collapsed: (i) => ({
    y: i * 10,
    scale: 1 - i * 0.02,
    zIndex: 100 - i,
  }),
  expanded: (i) => ({
    y: i * 60,
    scale: 1,
    zIndex: 100,
  }),
}
</script>

<style scoped>
.notifications-wrapper {
  width: 300px;
  margin: 50px auto;
}
.stack-container {
  position: relative;
  height: 200px; /* adjust as needed */
}
.card {
  position: absolute;
  width: 100%;
  padding: 16px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.header {
  font-size: 18px;
  margin-bottom: 12px;
  text-align: center;
}
button {
  margin-top: 20px;
}
</style>