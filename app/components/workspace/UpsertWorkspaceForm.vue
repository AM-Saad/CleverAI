<script setup lang="ts">

import type {
  CreateWorkspaceDTO,
  WorkspaceSummary,
} from "@@/shared/utils/workspace.contract";
import type { FormSubmitEvent } from "@nuxt/ui";
const toast = useToast();

const emit = defineEmits(["cancel", "created"]);

const { createWorkspace, creating, typedError, reset: resetCreate } = useCreateWorkspace();
const { updateWorkspace, updating, typedError: updateTypedError, reset: resetUpdate } = useUpdateWorkspace();
const canSubmit = computed(
  () => !!state.title && state.title.trim().length > 0 && !creating.value,
);
const props = defineProps({
  show: Boolean,
  workspace: {
    type: Object as () => WorkspaceSummary | null,
    default: null,
  },
});

const state = reactive<Partial<CreateWorkspaceDTO>>({
  title: props.workspace?.title,
  description: props.workspace?.description || '',
});

// Create-from-source: seed a new workspace with pasted notes / a topic as its
// first material. The new row then surfaces the "Generate" coverage-gap action.
const mode = ref<"blank" | "content">("blank");
const materialContent = ref("");

const resetForm = (): void => {
  state.title = "";
  state.description = "";
  materialContent.value = "";
  mode.value = "blank";
};

async function onSubmit(event: FormSubmitEvent<any>) {
  event.preventDefault();
  if (!canSubmit.value || !state.title) return;
  try {
    let result;
    if (props.workspace) {
      result = await updateWorkspace({
        id: (props.workspace as any).id,
        title: state.title.trim(),
        description: state.description || '',
      });

    } else {

      result = await createWorkspace({
        title: state.title.trim(),
        description: state.description || '',
      });

      // Attach pasted content as the workspace's first material (reuses the
      // same materialContent update path the detail page uses).
      const content = materialContent.value.trim();
      const newId = (result as any)?.id;
      if (result && mode.value === "content" && content && newId) {
        await updateWorkspace({
          id: newId,
          materialTitle: state.title.trim(),
          materialContent: content,
          materialType: "text",
        });
      }
    }

    if (result) {
      const seeded = !props.workspace && mode.value === "content" && !!materialContent.value.trim();
      toast.add({
        title: props.workspace ? "Workspace updated" : "Workspace created",
        description: props.workspace
          ? "Your workspace has been updated."
          : seeded
            ? "Seeded with your content — use Generate to turn it into cards."
            : "Your workspace is ready.",
        color: "success",
      });

      emit("cancel");
      emit("created");
      resetForm();
    }

  } catch (err) {
    toast.add({
      title: "Error",
      description: typedError.value?.message || "An error occurred.",
    });
  }
}

const closeModel = (): void => {
  resetForm();
  props.workspace ? resetUpdate() : resetCreate();
  emit("cancel");
};

watch(
  () => props.workspace,
  (newWorkspace) => {
    if (!newWorkspace) {
      resetForm();
      return;
    }
    state.title = newWorkspace?.title;
    state.description = newWorkspace?.description || '';
  },
);

</script>

<template>
  <Teleport to="body">
    <!-- use the modal component, pass in the prop -->
    <shared-dialog-modal :show="props.show" @close="closeModel"
      :title="props.workspace ? 'Edit Workspace' : 'Create Workspace'" :icon="'workspaces'"
      :description="props.workspace ? '' : 'Workspace is a container for organizing your content.'">
      <template #body>
        <shared-error-message :error="typedError || updateTypedError" />
        <UiForm :schema="CreateWorkspaceDTO" :state="state" class="space-y-2" @submit="onSubmit">
          <div v-if="!props.workspace" class="flex items-center gap-1" role="group" aria-label="Create mode">
            <ui-button type="button" size="xs" :variant="mode === 'blank' ? 'soft' : 'ghost'" tone="neutral"
              :aria-pressed="mode === 'blank'" @click="mode = 'blank'">
              Blank
            </ui-button>
            <ui-button type="button" size="xs" :variant="mode === 'content' ? 'soft' : 'ghost'" tone="neutral"
              leading-icon="i-lucide-sparkles" :aria-pressed="mode === 'content'" @click="mode = 'content'">
              From a topic / paste
            </ui-button>
          </div>

          <UiFormField label="Title" name="title" required>
            <ui-input v-model="state.title" autofocus class="w-full" />
          </UiFormField>

          <UiFormField label="Description" name="description">
            <ui-input v-model="state.description" class="w-full" />
          </UiFormField>

          <UiFormField v-if="!props.workspace && mode === 'content'" label="Content" name="materialContent"
            help="Pasted notes become this workspace's first material — then turn it into cards from the list.">
            <ui-textarea v-model="materialContent" :rows="6" class="w-full"
              placeholder="Paste notes, an article, or a topic to seed this workspace…" />
          </UiFormField>

          <div class="flex gap-3 justify-end pt-2">
            <ui-button variant="ghost" @click="closeModel" :disabled="creating || updating">
              Cancel
            </ui-button>
            <ui-button type="submit" :loading="creating || updating" :disabled="!canSubmit">
              {{ props.workspace ? "Update" : "Create" }}
            </ui-button>

          </div>
        </UiForm>
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>
