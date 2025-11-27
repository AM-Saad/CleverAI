<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useRoute } from "vue-router";
import { useUpdateFolder } from "~/composables/folders/useFolders";


type MobileProp = boolean | "auto";

const emit = defineEmits<{ (e: "close"): void }>();
const props = withDefaults(
  defineProps<{
    show: boolean;
    // pass‑through Drawer options (all optional)
    side?: "right" | "left";
    mobile?: MobileProp;
    breakpoint?: string;
    handleVisible?: number;
    sheetHeight?: string;
    widthClasses?: string;
    teleportTo?: string;
    lockScroll?: boolean;
    threshold?: number;
    fastVelocity?: number;
    backdrop?: boolean;
  }>(),
  {
    side: "right",
    mobile: "auto",
    breakpoint: "(max-width: 639px)",
    handleVisible: 28,
    sheetHeight: "75vh",
    widthClasses: "w-1/4 min-w-60",
    teleportTo: "body",
    lockScroll: true,
    threshold: 20,
    fastVelocity: 450,
    backdrop: true,
  },
);

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
const { updateFolder, updating, typedError } = useUpdateFolder(id);
const { createMaterial, } = useMaterialsStore(id);
const { handleOfflineSubmit } = useOffline();
const items = ref(["text", "video", "audio", "pdf", "url", "document"]);

const toast = useToast();

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
  <ui-drawer :show="props.show" :side="props.side" :mobile="props.mobile" :breakpoint="props.breakpoint"
    :sheet-height="props.sheetHeight" :width-classes="props.widthClasses" :teleport-to="props.teleportTo"
    :lock-scroll="props.lockScroll" :threshold="props.threshold" :backdrop="props.backdrop"
    :fast-velocity="props.fastVelocity" title="Upload Material" @close="emit('close')">
    <template #subtitle>
      <ui-paragraph>Upload your material files here.</ui-paragraph>
    </template>

    <UForm :schema="schema" :state="state" class="space-y-2" @submit="onSubmit">
      <UFormField label="Material Title" name="materialTitle">
        <UInput v-model="state.materialTitle" placeholder="Enter material title" :ui="{
          root: 'w-full',
        }" />
      </UFormField>

      <UFormField label="Material Type" name="materialType">
        <USelectMenu v-model="state.materialType" :items="items" :ui="{
          base: 'w-full',
        }" />
      </UFormField>

      <UFormField label="Material Content" name="materialContent">
        <UiTextArea v-model="state.materialContent" placeholder="Enter your material content here..." />
      </UFormField>

      <div class="flex items-center gap-2 mt-3">
        <UButton type="submit" size="sm" :loading="updating">Submit</UButton>
        <UButton color="neutral" size="sm" variant="soft" @click="emit('close')">Cancel</UButton>
      </div>
    </UForm>
  </ui-drawer>
</template>
