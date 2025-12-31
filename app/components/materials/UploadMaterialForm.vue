<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useRoute } from "vue-router";
import { useUpdateFolder } from "~/composables/folders/useFolders";

const emit = defineEmits<{ (e: "close"): void }>();
const props = defineProps<{
  show: boolean;
}>();

// ----- Form schema & state -----
const schema = z.object({
  materialTitle: z.string().min(1, "Title is required"),
  materialType: z
    .enum(["text", "video", "audio", "pdf", "url", "document"])
    .default("text"),
  materialContent: z.string().min(1, "Content is required"),
});

type Schema = z.output<typeof schema>;

const state = reactive<Schema>({
  materialTitle: "",
  materialType: "text",
  materialContent: "",
});

const route = useRoute();
const { data } = useAuth();

const id = route.params.id as string;
const { createMaterial, } = useMaterialsStore(id);
const { handleOfflineSubmit } = useOffline();
const items = ref(["text", "video", "audio", "pdf", "url", "document"]);


async function onSubmit(event: FormSubmitEvent<Schema>) {
  event.preventDefault();
  const title = state.materialTitle.trim();
  const content = state.materialContent.trim();
  const type = state.materialType;
  await saveMaterial(title, content, type);
}

const saveMaterial = async (title: string, content: string, type: "text" | "video" | "audio" | "pdf" | "url" | "document" | undefined) => {
  try {
    const payload = {
      title: title,
      content: content,
      type: type,
    };
    // handle offline case
    if (!navigator.onLine) {
      // Sanitize user data for IndexedDB (only store cloneable properties)
      const userData = data.value?.user
        ? {
          email: data.value.user.email,
          name: data.value.user.name,
          image: data.value.user.image,
          // Only include primitive/serializable properties
        }
        : null;

      handleOfflineSubmit({
        payload: { ...payload, folderId: id, user: userData },
        storeName: DB_CONFIG.STORES.FORMS,
        type: FORM_SYNC_TYPES.UPLOAD_MATERIAL,
      });
      return;
    }
    const success = await createMaterial({
      title: title,
      content: content,
      type: type,
    });
    if (success) {
      emit("close");

      // reset and close
      state.materialTitle = "";
      state.materialContent = "";
      state.materialType = "text";
    }

  } catch (err: unknown) {
    // {/* Show error toast */ }
  }
};
</script>

<template>
  <Teleport to="body">
    <shared-dialog-modal :show="props.show" @close="emit('close')" title="Upload Material"
      icon="i-heroicons-document-plus" description="Upload your material files here.">


      <template #body>
        <u-form :schema="schema" :state="state" class="space-y-2" @submit="onSubmit">
          <u-form-field label="Material Title" name="materialTitle">
            <u-input v-model="state.materialTitle" placeholder="Enter material title" :ui="{
              root: 'w-full',
            }" />
          </u-form-field>

          <u-form-field label="Material Type" name="materialType">
            <u-select-menu v-model="state.materialType" :items="items" :ui="{
              base: 'w-full',
            }" />
          </u-form-field>

          <u-form-field label="Material Content" name="materialContent">
            <u-textarea v-model="state.materialContent" placeholder="Enter your material content here..." :ui="{
              root: 'w-full',
            }" />
          </u-form-field>

          <div class="flex gap-3 justify-end pt-2">
            <u-button color="neutral" variant="soft" @click="emit('close')">Cancel</u-button>
            <u-button type="submit">Submit</u-button>
          </div>
        </u-form>
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>
