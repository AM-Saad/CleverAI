<template>
  <shared-page-wrapper title="Settings" subtitle="Manage your account preferences and application settings">
    <div class="flex flex-col md:flex-row gap-8 h-screen w-full mt-8">
      <ui-card className=" h-full" variant="ghost" size="xs">
        <ui-tabs v-model="activeIndex" :items="tabs" @select="select" :direction="{ base: 'row', md: 'column' }" />
      </ui-card>
      <!-- Tab Content -->
      <div class="w-full min-h-full">
        <component :is="currentTab?.component" />
      </div>
    </div>

  </shared-page-wrapper>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, type Component } from "vue";
import type { IconName } from "~/utils/icons.generated";

const SettingsAccountTab = defineAsyncComponent(
  () => import("~/components/settings/AccountTab.vue"),
);
const SettingsNotificationPreferences = defineAsyncComponent(
  () => import("~/components/settings/NotificationPreferences.vue"),
);
const SettingsStudyTab = defineAsyncComponent(
  () => import("~/components/settings/StudyTab.vue"),
);
const SettingsSecurityTab = defineAsyncComponent(
  () => import("~/components/settings/SecurityTab.vue"),
);
const SettingsDataPrivacyTab = defineAsyncComponent(
  () => import("~/components/settings/DataPrivacyTab.vue"),
);
const SettingsLanguagePreferences = defineAsyncComponent(
  () => import("~/pages/language/settings.vue"),
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



function select(index: number) {
  activeIndex.value = index;

}




</script>
