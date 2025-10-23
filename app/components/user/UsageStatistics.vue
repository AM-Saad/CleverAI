<template>
  <div class="md:col-span-3 mt-6">
    <UiCard class-name="flex flex-col gap-4">
      <UiSubtitle>AI Usage Statistics (Last 30 Days)</UiSubtitle>
      <div class="flex flex-col gap-6">
        <div
          v-if="isLlmUsageLoading"
          class="flex justify-center items-center py-12"
        >
          <div
            class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"
          />
        </div>

        <div v-else-if="llmUsageError" class="text-center py-8">
          <p class="text-red-500">{{ llmUsageError }}</p>
          <button class="mt-4 btn bg-primary text-white" @click="fetchLlmUsage">
            Try Again
          </button>
        </div>

        <div v-else-if="llmUsage" class="flex flex-col gap-6">
          <!-- Date range selector -->
          <UiCard
            size="sm"
            class-name="flex items-end gap-4 text-sm"
            variant="ghost"
          >
            <label>From</label>
            <input type="date" v-model="startDate" class="input" />
            <label>To</label>
            <input type="date" v-model="endDate" class="input" />
            <UButton
              :disabled="isDateRangeInvalid"
              @click="fetchLlmUsage"
              size="xs"
              variant="subtle"
              >Apply</UButton
            >
            <p v-if="isDateRangeInvalid" class="text-sm text-red-500">
              From date must be on or before To date
            </p>
          </UiCard>
          <!-- Usage Summary -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <UiCard>
              <UiSubtitle> Total AI Calls </UiSubtitle>
              <p>
                {{ llmUsage.summary.totalCalls }}
              </p>
            </UiCard>
            <UiCard>
              <UiSubtitle>Total Tokens</UiSubtitle>
              <p>{{ formatNumber(llmUsage.summary.totalTokens) }}</p>
            </UiCard>
            <UiCard>
              <UiSubtitle>Input Tokens</UiSubtitle>
              <p>{{ formatNumber(llmUsage.summary.totalPromptTokens) }}</p>
            </UiCard>
            <UiCard>
              <UiSubtitle>Output Tokens</UiSubtitle>
              <p>{{ formatNumber(llmUsage.summary.totalCompletionTokens) }}</p>
            </UiCard>
          </div>

          <!-- Usage by Feature -->
          <div>
            <UiSubtitle>Usage by Feature</UiSubtitle>
            <div
              class="overflow-x-auto mt-4 p-sm bg-muted border border-muted rounded"
            >
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-muted">
                    <th class="pb-1">Feature</th>
                    <th class="pb-1">Calls</th>
                    <th class="pb-1">Tokens</th>
                    <th class="pb-1 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(feature, idx) in llmUsage.byFeature"
                    :key="feature.name"
                    :class="`${idx !== llmUsage.byFeature.length - 1 ? 'border-b dark:border-gray-700' : ''}`"
                  >
                    <td class="py-2">{{ feature.name }}</td>
                    <td class="py-2">{{ feature.calls }}</td>
                    <td class="py-2">{{ formatNumber(feature.tokens) }}</td>
                    <td class="py-2 text-right">
                      ${{ feature.usd.toFixed(4) }}
                    </td>
                  </tr>
                  <tr class="">
                    <td class="pt-2 font-medium">Total</td>
                    <td class="pt-2 font-medium">
                      {{ llmUsage.summary.totalCalls }}
                    </td>
                    <td class="pt-2 font-medium">
                      {{ formatNumber(llmUsage.summary.totalTokens) }}
                    </td>
                    <td class="pt-2 font-medium text-right">
                      ${{ llmUsage.summary.totalUsd.toFixed(4) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Usage by Model -->
          <div>
            <UiSubtitle>Usage by Model</UiSubtitle>
            <div
              class="overflow-x-auto mt-4 p-sm bg-muted border border-muted rounded"
            >
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-muted">
                    <th class="pb-2">Model</th>
                    <th class="pb-2">Calls</th>
                    <th class="pb-2">Tokens</th>
                    <th class="pb-2 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(model, idx) in llmUsage.byModel"
                    :key="model.name"
                    :class="`${idx !== llmUsage.byModel.length - 1 ? 'border-b dark:border-gray-700' : ''}`"
                  >
                    <td class="py-2">{{ model.name }}</td>
                    <td class="py-2">{{ model.calls }}</td>
                    <td class="py-2">{{ formatNumber(model.tokens) }}</td>
                    <td class="py-2 text-right">${{ model.usd.toFixed(4) }}</td>
                  </tr>
                  <tr>
                    <td class="pt-2 font-medium">Total</td>
                    <td class="pt-2 font-medium">
                      {{ llmUsage.summary.totalCalls }}
                    </td>
                    <td class="pt-2 font-medium">
                      {{ formatNumber(llmUsage.summary.totalTokens) }}
                    </td>
                    <td class="pt-2 font-medium text-right">
                      ${{ llmUsage.summary.totalUsd.toFixed(4) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Recent Usage -->
          <div>
            <UiSubtitle>Recent Usage</UiSubtitle>
            <div
              class="overflow-x-auto mt-4 p-sm bg-muted border border-muted rounded"
            >
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-muted">
                    <th class="pb-2">Date</th>
                    <th class="pb-2">Feature</th>
                    <th class="pb-2">Model</th>
                    <th class="pb-2 text-right">Tokens</th>
                    <th class="pb-2 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(usage, idx) in llmUsage.recentUsage"
                    :key="usage.id"
                    :class="`${idx !== llmUsage.recentUsage.length - 1 ? 'border-b border-muted' : ''}`"
                  >
                    <td class="py-2">{{ formatDate(usage.date) }}</td>
                    <td class="py-2">{{ usage.feature }}</td>
                    <td class="py-2">{{ usage.model }}</td>
                    <td class="py-2 text-right">
                      {{ formatNumber(usage.tokens) }}
                    </td>
                    <td class="py-2 text-right">${{ usage.usd.toFixed(6) }}</td>
                  </tr>
                  <tr v-if="llmUsage.recentUsage.length === 0">
                    <td colspan="5" class="py-2 text-center text-gray-500">
                      No Recent Usage
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 text-gray-500">
          <p>No AI usage data available.</p>
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
interface LlmUsageSummary {
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalUsd: number;
  periodStart: string;
  periodEnd: string;
}

interface LlmUsageItem {
  name: string;
  calls: number;
  tokens: number;
  usd: number;
}

interface LlmUsageEntry {
  id: string;
  date: string;
  feature: string;
  model: string;
  tokens: number;
  usd: number;
}

interface LlmUsageData {
  summary: LlmUsageSummary;
  byFeature: LlmUsageItem[];
  byModel: LlmUsageItem[];
  dailyUsage: {
    date: string;
    calls: number;
    tokens: number;
    usd: number;
  }[];
  recentUsage: LlmUsageEntry[];
}

const { status } = useAuth();

// Create LLM usage data ref
const llmUsage = ref<LlmUsageData | null>(null);
const isLlmUsageLoading = ref(true);
const llmUsageError = ref<string | null>(null);

// Date selector state (YYYY-MM-DD)
const formatIsoDate = (d: Date) => d.toISOString().split("T")[0];
const nowDate = new Date();
const thirtyDaysAgoDate = new Date(
  nowDate.getTime() - 30 * 24 * 60 * 60 * 1000,
);
const startDate = ref<string>(formatIsoDate(thirtyDaysAgoDate) as string);
const endDate = ref<string>(formatIsoDate(nowDate) as string);

const isDateRangeInvalid = computed(
  () => new Date(startDate.value) > new Date(endDate.value),
);

// Utility functions for formatting
const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "0";
  return new Intl.NumberFormat().format(num);
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Function to fetch LLM usage data
const fetchLlmUsage = async () => {
  if (status.value !== "authenticated") return;

  isLlmUsageLoading.value = true;
  llmUsageError.value = null;

  try {
    // Build query params from date selectors (ensure ISO YYYY-MM-DD)
    const params = new URLSearchParams();
    if (startDate.value) params.set("from", startDate.value);
    if (endDate.value) params.set("to", endDate.value);

    const url = `/api/user/llm-usage?${params.toString()}`;

    const response = await $fetch<LlmUsageData>(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    llmUsage.value = response;
  } catch (err: unknown) {
    console.error("Error fetching LLM usage data:", err);
    if (
      err &&
      typeof err === "object" &&
      "data" in err &&
      err.data &&
      typeof err.data === "object" &&
      "message" in err.data &&
      typeof err.data.message === "string"
    ) {
      llmUsageError.value = err.data.message;
    } else {
      llmUsageError.value = "Failed to load LLM usage data";
    }
  } finally {
    isLlmUsageLoading.value = false;
  }
};

// Fetch user profile and LLM usage data on component mount
onMounted(async () => {
  if (status.value === "authenticated") {
    // Fetch LLM usage data
    await fetchLlmUsage();
  }
});
</script>
