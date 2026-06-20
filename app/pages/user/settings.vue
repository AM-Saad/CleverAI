<template>
  <shared-page-wrapper title="Settings" subtitle="Manage your account preferences and application settings">
    <div class="mt-8 flex w-full min-w-0 flex-col gap-4">
      <UiPanel variant="transparent" size="xs" class-name="min-w-0">
        <ui-tabs
          id-prefix="settings-tabs"
          v-model="activeIndex"
          :items="tabItems"
          aria-label="Settings sections"
          direction="row"
          activation-mode="manual"
          @select="select"
        />
      </UiPanel>

      <!-- Tab Content -->
      <section
        v-if="currentTab"
        :id="panelId(currentTab.key)"
        class="w-full min-w-0"
        role="tabpanel"
        tabindex="0"
        :aria-labelledby="tabId(currentTab.key)"
      >
        <component :is="currentTab.component" :key="currentTab.key" />
      </section>
    </div>

  </shared-page-wrapper>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, ref, resolveComponent } from "vue";
import type { IconName } from "~/utils/icons.generated";

const AsyncTabLoading = defineComponent({
  name: "SettingsTabLoading",
  setup() {
    const UiPanel = resolveComponent("UiPanel");
    return () =>
      h(UiPanel, { variant: "surface", size: "lg", contentClass: "text-sm text-content-secondary" }, () => "Loading settings…");
  },
});

const AsyncTabError = defineComponent({
  name: "SettingsTabError",
  setup() {
    const UiPanel = resolveComponent("UiPanel");
    return () =>
      h(UiPanel, {
        variant: "subtle",
        size: "lg",
        role: "alert",
        className:
          "border-error/30 bg-error/10",
        contentClass: "text-sm text-error-text",
      }, "This settings section could not load. Try refreshing the page.");
  },
});

const settingsTab = (loader: () => Promise<unknown>) =>
  defineAsyncComponent({
    loader: loader as any,
    loadingComponent: AsyncTabLoading,
    errorComponent: AsyncTabError,
    delay: 150,
    timeout: 12000,
  });

const SettingsAccountTab = settingsTab(
  () => import("~/components/settings/AccountTab.vue"),
);
const SettingsNotificationPreferences = settingsTab(
  () => import("~/features/notifications/components/NotificationPreferences.vue"),
);
const SettingsStudyTab = settingsTab(
  () => import("~/components/settings/StudyTab.vue"),
);
const SettingsSecurityTab = settingsTab(
  () => import("~/components/settings/SecurityTab.vue"),
);
const SettingsDataPrivacyTab = settingsTab(
  () => import("~/components/settings/DataPrivacyTab.vue"),
);
const SettingsLanguagePreferences = settingsTab(
  () => import("~/components/settings/LanguageSettingsTab.vue"),
);

// Tab configuration
interface SettingsTab {
  key: string;
  name: string;
  icon: IconName;
  component: Component;
}

const tabs: SettingsTab[] = [
  {
    key: "account",
    name: "Account",
    icon: "user",
    component: SettingsAccountTab,
  },
  {
    key: "notifications",
    name: "Notifications",
    icon: "bell",
    component: SettingsNotificationPreferences,
  },
  {
    key: "study",
    name: "Study",
    icon: "study",
    component: SettingsStudyTab,
  },
  {
    key: "security",
    name: "Security",
    icon: "security",
    component: SettingsSecurityTab,
  },
  {
    key: "data",
    name: "Data & Privacy",
    icon: "document",
    component: SettingsDataPrivacyTab,
  },
  {
    key: "language",
    name: "Language",
    icon: "translation",
    component: SettingsLanguagePreferences,
  },
];

const activeIndex = ref(0);
const currentTab = computed(() => tabs[activeIndex.value]);
const tabItems = computed(() =>
  tabs.map((tab) => ({
    key: tab.key,
    name: tab.name,
    icon: tab.icon,
    panelId: panelId(tab.key),
  })),
);

function panelId(key: string) {
  return `settings-tabs-panel-${key}`;
}

function tabId(key: string) {
  return `settings-tabs-tab-${key}`;
}

function select(index: number) {
  activeIndex.value = index;

}




</script>
