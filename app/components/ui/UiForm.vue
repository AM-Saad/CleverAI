<template>
  <UForm :schema="schema" :state="state" v-bind="$attrs">
    <slot />
  </UForm>
</template>

<script setup lang="ts">
/**
 * UiForm — schema-validated form orchestrator (provides validation context to
 * child `UiFormField`s). Thin wrapper over the themed `UForm`; `@submit` and
 * other listeners fall through via `$attrs`. Purely a logic/validation
 * boundary — no visual chrome of its own.
 */
defineProps<{
  schema?: unknown;
  state: Record<string, unknown>;
}>();
defineOptions({ inheritAttrs: false });
</script>
