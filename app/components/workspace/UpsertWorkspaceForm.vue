<script setup lang="ts">

import type { CreateWorkspaceDTO } from "@@/shared/utils/workspace.contract";
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
    type: Object as () => Workspace | null,
    default: null,
  },
});

const state = reactive<Partial<CreateWorkspaceDTO>>({
  title: props.workspace?.title,
  description: props.workspace?.description || '',
});

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
    }

    if (result) {
      toast.add({
        title: props.workspace ? "Workspace updated" : "Workspace created",
        description: props.workspace ? "Your workspace has been updated." : "Your workspace is ready.",
        color: "success",
      });

      emit("cancel");
      emit("created");
      state.title = "";
      state.description = "";
    }

  } catch (err) {
    toast.add({
      title: "Error",
      description: typedError.value?.message || "An error occurred.",
    });
  }
}

const closeModel = (): void => {
  state.title = "";
  state.description = "";
  props.workspace ? resetUpdate() : resetCreate();
  emit("cancel");
};

watch(
  () => props.workspace,
  (newWorkspace) => {
    if (!newWorkspace) {
      state.title = "";
      state.description = "";
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
      :title="props.workspace ? 'Edit Workspace' : 'Create Workspace'"
      :icon="props.workspace ? 'uil:workspace-network' : 'uil:workspace-network'"
      :description="props.workspace ? '' : 'Workspace is a container for organizing your content.'">
      <template #body>
        <shared-error-message :error="typedError || updateTypedError" />
        <u-form :schema="CreateWorkspaceDTO" :state="state" class="space-y-2" @submit="onSubmit">
          <u-form-field label="Title" name="title" required>
            <u-input v-model="state.title" autofocus class="w-full" />
          </u-form-field>

          <u-form-field label="Description" name="description">
            <u-input v-model="state.description" class="w-full" />
          </u-form-field>
          <div class="flex gap-3 justify-end pt-2">
            <u-button variant="ghost" @click="closeModel" :disabled="creating || updating">
              Cancel
            </u-button>
            <u-button type="submit" :loading="creating || updating" :disabled="!canSubmit">
              {{ props.workspace ? "Update" : "Create" }}
            </u-button>

          </div>
        </u-form>
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>
