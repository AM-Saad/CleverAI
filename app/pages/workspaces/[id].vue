<template>
  <div class="workspace-home">
    <AppPageHeader
      :title="workspace?.title || 'Workspace'"
      :subtitle="workspace?.description || 'Materials and study tools'"
      back-to="/workspaces"
    >
      <template v-if="workspace" #actions>
        <UiIconButton
          icon="pencil"
          label="Edit workspace"
          size="sm"
          tone="neutral"
          variant="ghost"
          @click="editWorkspace"
        />
      </template>
    </AppPageHeader>

    <WorkspacePill v-if="workspace" class="workspace-home__switcher" />

    <div v-if="loading" class="workspace-home__skeletons">
      <UiSkeleton class="h-28 w-full rounded-[var(--component-card-radius)]" />
      <UiSkeleton class="h-16 w-full rounded-[var(--component-card-radius)]" />
      <UiSkeleton class="h-16 w-full rounded-[var(--component-card-radius)]" />
    </div>

    <UiEmptyState
      v-else-if="loadError"
      icon="triangle-alert"
      title="Couldn't open this workspace"
      :description="loadError"
      action-label="Back to workspaces"
      action-icon="chevron-left"
      @action="navigateTo('/workspaces')"
    />

    <template v-else-if="workspace">
      <section
        class="workspace-home__section"
        aria-labelledby="workspace-next-title"
      >
        <UiTitle
          id="workspace-next-title"
          tag="h2"
          size="base"
          weight="bold"
          color="content-on-surface-strong"
        >
          Next step
        </UiTitle>

        <UiPanel
          variant="subtle"
          size="md"
          :tone="nextStepTone"
          class-name="workspace-home__next"
        >
          <div class="workspace-home__next-content">
            <span
              class="workspace-home__next-icon"
              :class="{
                'workspace-home__next-icon--complete': nextStepKind === 'done',
              }"
              aria-hidden="true"
            >
              <UiIcon :name="nextStepIcon" class="h-5 w-5" />
            </span>
            <div class="workspace-home__next-copy">
              <UiTitle
                tag="h3"
                size="base"
                weight="bold"
                color="content-on-surface-strong"
              >
                {{ nextStepTitle }}
              </UiTitle>
              <UiParagraph size="xs" color="content-secondary">
                {{ nextStepDescription }}
              </UiParagraph>
            </div>
            <UiButton
              :to="nextStepTo"
              size="sm"
              :tone="nextStepKind === 'due' ? 'primary' : 'neutral'"
              :variant="nextStepKind === 'due' ? 'solid' : 'soft'"
              :loading="reviewStats.isLoading.value"
              :disabled="reviewStats.isLoading.value"
            >
              {{ nextStepAction }}
            </UiButton>
          </div>
        </UiPanel>
      </section>

      <section
        class="workspace-home__section"
        aria-labelledby="workspace-tools-title"
      >
        <div class="workspace-home__section-heading">
          <UiTitle
            id="workspace-tools-title"
            tag="h2"
            size="base"
            weight="bold"
            color="content-on-surface-strong"
          >
            Workspace tools
          </UiTitle>
          <UiParagraph size="xs" color="content-secondary">
            Everything here stays scoped to {{ workspace.title }}.
          </UiParagraph>
        </div>

        <UiPanel variant="surface" size="xs">
          <nav class="workspace-home__tools" aria-label="Workspace tools">
            <UiListCard
              v-for="tool in workspaceTools"
              :key="tool.title"
              :to="tool.to"
              variant="ghost"
              size="lg"
              :title="tool.title"
              :description="tool.description"
            >
              <template #leading>
                <span class="workspace-home__tool-icon">
                  <UiIcon :name="tool.icon" class="h-5 w-5" />
                </span>
              </template>
              <template #action>
                <UiIcon
                  name="chevron-right"
                  class="h-4 w-4"
                  aria-hidden="true"
                />
              </template>
            </UiListCard>
          </nav>
        </UiPanel>
      </section>

      <section
        class="workspace-home__section"
        aria-labelledby="workspace-quick-title"
      >
        <UiTitle
          id="workspace-quick-title"
          tag="h2"
          size="base"
          weight="bold"
          color="content-on-surface-strong"
        >
          Quick actions
        </UiTitle>
        <div class="workspace-home__quick-actions">
          <UiButton
            to="/materials?upload=1"
            tone="primary"
            variant="soft"
            leading-icon="upload"
          >
            Add material
          </UiButton>
          <UiButton
            tone="neutral"
            variant="ghost"
            leading-icon="pencil"
            @click="editWorkspace"
          >
            Edit workspace
          </UiButton>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import { useReviewStats } from "~/features/review/composables/useReviewStats";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";

definePageMeta({ middleware: "auth" });

type NextStepKind = "loading" | "error" | "empty" | "due" | "done";

const route = useRoute();
const workspaceId = computed<string | undefined>(() => {
  const id = route.params.id;
  return typeof id === "string" && id ? id : undefined;
});
const { workspaces, loading, error, setActive } = useActiveWorkspace();
const workspace = computed(
  () => workspaces.value?.find((item) => item.id === workspaceId.value) ?? null,
);
const reviewStats = useReviewStats({ workspaceId, immediate: true });

const loadError = computed(() => {
  if (error.value?.message) return error.value.message;
  if (!workspaceId.value) return "Workspace ID is missing.";
  if (!loading.value && !workspace.value)
    return "This workspace was not found.";
  return null;
});
const reviewTo = computed(() =>
  workspaceId.value
    ? `/review?workspaceId=${encodeURIComponent(workspaceId.value)}`
    : "/review",
);
const nextStepKind = computed<NextStepKind>(() => {
  if (reviewStats.isLoading.value && !reviewStats.stats.value) return "loading";
  if (reviewStats.error.value) return "error";
  const stats = reviewStats.stats.value;
  if (!stats?.total) return "empty";
  if (stats.due > 0) return "due";
  return "done";
});
const nextStepTitle = computed(() => {
  if (nextStepKind.value === "loading") return "Checking your review queue";
  if (nextStepKind.value === "error") return "Review status is unavailable";
  if (nextStepKind.value === "empty") return "Build your first study set";
  if (nextStepKind.value === "done") return "You're caught up";
  const due = reviewStats.stats.value?.due ?? 0;
  return `${due} ${due === 1 ? "card is" : "cards are"} ready`;
});
const nextStepDescription = computed(() => {
  if (nextStepKind.value === "loading") {
    return "Finding the most useful next action.";
  }
  if (nextStepKind.value === "error") {
    return "You can still open materials or start a review session.";
  }
  if (nextStepKind.value === "empty") {
    return "Add a source, then generate flashcards or quiz questions from it.";
  }
  if (nextStepKind.value === "done") {
    return "Nothing is due. Add another source or return later.";
  }
  return "A short review now will keep this subject fresh.";
});
const nextStepAction = computed(() => {
  if (nextStepKind.value === "empty" || nextStepKind.value === "done") {
    return "Open materials";
  }
  return "Start review";
});
const nextStepTo = computed(() =>
  nextStepKind.value === "empty" || nextStepKind.value === "done"
    ? "/materials"
    : reviewTo.value,
);
const nextStepIcon = computed(() => {
  if (nextStepKind.value === "empty") return "file-stack";
  if (nextStepKind.value === "done") return "circle-check";
  if (nextStepKind.value === "error") return "circle-alert";
  return "brain";
});
const nextStepTone = computed(() => {
  if (nextStepKind.value === "done") return "success" as const;
  if (nextStepKind.value === "due") return "info" as const;
  return "neutral" as const;
});

const workspaceTools = computed(() => [
  {
    title: "Materials",
    description: "Upload, search, and open source content",
    to: "/materials",
    icon: "file-stack",
  },
  {
    title: "Flashcards & quizzes",
    description: "Practice generated study content in a focused session",
    to: reviewTo.value,
    icon: "brain",
  },
]);

function editWorkspace() {
  if (workspaceId.value) {
    navigateTo(`/workspaces?edit=${encodeURIComponent(workspaceId.value)}`);
  }
}

function syncActiveWorkspace(id: string | undefined) {
  if (id) setActive(id);
}

onMounted(() => syncActiveWorkspace(workspaceId.value));
watch(workspaceId, syncActiveWorkspace);
</script>

<style scoped>
.workspace-home {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: var(--space-6);
}

.workspace-home__switcher {
  align-self: flex-start;
}

.workspace-home__skeletons,
.workspace-home__section,
.workspace-home__section-heading {
  display: flex;
  flex-direction: column;
}

.workspace-home__skeletons,
.workspace-home__section {
  gap: var(--space-3);
}

.workspace-home__section-heading {
  gap: 2px;
}

.workspace-home__next-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.workspace-home__next-icon,
.workspace-home__tool-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-xl);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.workspace-home__next-icon {
  width: 42px;
  height: 42px;
}

.workspace-home__next-icon--complete {
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  color: var(--color-success);
}

.workspace-home__next-copy {
  min-width: 0;
  flex: 1;
}

.workspace-home__tools {
  display: flex;
  flex-direction: column;
}

.workspace-home__tool-icon {
  width: 40px;
  height: 40px;
}

.workspace-home__quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 420px) {
  .workspace-home__next-content {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .workspace-home__next-content > :last-child {
    margin-left: 54px;
  }
}
</style>
