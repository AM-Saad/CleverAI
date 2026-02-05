<script setup lang="ts">
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useRoute } from "vue-router";
import type { UploadMaterialResponse } from "~/services/Material";
import type { GatewayGenerateResponse } from "~/shared/utils/llm-generate.contract";

type SourceType = "text" | "file";
type DepthOption = "quick" | "balanced" | "deep";

const emit = defineEmits<{
  (e: "close"): void;
  (e: "generated", result: GatewayGenerateResponse): void;
}>();
const props = defineProps<{
  show: boolean;
}>();

const route = useRoute();
const { data } = useAuth();
const { $api } = useNuxtApp();
const toast = useToast();
const { subscriptionInfo, updateFromData, handleApiError } = useSubscriptionStore();

const id = route.params.id as string;
const { createMaterial, uploadMaterial, uploading } = useMaterialsStore(id);
const { handleOfflineSubmit } = useOffline();

// ----- Source toggle -----
const sourceTabItems = [
  { icon: 'mdi:text-box', name: 'Text', value: 'text' as const },
  { icon: 'mdi:file-document', name: 'File', value: 'file' as const },
];
const sourceTabIndex = ref(0);
const sourceType = computed<SourceType>(() => sourceTabItems[sourceTabIndex.value]?.value ?? 'text');

function onSourceTabSelect(index: number) {
  sourceTabIndex.value = index;
}

// ----- Text form schema & state -----
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

const items = ref(["text", "video", "audio", "pdf", "url", "document"]);

// ----- File upload state -----
const selectedFile = ref<File | null>(null);
const uploadedMaterial = ref<UploadMaterialResponse | null>(null);
const generateAfterUpload = ref(false);
const generationType = ref<"flashcards" | "quiz">("flashcards");
const selectedDepth = ref<DepthOption>("balanced");
const generating = ref(false);
const genError = ref<string | null>(null);

const depthOptions = [
  { value: "quick" as const, label: "Quick", description: "5-15 items" },
  { value: "balanced" as const, label: "Balanced", description: "15-30 items" },
  { value: "deep" as const, label: "Deep", description: "30-50 items" },
];

// Computed values for file upload
// Mirrors server-side adaptive count logic for UI preview
const estimatedItemCount = computed(() => {
  if (!uploadedMaterial.value) return 0;

  // Guard for tiny inputs (matches server-side MIN_TOKENS_FOR_FULL_GENERATION)
  if (uploadedMaterial.value.tokenEstimate < 300) {
    return 3; // MIN_ITEMS_FOR_TINY_INPUT
  }

  const tokensPerItem: Record<DepthOption, number> = {
    quick: 3000,
    balanced: 2000,
    deep: 1000,
  };

  const maxItems: Record<DepthOption, number> = {
    quick: 15,
    balanced: 30,
    deep: 50,
  };

  const perItem = tokensPerItem[selectedDepth.value];
  const baseCount = Math.max(
    5,
    Math.floor(uploadedMaterial.value.tokenEstimate / perItem)
  );
  return Math.min(baseCount, maxItems[selectedDepth.value]);
});

const estimatedCost = computed(() => {
  if (!uploadedMaterial.value) return 0;
  const totalTokens = uploadedMaterial.value.tokenEstimate * 1.4;
  return (totalTokens / 1_000_000) * 0.5;
});

// ----- Text form handlers -----
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
      const userData = data.value?.user
        ? {
          email: data.value.user.email,
          name: data.value.user.name,
          image: data.value.user.image,
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
      closeAndReset();
    }

  } catch (err: unknown) {
    // Error handled by store
  }
};

// ----- File upload handlers -----
function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  selectedFile.value = target.files?.[0] || null;
  uploadedMaterial.value = null;
  genError.value = null;
}

async function handleUpload() {
  if (!selectedFile.value) return;
  genError.value = null;

  const result = await uploadMaterial(selectedFile.value, selectedFile.value.name);
  if (result) {
    uploadedMaterial.value = result;
    // If not generating, just close
    if (!generateAfterUpload.value) {
      toast.add({
        title: "Upload Complete",
        description: `Material "${result.title}" uploaded successfully`,
        color: "success",
      });
      closeAndReset();
    }
  }
}

async function handleGenerate() {
  if (!uploadedMaterial.value) return;

  generating.value = true;
  genError.value = null;

  try {
    const generateFn =
      generationType.value === "flashcards"
        ? $api.gateway.generateFlashcards.bind($api.gateway)
        : $api.gateway.generateQuiz.bind($api.gateway);

    const result = await generateFn("", {
      materialId: uploadedMaterial.value.materialId,
      save: true,
      replace: false,
      generationConfig: {
        depth: selectedDepth.value,
      },
    });

    if (result.subscription) {
      updateFromData({ subscription: result.subscription });
    }

    const itemType = generationType.value === "flashcards" ? "flashcards" : "questions";
    toast.add({
      title: "Generation Complete",
      description: `Generated ${result.savedCount || estimatedItemCount.value} ${itemType} successfully`,
      color: "success",
    });

    if (subscriptionInfo.value.tier === "FREE" && subscriptionInfo.value.remaining <= 3) {
      toast.add({
        title: "Free Tier Limit",
        description: `You have ${subscriptionInfo.value.remaining} generations left.`,
        color: "warning",
      });
    }

    emit("generated", result);
    closeAndReset();
  } catch (err) {
    handleApiError(err);
    genError.value = err instanceof Error ? err.message : "Generation failed. Please try again.";
    toast.add({
      title: "Generation Failed",
      description: genError.value,
      color: "error",
    });
  } finally {
    generating.value = false;
  }
}

function resetState() {
  // Text form
  state.materialTitle = "";
  state.materialContent = "";
  state.materialType = "text";
  // File upload
  selectedFile.value = null;
  uploadedMaterial.value = null;
  generateAfterUpload.value = false;
  generationType.value = "flashcards";
  selectedDepth.value = "balanced";
  generating.value = false;
  genError.value = null;
  // Source
  sourceTabIndex.value = 0;
}

function closeAndReset() {
  emit("close");
  setTimeout(resetState, 300);
}

// Reset when modal closes
watch(
  () => props.show,
  (newVal) => {
    if (!newVal) {
      setTimeout(resetState, 300);
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <shared-dialog-modal :show="props.show" @close="emit('close')" title="Add Material" icon="i-heroicons-document-plus"
      description="Add a new material to your folder.">

      <template #body>
        <!-- Source Toggle -->
        <div class="flex gap-2 mb-4">
          <ui-tabs v-model="sourceTabIndex" :items="sourceTabItems" @select="onSourceTabSelect" direction="row" />
        </div>

        <!-- TEXT FORM -->
        <u-form v-if="sourceType === 'text'" :schema="schema" :state="state" class="space-y-2" @submit="onSubmit">
          <u-form-field label="Material Title" name="materialTitle">
            <u-input v-model="state.materialTitle" placeholder="Enter material title" :ui="{
              root: 'w-full',
            }" />
          </u-form-field>


          <u-form-field label="Material Content" name="materialContent">
            <u-textarea v-model="state.materialContent" placeholder="Enter your material content here..." :ui="{
              root: 'w-full',
            }" />
          </u-form-field>

          <div class="flex gap-3 justify-end pt-2">
            <u-button variant="ghost" @click="emit('close')">Cancel</u-button>
            <u-button type="submit">Submit</u-button>
          </div>
        </u-form>

        <!-- FILE UPLOAD -->
        <div v-else class="space-y-4">
          <!-- File Input (before upload) -->
          <div v-if="!uploadedMaterial" class="py-3">

            <input type="file" accept=".pdf,.docx,.txt" @change="onFileChange"
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold  file:text-blue-700 hover:file:bg-blue-100  dark:file:text-blue-300" />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Supported formats: PDF, DOCX, TXT (max 50MB)
            </p>

            <!-- Generate toggle -->
            <div class="mt-4 flex items-center gap-3">
              <USwitch v-model="generateAfterUpload" />
              <ui-label>Generate flashcards/quiz after upload</ui-label>
            </div>

            <!-- Generation options (when enabled) -->
            <div v-if="generateAfterUpload" class="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md space-y-3">
              <div class="flex items-center gap-3">
                <label class="text-sm font-medium">Generate:</label>
                <UButtonGroup>
                  <UButton size="sm" :color="generationType === 'flashcards' ? 'primary' : 'neutral'"
                    :variant="generationType === 'flashcards' ? 'solid' : 'ghost'"
                    @click="generationType = 'flashcards'">
                    Flashcards
                  </UButton>
                  <UButton size="sm" :color="generationType === 'quiz' ? 'primary' : 'neutral'"
                    :variant="generationType === 'quiz' ? 'solid' : 'ghost'" @click="generationType = 'quiz'">
                    Quiz
                  </UButton>
                </UButtonGroup>
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">Depth</label>
                <div class="grid grid-cols-3 gap-2">
                  <button v-for="option in depthOptions" :key="option.value" :class="[
                    'px-3 py-2 rounded-md border-2 transition-colors text-xs',
                    selectedDepth === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                  ]" @click="selectedDepth = option.value">
                    <div class="font-medium">{{ option.label }}</div>
                    <div class="text-gray-500 dark:text-gray-400">{{ option.description }}</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Upload Progress -->
          <div v-if="uploading" class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span>Uploading and extracting text...</span>
            </div>
            <UProgress :value="100" animation="carousel" />
          </div>

          <!-- Document Info (after upload, if generating) -->
          <div v-if="uploadedMaterial && generateAfterUpload" class="space-y-4">
            <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-md space-y-2">
              <div class="flex justify-between text-sm">
                <span class="font-medium">Title:</span>
                <span>{{ uploadedMaterial.title }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="font-medium">Characters:</span>
                <span>{{ uploadedMaterial.charCount.toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="font-medium">Estimated Tokens:</span>
                <span>{{ uploadedMaterial.tokenEstimate.toLocaleString() }}</span>
              </div>
            </div>

            <!-- Estimated Output -->
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
              <div class="text-sm space-y-1">
                <div class="font-medium">Estimated Output:</div>
                <div class="text-gray-700 dark:text-gray-300">
                  ~{{ estimatedItemCount }} {{ generationType === 'flashcards' ? 'flashcards' : 'questions' }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                  <span>Estimated cost (approximate): ${{ estimatedCost.toFixed(4) }}</span>
                  <UTooltip text="Final cost depends on model selection and output length.">
                    <UIcon name="i-heroicons-information-circle" class="w-4 h-4 cursor-help" />
                  </UTooltip>
                </div>
              </div>
            </div>
          </div>

          <!-- Error -->
          <div v-if="genError"
            class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
            {{ genError }}
          </div>

          <!-- Footer buttons for file upload -->
          <div class="flex gap-3 justify-end pt-2">
            <UButton variant="ghost" @click="emit('close')">Cancel</UButton>
            <UButton v-if="!uploadedMaterial" :loading="uploading" :disabled="!selectedFile || uploading"
              @click="handleUpload">
              {{ generateAfterUpload ? 'Upload & Continue' : 'Upload' }}
            </UButton>
            <UButton v-else-if="generateAfterUpload" :loading="generating" @click="handleGenerate">
              Generate {{ generationType === 'flashcards' ? 'Flashcards' : 'Questions' }}
            </UButton>
          </div>
        </div>
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>
