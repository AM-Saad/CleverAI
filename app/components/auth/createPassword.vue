<script setup lang="ts">
// Optional password strength meter using zxcvbn-ts
import { ref, computed, watch, onMounted } from 'vue'
let zxcvbn: any = null
// Lazy-load dictionaries to keep bundle size reasonable and guard on failure
const loadZxcvbn = async () => {
  try {
    if (zxcvbn) return
    // @ts-ignore optional dependency lazy-loaded at runtime
    const core: any = await import('@zxcvbn-ts/core')
    // @ts-ignore optional dependency lazy-loaded at runtime
    const common: any = await import('@zxcvbn-ts/language-common')
    // @ts-ignore optional dependency lazy-loaded at runtime
    const en: any = await import('@zxcvbn-ts/language-en')
    const opts = core?.zxcvbnOptions || core?.default?.zxcvbnOptions
    zxcvbn = core?.zxcvbn || core?.default?.zxcvbn || null
    if (opts && typeof opts.setOptions === 'function') {
      opts.setOptions({
        translations: en?.translations,
        graphs: common?.adjacencyGraphs,
        dictionary: { ...(common?.dictionary || {}), ...(en?.dictionary || {}) },
      })
    }
  } catch (e) {
    // Silently ignore; strength meter stays disabled
    zxcvbn = null
  }
}
const route = useRoute();
const token = computed(() => route.query.token as string);

// Use composable for password creation logic
const {
  credentials,
  loading,
  error,
  success,
  createPassword,
} = useCreatePassword();

// Strength meter state
const strengthScore = ref<number | null>(null)
const strengthLabel = computed(() => {
  switch (strengthScore.value) {
    case 0: return 'Very weak'
    case 1: return 'Weak'
    case 2: return 'Fair'
    case 3: return 'Good'
    case 4: return 'Strong'
    default: return ''
  }
})

onMounted(async () => {
  await loadZxcvbn()
})

watch(() => credentials.value.password, (pwd) => {
  if (!pwd || !zxcvbn) {
    strengthScore.value = null
    return
  }
  const res = zxcvbn(pwd)
  strengthScore.value = res.score
})

const handleSubmit = async (): Promise<void> => {
  if (!token.value) {
    return;
  }
  await createPassword(token.value);
};
</script>

<template>
  <div class="flex items-center justify-center flex-col w-full max-w-xl mx-auto">
    <form ref="login" method="post" class="form w-full focus:bg-gray-100" autocomplete="test" @submit="handleSubmit">
      <ui-title>Create Password</ui-title>
      <ui-paragraph size="sm" color="muted" class="mb-4">
        This page will expire in 15 minutes
      </ui-paragraph>
      <shared-error-message v-if="error" :error="error.message" />
      <shared-success-message v-if="success" :message="success" />
      <div class="my-2 rounded-md relative transition duration-10 00 text-xs">

        <div class="form-group mb-2">
          <ui-input-field id="login-email-client" v-model="credentials.password!" type="password" name="password"
            class="input" placeholder="Add your password..." autocomplete="false | unknown-autocomplete-value"
            tabindex="1" label="Password" />
          <div v-if="strengthScore !== null" class="mt-1">
            <div class="h-1 w-full bg-gray-200 rounded">
              <div class="h-1 rounded transition-all" :style="{
                width: `${((strengthScore ?? 0) + 1) * 20}%`,
                backgroundColor: strengthScore! >= 3 ? '#16a34a' : strengthScore! >= 2 ? '#f59e0b' : '#ef4444'
              }" />
            </div>
            <ui-paragraph size="xs" color="muted" class="mt-1">Strength: {{ strengthLabel }}</ui-paragraph>
          </div>

        </div>
        <div class="form-group">
          <ui-input-field id="login-email-client" v-model="credentials.confirmPassword!" type="password"
            name="confirmPassword" class="input" placeholder="Confirm your password..."
            autocomplete="false | unknown-autocomplete-value" tabindex="2" label="Confirm Password" />
        </div>
        <div class="mt-2 space-y-1 text-xs">
          <div
            :class="{ 'text-green-600': /[A-Z]/.test(credentials.password || ''), 'text-gray-500': !/[A-Z]/.test(credentials.password || '') }">
            • Uppercase letter</div>
          <div
            :class="{ 'text-green-600': /[a-z]/.test(credentials.password || ''), 'text-gray-500': !/[a-z]/.test(credentials.password || '') }">
            • Lowercase letter</div>
          <div
            :class="{ 'text-green-600': /\d/.test(credentials.password || ''), 'text-gray-500': !/\d/.test(credentials.password || '') }">
            • Number</div>
          <div
            :class="{ 'text-green-600': /[^A-Za-z0-9]/.test(credentials.password || ''), 'text-gray-500': !/[^A-Za-z0-9]/.test(credentials.password || '') }">
            • Symbol</div>
          <div
            :class="{ 'text-green-600': (credentials.password || '').length >= 8, 'text-gray-500': (credentials.password || '').length < 8 }">
            • At least 8 characters</div>
        </div>
      </div>
      <div>
        <u-button type="submit" :disabled="loading || (strengthScore !== null && strengthScore < 3)" tabindex="3"
          @click.prevent="handleSubmit" :loading="loading">
          Create
        </u-button>
      </div>
    </form>
  </div>
</template>
