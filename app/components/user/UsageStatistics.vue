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



<template>
  <div class="md:col-span-3 mt-6 h-fit min-w-0 max-w-full overflow-y-hidden">
    <UiPanel class-name="flex flex-col" size="lg" variant="transparent">
      <template #header>
        AI Usage Statistics (Last 30 Days)

        <!-- Date range selector -->

        <div class="mt-3 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-4">
          <fieldset class="flex min-w-0 flex-col gap-1">
            <UiLabel tag="label" for="llm-usage-start-date" size="sm">From</UiLabel>
            <ui-input id="llm-usage-start-date" type="date" v-model="startDate" aria-label="Usage start date" />
          </fieldset>

          <fieldset class="flex min-w-0 flex-col gap-1">
            <UiLabel tag="label" for="llm-usage-end-date" size="sm">To</UiLabel>
            <ui-input id="llm-usage-end-date" type="date" v-model="endDate" aria-label="Usage end date" />
          </fieldset>
          <ui-button :disabled="isDateRangeInvalid" @click="fetchLlmUsage" variant="subtle" size="sm">Apply</ui-button>
          <p v-if="isDateRangeInvalid" class="text-sm text-error-text">
            From date must be on or before To date
          </p>
        </div>
      </template>
      <div class="flex flex-col gap-6">
        <ui-loader v-if="isLlmUsageLoading" :is-fetching="isLlmUsageLoading" />
        <div v-else-if="llmUsageError" class="text-center py-8">
          <p class="text-error-text">{{ llmUsageError }}</p>
          <ui-button class="mt-4" @click="fetchLlmUsage">
            Try Again
          </ui-button>

        </div>

        <div v-else-if="llmUsage" class="flex flex-col gap-6 ">

          <!-- Usage Summary -->
          <!-- <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <UiCard shadow="sm" variant="default">
              <ui-label> Total AI Calls </ui-label>
              <p>
                {{ llmUsage.summary.totalCalls }}
              </p>
            </UiCard>
            <UiCard shadow="sm" variant="default">
              <ui-label>Total Tokens</ui-label>
              <p>{{ formatNumber(llmUsage.summary.totalTokens) }}</p>
            </UiCard>
            <UiCard shadow="sm" variant="default">
              <ui-label>Input Tokens</ui-label>
              <p>{{ formatNumber(llmUsage.summary.totalPromptTokens) }}</p>
            </UiCard>
            <UiCard shadow="sm" variant="default">
              <ui-label>Output Tokens</ui-label>
              <p>{{ formatNumber(llmUsage.summary.totalCompletionTokens) }}</p>
            </UiCard>
          </div> -->


          <!-- Usage by Feature -->
          <UiPanel class-name="mb-4" size="sm" variant="transparent">
            <template #header>Usage by Feature</template>
            <div class="max-w-full overflow-x-auto mt-2 border border-secondary rounded-[var(--radius-md)]" tabindex="0" aria-label="Usage by feature table">
              <table class="w-full text-left text-sm bg-surface">

                <thead class="dark:text-light">

                  <tr class="border-b border-secondary">
                    <th class="py-2 px-4 w-40 text-nowrap ">Feature</th>
                    <th class="py-2 px-4 w-40 text-nowrap ">Calls</th>
                    <th class="py-2 px-4 w-40 text-nowrap ">Tokens</th>
                    <th class="py-2 px-4 w-40 text-nowrap  text-right">Cost (USD)</th>
                  </tr>

                </thead>

                <tbody class=" dark:text-content-on-surface">

                  <tr v-for="(feature, idx) in llmUsage.byFeature" :key="feature.name"
                    :class="`${idx !== llmUsage.byFeature.length - 1 ? 'border-b border-secondary' : ''}`">
                    <td class="py-2 px-4 w-40 text-nowrap">{{ feature.name }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ feature.calls }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ formatNumber(feature.tokens) }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap text-right">${{ feature.usd.toFixed(4) }}</td>
                  </tr>
                  <tr class="font-bold">
                    <td class="py-2 px-4 w-40 text-nowrap">Total</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ llmUsage.summary.totalCalls }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ formatNumber(llmUsage.summary.totalTokens) }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap text-right">${{ llmUsage.summary.totalUsd.toFixed(4) }}</td>
                  </tr>

                </tbody>

              </table>
            </div>
          </UiPanel>

          <!-- Usage by Model -->
          <UiPanel class-name="mb-4" size="sm" variant="transparent">

            <template #header>Usage by Model</template>
            <div class="max-w-full overflow-x-auto mt-2 border border-secondary rounded-[var(--radius-md)]" tabindex="0" aria-label="Usage by model table">
              <table class="w-full text-left text-sm bg-surface">

                <thead class="dark:text-light">
                  <tr class="border-b border-secondary">
                    <th class="py-2 px-4 w-40 text-nowrap ">Model</th>
                    <th class="py-2 px-4 w-40 text-nowrap ">Calls</th>
                    <th class="py-2 px-4 w-40 text-nowrap ">Tokens</th>
                    <th class="py-2 px-4 w-40 text-nowrap  text-right">Cost (USD)</th>
                  </tr>

                </thead>

                <tbody class=" dark:text-content-on-surface">

                  <tr v-for="(model, idx) in llmUsage.byModel" :key="model.name"
                    :class="`${idx !== llmUsage.byModel.length - 1 ? 'border-b border-secondary' : ''}`">
                    <td class="py-2 px-4 w-40 text-nowrap">{{ model.name }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ model.calls }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ formatNumber(model.tokens) }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap text-right">${{ model.usd.toFixed(4) }}</td>
                  </tr>

                  <tr class="font-bold">
                    <td class="py-2 px-4 w-40 text-nowrap">Total</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ llmUsage.summary.totalCalls }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ formatNumber(llmUsage.summary.totalTokens) }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap text-right">${{ llmUsage.summary.totalUsd.toFixed(4) }}</td>
                  </tr>

                </tbody>

              </table>
            </div>
          </UiPanel>

          <!-- Recent Usage -->
          <UiPanel class-name="mb-4" size="sm" variant="transparent">
            <template #header>Recent Usage</template>
            <div class="max-w-full overflow-x-auto mt-2 border border-secondary rounded-[var(--radius-md)]" tabindex="0" aria-label="Recent AI usage table">
              <table class="w-full text-left text-sm bg-surface">

                <thead class="dark:text-light">

                  <tr class="border-b border-secondary">
                    <th class="py-2 px-4 w-40 text-nowrap ">Date</th>
                    <th class="py-2 px-4 w-40 text-nowrap ">Feature</th>
                    <th class="py-2 px-4 w-40 text-nowrap ">Model</th>
                    <th class="py-2 px-4 w-40 text-nowrap ">Tokens</th>
                    <th class="py-2 px-4 w-40 text-nowrap  text-right">Cost (USD)</th>
                  </tr>

                </thead>

                <tbody class=" dark:text-content-on-surface">

                  <tr v-for="(usage, idx) in llmUsage.recentUsage" :key="usage.id"
                    :class="`${idx !== llmUsage.recentUsage.length - 1 ? 'border-b border-secondary' : ''}`">
                    <td class="py-2 px-4 w-40 text-nowrap">{{ formatDate(usage.date) }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ usage.feature }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ usage.model }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap">{{ formatNumber(usage.tokens) }}</td>
                    <td class="py-2 px-4 w-40 text-nowrap text-right">${{ usage.usd.toFixed(6) }}</td>
                  </tr>

                  <tr v-if="llmUsage.recentUsage.length === 0">
                    <td colspan="5" class="py-2 px-4 text-center text-content-secondary">No Recent Usage</td>
                  </tr>

                </tbody>

              </table>
            </div>
          </UiPanel>
        </div>

        <div v-else class="text-center py-8 text-content-secondary">
          <p>No AI usage data available.</p>
        </div>
      </div>
    </UiPanel>
  </div>
</template>
