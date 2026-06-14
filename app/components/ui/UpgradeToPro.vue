<!-- app/components/ui/UpgradeToPro.vue -->
<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  title?: string;
  description?: string;
  generationsUsed?: number;
  generationsQuota?: number;
}>();

const title = props.title || "Free Tier Quota Exceeded";
const description =
  props.description ||
  "You have used all of your free generations for this month.";
const isLoading = ref(false);

const handleUpgrade = async () => {
  isLoading.value = true;
  try {
    // Here you would implement your actual subscription flow
    // For now, we'll just redirect to a placeholder page
    window.location.href = "/pricing";
  } catch (error) {
    console.error("Error during upgrade process:", error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="upgrade-container">
    <div class="upgrade-card">
      <div class="upgrade-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.2 7.8l-7.7 7.7-4-4-5.7 5.7" />
          <path d="M15 7h6v6" />
        </svg>
      </div>
      <h2 class="upgrade-title">{{ title }}</h2>
      <p class="upgrade-description">{{ description }}</p>

      <div v-if="generationsUsed !== undefined && generationsQuota !== undefined" class="upgrade-quota">
        <div class="upgrade-progress">
          <div class="upgrade-progress-bar" :style="{
            width: `${Math.min(100, (generationsUsed / generationsQuota) * 100)}%`,
          }" />
        </div>
        <div class="upgrade-stats">
          <span>{{ generationsUsed }}/{{ generationsQuota }} generations used</span>
        </div>
      </div>

      <div class="upgrade-features">
        <h3>Upgrade to Pro and Get:</h3>
        <ul>
          <li>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Unlimited AI generations
          </li>
          <li>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Access to all LLM models
          </li>
          <li>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Priority generation queue
          </li>
        </ul>
      </div>

      <button :disabled="isLoading" class="upgrade-button" @click="handleUpgrade">
        <span v-if="isLoading">
          <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </span>
        <span v-else>Upgrade to Pro</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.upgrade-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

.upgrade-card {
  background-color: var(--color-white);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-card-hover);
  padding: 2rem;
  width: 100%;
  max-width: 32rem;
  text-align: center;
}

.upgrade-icon {
  background-color: var(--color-surface-subtle);
  color: var(--color-accent-blue);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.upgrade-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--color-content-on-background);
}

.upgrade-description {
  color: var(--color-content-secondary);
  margin-bottom: 1.5rem;
}

.upgrade-quota {
  margin-bottom: 1.5rem;
}

.upgrade-progress {
  height: 12px;
  background-color: var(--color-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.upgrade-progress-bar {
  height: 100%;
  background-color: var(--color-accent-blue);
}

.upgrade-stats {
  color: var(--color-content-secondary);
  font-size: 0.875rem;
}

.upgrade-features {
  text-align: left;
  margin-bottom: 1.5rem;
  border-top: 1px solid var(--color-secondary);
  padding-top: 1.5rem;
}

.upgrade-features h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.upgrade-features ul {
  padding: 0;
  list-style: none;
}

.upgrade-features li {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
  color: var(--color-content-on-background);
}

.upgrade-features li svg {
  color: var(--color-success);
  margin-right: 0.5rem;
  flex-shrink: 0;
}

.upgrade-button {
  background-color: var(--color-accent-blue);
  color: var(--color-on-primary);
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-lg);
  border: none;
  width: 100%;
  cursor: pointer;
  transition: background-color 0.2s;
}

.upgrade-button:hover {
  background-color: color-mix(in srgb, var(--color-accent-blue) 80%, black);
}

.upgrade-button:disabled {
  background-color: color-mix(in srgb, var(--color-accent-blue) 50%, white);
  cursor: not-allowed;
}

.upgrade-button svg {
  display: inline-block;
  vertical-align: middle;
}
</style>
