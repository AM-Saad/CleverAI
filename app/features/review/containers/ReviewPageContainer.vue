<template>
  <ReviewSessionView
    :workspace-id="workspaceId"
    :material-id="materialId"
    :close-to="closeTo"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import ReviewSessionView from "~/features/review/components/ReviewSessionView.vue";

const route = useRoute();
const { setActive } = useActiveWorkspace();

const workspaceId = computed(() => {
  const id = route.query.workspaceId;
  return typeof id === "string" ? id : undefined;
});
const materialId = computed(() => {
  const id = route.query.materialId;
  return typeof id === "string" ? id : undefined;
});
const closeTo = computed(() => {
  const requested = route.query.closeTo;
  if (
    typeof requested === "string" &&
    requested.startsWith("/") &&
    !requested.startsWith("//")
  ) {
    return requested;
  }
  return workspaceId.value ? `/workspaces/${workspaceId.value}` : "/learn";
});

function syncActiveWorkspace(id: string | undefined) {
  if (id) setActive(id);
}

onMounted(() => syncActiveWorkspace(workspaceId.value));
watch(workspaceId, syncActiveWorkspace);
</script>
