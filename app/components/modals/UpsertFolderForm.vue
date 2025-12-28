<script setup lang="ts">

import type { CreateFolderDTO } from "@@/shared/utils/folder.contract";
import type { FormSubmitEvent } from "@nuxt/ui";
const toast = useToast();

const emit = defineEmits(["cancel", "created"]);

const { createFolder, creating, typedError, reset: resetCreate } = useCreateFolder();
const { updateFolder, updating, typedError: updateTypedError, reset: resetUpdate } = useUpdateFolder();
const canSubmit = computed(
  () => !!state.title && state.title.trim().length > 0 && !creating.value,
);
const props = defineProps({
  show: Boolean,
  folder: {
    type: Object as () => Folder | null,
    default: null,
  },
});

const state = reactive<Partial<CreateFolderDTO>>({
  title: props.folder?.title,
  description: props.folder?.description || '',
});

async function onSubmit(event: FormSubmitEvent<any>) {
  event.preventDefault();
  if (!canSubmit.value || !state.title) return;
  try {
    let result;
    if (props.folder) {
      result = await updateFolder({
        id: (props.folder as any).id,
        title: state.title.trim(),
        description: state.description || '',
      });

    } else {

      result = await createFolder({
        title: state.title.trim(),
        description: state.description || '',
      });
    }

    if (result) {
      toast.add({
        title: props.folder ? "Folder updated" : "Folder created",
        description: props.folder ? "Your folder has been updated." : "Your folder is ready.",
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
  props.folder ? resetUpdate() : resetCreate();
  emit("cancel");
};

watch(
  () => props.folder,
  (newFolder) => {
    if (!newFolder) {
      state.title = "";
      state.description = "";
      return;
    }
    state.title = newFolder?.title;
    state.description = newFolder?.description || '';
  },
);

</script>

<template>
  <Teleport to="body">
    <!-- use the modal component, pass in the prop -->
    <UiDialogModal :show="props.show" @close="closeModel">
      <template #header>
        <div class="flex flex-col gap-1">
          <UiSubtitle class="flex items-center gap-2">
            <icon name="uil:folder-network" class="" />
            {{ props.folder ? "Edit" : "Create" }} Folder
          </UiSubtitle>
          <UiParagraph v-if="!props.folder" size="sm" color="muted">Folder is a container for organizing your content.
          </UiParagraph>
        </div>
      </template>
      <template #body>
        <shared-error-message :error="typedError || updateTypedError" />
        <UForm :schema="CreateFolderDTO" :state="state" class="space-y-2" @submit="onSubmit">
          <UFormField label="Title" name="title" required>
            <UInput v-model="state.title" autofocus class="w-full" />
          </UFormField>

          <UFormField label="Description" name="description">
            <UInput v-model="state.description" class="w-full" />
          </UFormField>

          <UButton type="submit" :loading="creating || updating" :disabled="!canSubmit">
            {{ props.folder ? "Update" : "Create" }}
          </UButton>
        </UForm>
      </template>
    </UiDialogModal>
  </Teleport>
</template>
