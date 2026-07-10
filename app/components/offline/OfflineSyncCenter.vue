<script setup lang="ts">
import { listOfflinePacks } from "~/utils/offline-v2/repository";
import type { StoredOfflineMutation } from "~/utils/offline-v2/types";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

const offline = useOfflineRuntime();
const route = useRoute();
const packs = ref<Array<Record<string, unknown>>>([]);
const conflicts = ref<Awaited<ReturnType<typeof offline.conflictsList>>>([]);
const mutations = ref<StoredOfflineMutation[]>([]);
const busy = ref(false);
const selectedWorkspaceId = computed(() => typeof route.query.workspaceId === "string" ? route.query.workspaceId : undefined);
const needsAttention = computed(() => offline.rejected.value + offline.conflicts.value + offline.blocked.value);
const lastSyncLabel = computed(() => offline.lastSyncAt.value ? new Date(offline.lastSyncAt.value).toLocaleString() : "Not yet");

const refresh = async () => {
  if (!offline.accountId.value) return;
  await offline.refreshStatus();
  [packs.value, conflicts.value, mutations.value] = await Promise.all([listOfflinePacks(offline.accountId.value), offline.conflictsList(), offline.mutationsList()]);
};
const download = async () => {
  busy.value = true;
  try { await offline.downloadWorkspace(selectedWorkspaceId.value); } finally { busy.value = false; await refresh(); }
};
const sync = async () => { busy.value = true; try { await offline.sync(); } finally { busy.value = false; await refresh(); } };
const retryPack = async (pack: Record<string, unknown>) => { busy.value = true; try { await offline.downloadWorkspace(typeof pack.workspaceId === "string" ? pack.workspaceId : undefined); } finally { busy.value = false; await refresh(); } };
const removePack = async (pack: Record<string, unknown>) => { if (!window.confirm("Remove this downloaded data from this device? Unsynced local changes will be kept.")) return; busy.value = true; try { await offline.removeDownloadedWorkspace(typeof pack.workspaceId === "string" ? pack.workspaceId : undefined); } finally { busy.value = false; await refresh(); } };
const packFailures = (pack: Record<string, unknown>) => Array.isArray(pack.failures) ? pack.failures.map(String) : [];
const isScheduleConflict = (entity: string) => entity === "review" || entity === "languageReview";
onMounted(() => { void refresh(); });
</script>

<template>
  <section class="space-y-5" aria-labelledby="sync-center-title">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <ui-title id="sync-center-title" tag="h1" size="xl">Offline Sync Center</ui-title>
        <ui-paragraph size="sm">Downloaded work stays on this device and syncs safely when you reconnect.</ui-paragraph>
      </div>
      <div class="flex gap-2">
        <ui-button :loading="busy" variant="soft" @click="sync">Sync now</ui-button>
        <ui-button :loading="busy" :disabled="!offline.isOnline" @click="download">Make available offline</ui-button>
      </div>
    </div>

    <ui-panel variant="subtle" size="md">
      <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt class="text-content-secondary">Pending</dt><dd class="font-semibold">{{ offline.pending }}</dd></div>
        <div><dt class="text-content-secondary">Retrying</dt><dd class="font-semibold">{{ offline.retrying }}</dd></div>
        <div><dt class="text-content-secondary">Sign in to sync</dt><dd class="font-semibold">{{ offline.blocked }}</dd></div>
        <div><dt class="text-content-secondary">Needs attention</dt><dd class="font-semibold">{{ needsAttention }}</dd></div>
        <div><dt class="text-content-secondary">Last sync</dt><dd class="font-semibold">{{ lastSyncLabel }}</dd></div>
      </dl>
    </ui-panel>

    <ui-panel v-if="conflicts.length" variant="subtle" size="md" class="space-y-3">
      <ui-title tag="h2" size="base">Resolve collisions</ui-title>
      <div v-for="conflict in conflicts" :key="conflict.id" class="flex flex-wrap items-center justify-between gap-3 border-t border-secondary pt-3 first:border-0 first:pt-0">
        <div><p class="font-medium">{{ conflict.entity }} changed elsewhere</p><p class="text-sm text-content-secondary">{{ conflict.reason }}</p></div>
        <div class="flex gap-2"><ui-button size="sm" variant="soft" @click="offline.resolveConflict(conflict.mutationId, 'keep-server').then(refresh)">{{ isScheduleConflict(conflict.entity) ? "Keep server schedule" : "Use server" }}</ui-button><ui-button size="sm" @click="offline.resolveConflict(conflict.mutationId, 'keep-local').then(refresh)">{{ isScheduleConflict(conflict.entity) ? "Apply my grade after current" : "Keep mine" }}</ui-button></div>
      </div>
    </ui-panel>

    <ui-panel v-if="mutations.length" variant="subtle" size="md" class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <ui-title tag="h2" size="base">Saved local changes</ui-title>
        <ui-button size="sm" variant="soft" @click="offline.exportRecovery">Export recovery file</ui-button>
      </div>
      <div v-for="mutation in mutations" :key="mutation.id" class="flex flex-wrap items-center justify-between gap-3 border-t border-secondary pt-3 first:border-0 first:pt-0">
        <div>
          <p class="font-medium">{{ mutation.entity }} · {{ mutation.operation }}</p>
          <p class="text-sm text-content-secondary">{{ mutation.status }}<span v-if="mutation.lastError"> · {{ mutation.lastError }}</span></p>
        </div>
        <ui-button v-if="mutation.status === 'retry' || mutation.status === 'rejected'" size="sm" variant="soft" @click="offline.retryMutation(mutation.id).then(refresh)">Try again</ui-button>
      </div>
    </ui-panel>

    <ui-panel variant="subtle" size="md">
      <ui-title tag="h2" size="base" class="mb-2">Downloads</ui-title>
      <p v-if="!packs.length" class="text-sm text-content-secondary">No workspace has been downloaded yet.</p>
      <ul v-else class="space-y-3 text-sm"><li v-for="pack in packs" :key="String(pack.id)" class="border-t border-secondary pt-3 first:border-0 first:pt-0"><div class="flex flex-wrap justify-between gap-3"><span>{{ pack.workspaceId || "Account data" }}</span><span class="text-content-secondary">{{ pack.status }} · {{ Math.round(Number(pack.bytes || 0) / 1024) }} KB</span></div><p v-for="failure in packFailures(pack)" :key="failure" class="mt-1 text-content-secondary">{{ failure }}</p><div class="mt-2 flex gap-2"><ui-button size="sm" variant="soft" :disabled="!offline.isOnline" @click="retryPack(pack)">Refresh</ui-button><ui-button size="sm" variant="ghost" @click="removePack(pack)">Remove</ui-button></div></li></ul>
    </ui-panel>
  </section>
</template>
