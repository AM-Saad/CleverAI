<script setup lang="ts">
import TextNote from "~/features/notes/components/TextNote.vue";
import { useBoardItemsStore } from "../composables/useBoardItemsStore";
import type { BoardItemState } from "../composables/useBoardItemsStore";
import type { Attachment, BoardItemComment, BoardItemLink } from "~/shared/utils/boardItem.contract";
import type { BoardItemExternalRef } from "@@/shared/utils/boardIntegration.contract";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import { createClientTempId } from "~/utils/local-first/tempIds";

const props = defineProps<{
  item: BoardItemState;
  workspaceId: string;
}>();

const emit = defineEmits<{
  update: [id: string, content: string];
  updateMeta: [id: string, patch: Partial<Pick<BoardItemState, "tags" | "dueDate" | "attachments">>];
  delete: [id: string];
  retry: [id: string];
  "toggle-fullscreen": [];
  close: [];
}>();

const route = useRoute();
const toast = useToast();
const tagsStore = useUserTagsStore(props.workspaceId);
const itemsStore = useBoardItemsStore(props.workspaceId);
const { $api } = useNuxtApp();
const offline = useOfflineRuntime();

// ─── Tabs ──────────────────────────────────────────────────────────────────
const activeTab = ref<"content" | "details" | "links" | "comments" | "integrations">("content");

// ─── Tags ──────────────────────────────────────────────────────────────────
const noteTags = computed(() =>
  (props.item.tags || [])
    .map((name) => tagsStore.getTagByName(name))
    .filter((t): t is NonNullable<typeof t> => t !== null)
);

function updateTags(tags: string[]) {
  emit("updateMeta", props.item.id, { tags });
}

// ─── Due Date ──────────────────────────────────────────────────────────────
const dueDateInput = computed({
  get() {
    if (!props.item.dueDate) return "";
    const d = new Date(props.item.dueDate as string);
    return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
  },
  set(val: string) {
    emit("updateMeta", props.item.id, { dueDate: val ? new Date(val).toISOString() : null });
  },
});

const dueDateLabel = computed(() => {
  if (!props.item.dueDate) return null;
  const d = new Date(props.item.dueDate as string);
  const now = new Date();
  const isOverdue = d < now;
  const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return { label, isOverdue };
});

function clearDueDate() {
  emit("updateMeta", props.item.id, { dueDate: null });
}

// ─── Attachments ───────────────────────────────────────────────────────────
const attachments = computed<Attachment[]>(() => props.item.attachments || []);

const showAddAttachment = ref(false);
const newAttachmentUrl = ref("");
const newAttachmentName = ref("");

function addAttachment() {
  const url = newAttachmentUrl.value.trim();
  const name = newAttachmentName.value.trim() || url;
  if (!url) return;

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    toast.add({ title: "Invalid URL", description: "Please enter a valid URL", color: "error" });
    return;
  }

  const updated: Attachment[] = [
    ...attachments.value,
    { id: `att-${Date.now()}`, name, url, type: "link" },
  ];
  emit("updateMeta", props.item.id, { attachments: updated });
  newAttachmentUrl.value = "";
  newAttachmentName.value = "";
  showAddAttachment.value = false;
}

function removeAttachment(attId: string) {
  const updated = attachments.value.filter((a) => a.id !== attId);
  emit("updateMeta", props.item.id, { attachments: updated });
}

function getAttachmentIcon(type: string): string {
  if (type === "pdf") return "i-lucide-file-text";
  if (type === "image") return "i-lucide-image";
  return "i-lucide-link";
}

// ─── Links ─────────────────────────────────────────────────────────────────
const allItems = computed(() =>
  Array.from(itemsStore.items.value.values()).filter((i) => i.id !== props.item.id)
);

const links = computed(() => props.item.links ?? { sent: [], received: [] });
const linksLoading = computed(() => props.item.linksLoading ?? false);

// Combined view for display
const linkedItems = computed(() => {
  const seen = new Set<string>();
  const result: Array<{ linkId: string; linkType: LinkType; direction: "sent" | "received"; item: BoardItemState | undefined }> = [];

  for (const link of links.value.sent) {
    if (seen.has(link.id)) continue;
    seen.add(link.id);
    result.push({
      linkId: link.id,
      linkType: link.linkType as LinkType,
      direction: "sent",
      item: link.target ? itemsStore.getItem(link.targetId) ?? {
        ...link.target,
        tags: link.target.tags || [],
        attachments: [],
        order: 0,
        userId: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BoardItemState : undefined,
    });
  }

  for (const link of links.value.received) {
    if (seen.has(link.id)) continue;
    seen.add(link.id);
    result.push({
      linkId: link.id,
      linkType: link.linkType as LinkType,
      direction: "received",
      item: link.source ? itemsStore.getItem(link.sourceId) ?? {
        ...link.source,
        tags: link.source.tags || [],
        attachments: [],
        order: 0,
        userId: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BoardItemState : undefined,
    });
  }

  return result;
});

const LINK_TYPE_LABELS: Record<string, string> = {
  PARENT: "Parent of",
  CHILD: "Child of",
  RELATED: "Related to",
  BLOCKS: "Blocks",
  BLOCKED_BY: "Blocked by",
  DUPLICATE: "Duplicate of",
};

// Add link form
const showAddLink = ref(false);
const newLinkTargetId = ref<string>("");
const newLinkType = ref<LinkType>("RELATED");
const addingLink = ref(false);
const relationIdAliases = new Map<string, string>();

const handleOfflineRelationRemap = (event: Event) => {
  const detail = (event as CustomEvent<{ entity?: string; idMap?: Record<string, string> }>).detail;
  if (!detail?.idMap || (detail.entity !== "boardLink" && detail.entity !== "boardComment")) return;
  const current = itemsStore.getItem(props.item.id);
  if (!current) return;
  for (const [tempId, serverId] of Object.entries(detail.idMap)) relationIdAliases.set(tempId, serverId);
  if (detail.entity === "boardLink" && current.links) {
    itemsStore.items.value.set(current.id, {
      ...current,
      links: {
        sent: current.links.sent.map((link) => ({ ...link, id: detail.idMap![link.id] ?? link.id })),
        received: current.links.received.map((link) => ({ ...link, id: detail.idMap![link.id] ?? link.id })),
      },
    });
  } else if (detail.entity === "boardComment" && current.comments) {
    itemsStore.items.value.set(current.id, {
      ...current,
      comments: current.comments.map((comment) => ({ ...comment, id: detail.idMap![comment.id] ?? comment.id })),
    });
  }
};

const handleOfflineRelationFailure = (event: Event) => {
  const detail = (event as CustomEvent<{
    entity?: string;
    entityId?: string;
    status?: string;
    operation?: string;
    rollbackData?: Record<string, unknown> | null;
    message?: string;
    canonical?: Record<string, unknown> | null;
    version?: number;
  }>).detail;
  if (!detail?.entityId || (detail.entity !== "boardLink" && detail.entity !== "boardComment")) return;
  const current = itemsStore.getItem(props.item.id);
  if (!current) return;

  if (detail.status === "applied") {
    if (detail.entity === "boardLink") {
      const links = current.links ?? { sent: [], received: [] };
      const withoutCurrent = {
        sent: links.sent.filter((link) => link.id !== detail.entityId),
        received: links.received.filter((link) => link.id !== detail.entityId),
      };
      const canonical = detail.canonical as BoardItemLink | null | undefined;
      if (canonical && !((canonical as unknown as { deleted?: boolean }).deleted)) {
        const prior = [...links.sent, ...links.received].find((link) => link.id === detail.entityId);
        const next = {
          ...prior,
          ...canonical,
          id: detail.entityId,
          offlineRevision: detail.version,
        } as BoardItemLink;
        const direction = next.sourceId === props.item.id ? "sent" : "received";
        withoutCurrent[direction] = [...withoutCurrent[direction], next];
      }
      itemsStore.items.value.set(current.id, { ...current, links: withoutCurrent });
    } else {
      const withoutCurrent = (current.comments ?? []).filter(
        (comment) => comment.id !== detail.entityId,
      );
      const canonical = detail.canonical as BoardItemComment | null | undefined;
      itemsStore.items.value.set(current.id, {
        ...current,
        comments:
          canonical && !((canonical as unknown as { deleted?: boolean }).deleted)
            ? [...withoutCurrent, {
                ...canonical,
                id: detail.entityId,
                offlineRevision: detail.version,
              }]
            : withoutCurrent,
      });
    }
    return;
  }
  if (detail.status !== "rejected" && detail.status !== "conflict") return;

  if (detail.status === "rejected") {
    if (detail.entity === "boardLink") {
      const links = current.links ?? { sent: [], received: [] };
      const withoutRejected = {
        sent: links.sent.filter((link) => link.id !== detail.entityId),
        received: links.received.filter((link) => link.id !== detail.entityId),
      };
      const rollback = detail.rollbackData as BoardItemLink | null | undefined;
      if (rollback) {
        const direction = rollback.sourceId === props.item.id ? "sent" : "received";
        withoutRejected[direction] = [...withoutRejected[direction], rollback];
      }
      itemsStore.items.value.set(current.id, { ...current, links: withoutRejected });
    } else {
      const withoutRejected = (current.comments ?? []).filter((comment) => comment.id !== detail.entityId);
      const rollback = detail.rollbackData as BoardItemComment | null | undefined;
      itemsStore.items.value.set(current.id, {
        ...current,
        comments: rollback ? [...withoutRejected, rollback] : withoutRejected,
      });
    }
  }
  toast.add({
    title: detail.status === "conflict" ? "Board relation conflict" : "Board relation rejected",
    description: detail.message ?? "Review the saved local change in Sync Center.",
    color: "warning",
  });
};

const handleOfflineRelationConflictResolution = (event: Event) => {
  const detail = (event as CustomEvent<{
    entity?: string;
    entityId?: string;
    strategy?: "keep-local" | "keep-server";
    serverVersion?: number;
    serverSnapshot?: Record<string, unknown> | null;
  }>).detail;
  if (
    !detail?.entityId ||
    !detail.strategy ||
    (detail.entity !== "boardLink" && detail.entity !== "boardComment")
  ) return;
  const current = itemsStore.getItem(props.item.id);
  if (!current) return;
  if (detail.strategy === "keep-local") return;

  if (detail.entity === "boardLink") {
    const links = current.links ?? { sent: [], received: [] };
    const next = {
      sent: links.sent.filter((link) => link.id !== detail.entityId),
      received: links.received.filter((link) => link.id !== detail.entityId),
    };
    const snapshot = detail.serverSnapshot as BoardItemLink | null | undefined;
    if (snapshot) {
      const relation = {
        ...snapshot,
        id: detail.entityId,
        offlineRevision: detail.serverVersion,
      } as BoardItemLink;
      const direction = relation.sourceId === props.item.id ? "sent" : "received";
      next[direction] = [...next[direction], relation];
    }
    itemsStore.items.value.set(current.id, { ...current, links: next });
  } else {
    const comments = (current.comments ?? []).filter(
      (comment) => comment.id !== detail.entityId,
    );
    const snapshot = detail.serverSnapshot as BoardItemComment | null | undefined;
    itemsStore.items.value.set(current.id, {
      ...current,
      comments: snapshot
        ? [...comments, {
            ...snapshot,
            id: detail.entityId,
            offlineRevision: detail.serverVersion,
          }]
        : comments,
    });
  }
};

onMounted(() => {
  window.addEventListener("offline-v2-entity-id-remapped", handleOfflineRelationRemap);
  window.addEventListener("offline-v2-sync-result", handleOfflineRelationFailure);
  window.addEventListener("offline-v2-board-conflict-resolved", handleOfflineRelationConflictResolution);
});
onBeforeUnmount(() => {
  window.removeEventListener("offline-v2-entity-id-remapped", handleOfflineRelationRemap);
  window.removeEventListener("offline-v2-sync-result", handleOfflineRelationFailure);
  window.removeEventListener("offline-v2-board-conflict-resolved", handleOfflineRelationConflictResolution);
});

const linkableItems = computed(() => {
  const linkedIds = new Set([
    ...links.value.sent.map((l) => l.targetId),
    ...links.value.received.map((l) => l.sourceId),
  ]);
  return allItems.value
    .filter((i) => !linkedIds.has(i.id) && !i.id.startsWith("temp-"))
    .map((i) => ({
      label: i.content.replace(/<[^>]*>/g, "").slice(0, 60) || "Empty item",
      value: i.id,
    }));
});

async function addLink() {
  if (!newLinkTargetId.value) return;
  addingLink.value = true;
  const id = createClientTempId("board-link");
  const link = {
    id,
    sourceId: props.item.id,
    targetId: newLinkTargetId.value,
    linkType: newLinkType.value,
    userId: "",
    createdAt: new Date(),
  } as BoardItemLink;
  const before = itemsStore.getItem(props.item.id);
  try {
    if (before) {
      itemsStore.items.value.set(before.id, {
        ...before,
        links: {
          sent: [...(before.links?.sent ?? []), link],
          received: before.links?.received ?? [],
        },
      });
    }
    await offline.queue({
      entity: "boardLink",
      operation: "boardLink.create",
      entityId: id,
      workspaceId: props.workspaceId,
      changedFields: ["sourceId", "targetId", "linkType"],
      payload: { sourceId: link.sourceId, targetId: link.targetId, linkType: link.linkType },
      localData: link as unknown as Record<string, unknown>,
    });
    showAddLink.value = false;
    newLinkTargetId.value = "";
    newLinkType.value = "RELATED";
  } catch {
    if (before) itemsStore.items.value.set(before.id, before);
    toast.add({ title: "Error", description: "Could not create link", color: "error" });
  } finally {
    addingLink.value = false;
  }
}

async function deleteLink(linkId: string) {
  linkId = relationIdAliases.get(linkId) ?? linkId;
  const before = itemsStore.getItem(props.item.id);
  const deletedLink = before?.links
    ? [...before.links.sent, ...before.links.received].find((link) => link.id === linkId)
    : undefined;
  try {
    if (before?.links) {
      itemsStore.items.value.set(before.id, {
        ...before,
        links: {
          sent: before.links.sent.filter((link) => link.id !== linkId),
          received: before.links.received.filter((link) => link.id !== linkId),
        },
      });
    }
    await offline.queue({
      entity: "boardLink",
      operation: "boardLink.delete",
      entityId: linkId,
      workspaceId: props.workspaceId,
      changedFields: ["deleted"],
      payload: {},
      rollbackData: deletedLink as unknown as Record<string, unknown> | undefined,
    });
  } catch {
    if (before) itemsStore.items.value.set(before.id, before);
    toast.add({ title: "Error", description: "Could not remove link", color: "error" });
  }
}

// ─── Comments ──────────────────────────────────────────────────────────────
const comments = computed(() => props.item.comments ?? []);
const commentsLoading = computed(() => props.item.commentsLoading ?? false);

const newCommentContent = ref("");
const addingComment = ref(false);

async function addComment() {
  const text = newCommentContent.value.trim();
  if (!text) return;
  addingComment.value = true;
  const id = createClientTempId("board-comment");
  const comment = {
    id,
    itemId: props.item.id,
    userId: "",
    content: text,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as BoardItemComment;
  const before = itemsStore.getItem(props.item.id);
  try {
    if (before) {
      itemsStore.items.value.set(before.id, {
        ...before,
        comments: [...(before.comments ?? []), comment],
      });
    }
    await offline.queue({
      entity: "boardComment",
      operation: "boardComment.create",
      entityId: id,
      workspaceId: props.workspaceId,
      changedFields: ["itemId", "content"],
      payload: { itemId: props.item.id, content: text },
      localData: comment as unknown as Record<string, unknown>,
    });
    newCommentContent.value = "";
  } catch {
    if (before) itemsStore.items.value.set(before.id, before);
    toast.add({ title: "Error", description: "Could not add comment", color: "error" });
  } finally {
    addingComment.value = false;
  }
}

function formatCommentDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Integrations ─────────────────────────────────────────────────────────
const externalRefs = ref<BoardItemExternalRef[]>([]);
const externalRefsLoading = ref(false);
const externalRefsError = ref<string | null>(null);

async function loadExternalRefs() {
  externalRefsLoading.value = true;
  externalRefsError.value = null;
  try {
    const result = await $api.boardIntegrations.getItemRefs(props.item.id);
    if (result.success) {
      externalRefs.value = result.data;
    } else {
      externalRefsError.value = result.error?.message || "Could not load integrations";
    }
  } catch {
    externalRefsError.value = "Could not load integrations";
  } finally {
    externalRefsLoading.value = false;
  }
}

function providerLabel(provider: BoardItemExternalRef["provider"]) {
  return provider === "jira" ? "Jira" : "Notion";
}

function providerIcon(provider: BoardItemExternalRef["provider"]) {
  return provider === "jira" ? "i-lucide-zap" : "i-lucide-grid-2x2";
}

function formatSyncDate(date?: string | Date | null) {
  if (!date) return "Never synced";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Load relational data when tab is opened ───────────────────────────────
watch(activeTab, async (tab) => {
  if (tab === "links" && !props.item.links) {
    await itemsStore.loadItemLinks(props.item.id);
  }
  if (tab === "comments" && !props.item.comments) {
    await itemsStore.loadItemComments(props.item.id);
  }
  if (tab === "integrations" && externalRefs.value.length === 0) {
    await loadExternalRefs();
  }
});

// Also load when item changes
watch(() => props.item.id, async () => {
  if (activeTab.value === "links") await itemsStore.loadItemLinks(props.item.id);
  if (activeTab.value === "comments") await itemsStore.loadItemComments(props.item.id);
  if (activeTab.value === "integrations") await loadExternalRefs();
}, { immediate: false });
</script>

<template>
  <UiPanel
    tag="aside"
    variant="surface"
    size="xs"
    class-name="flex h-full min-h-0 rounded-none border-0"
    content-class="flex h-full min-h-0 flex-col p-0">

    <!-- ─── Header ────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-secondary shrink-0">
      <div class="flex items-center gap-2">
        <!-- Back / close (mobile) -->
        <UiButton variant="ghost" color="neutral" icon="i-lucide-chevron-left" @click="emit('close')" />
        <span class="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Item Details
        </span>
        <!-- Dirty / saving indicator -->
        <span v-if="item.isDirty && !item.isLoading" class="text-[10px] text-warning-text font-medium">Unsaved</span>
        <Icon v-if="item.isLoading" name="svg-spinners:ring-resize" class="w-3.5 h-3.5 text-primary" />
      </div>
      <div class="flex items-center gap-1">
        <UiButton size="xs" color="neutral" variant="ghost" icon="i-lucide-maximize-2" title="Fullscreen"
          @click="emit('toggle-fullscreen')" />
        <UiDoubleTapDeleteButton
          hide-label
          icon="i-lucide-trash-2"
          label="Delete item"
          armed-label="Tap again to delete item"
          size="xs"
          variant="ghost"
          title="Delete item"
          :reset-key="item.id"
          @confirm="emit('delete', item.id)"
        />
      </div>
    </div>

    <!-- ─── Tab Navigation ────────────────────────────────────────────── -->
    <div class="flex items-center gap-0.5 px-4 pt-2 shrink-0 border-b border-secondary">
      <UiButton v-for="tab in (['content', 'details', 'links', 'comments', 'integrations'] as const)" :key="tab"
        type="button" role="tab" :aria-selected="activeTab === tab" variant="ghost" tone="neutral"
        class="px-3 py-1.5 text-xs font-medium rounded-t-lg rounded-b-none relative" :class="activeTab === tab
          ? 'text-primary bg-primary/10'
          : 'text-content-secondary hover:text-content-on-surface'" @click="activeTab = tab">
        <span class="capitalize">{{ tab }}</span>
        <!-- badges -->
        <span v-if="tab === 'links' && linkedItems.length > 0"
          class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold">
          {{ linkedItems.length }}
        </span>
        <span v-if="tab === 'comments' && comments.length > 0"
          class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary text-content-secondary text-[9px] font-bold">
          {{ comments.length }}
        </span>
        <span v-if="tab === 'integrations' && externalRefs.length > 0"
          class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold">
          {{ externalRefs.length }}
        </span>
      </UiButton>
    </div>

    <!-- ─── Tab Body ──────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto min-h-0">

      <!-- ── CONTENT TAB ─────────────────────────────────────────────── -->
      <div v-if="activeTab === 'content'" class="p-4 h-full flex flex-col gap-4">

        <!-- Error state -->
        <UiPanel
          v-if="item.error"
          variant="subtle"
          size="sm"
          role="alert"
          class-name="border-error/20 bg-error/10"
          content-class="flex items-center gap-2 text-error-text text-sm">
          <Icon name="i-lucide-circle-alert" class="w-4 h-4 shrink-0" />
          <span>{{ item.error }}</span>
          <UiButton size="xs" variant="ghost" color="error" @click="emit('retry', item.id)">Retry</UiButton>
        </UiPanel>

        <!-- Tags: inline chip-input, auto-saves on every change -->
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-content-secondary uppercase tracking-widest">Tags</span>
          <SharedTagInput :model-value="item.tags || []" placeholder="Add tags…" @update:model-value="updateTags" />
        </div>

        <!-- Rich text editor -->
        <div class="flex-1 min-h-75">
          <TextNote :note="item" :delete-note="() => emit('delete', item.id)" placeholder="Write your note..."
            :is-board-item="true"
            @update="(id, payload) => emit('update', id, typeof payload === 'string' ? payload : payload.content)"
            @retry="(id) => emit('retry', id)" @toggle-fullscreen="emit('toggle-fullscreen')" />
        </div>
      </div>

      <!-- ── DETAILS TAB ─────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'details'" class="p-4 space-y-6">

        <!-- Due Date -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-content-secondary uppercase tracking-widest flex items-center gap-1">
              <Icon name="i-lucide-calendar-days" class="w-3.5 h-3.5" /> Due Date
            </span>
            <UiButton v-if="item.dueDate" size="xs" color="neutral" variant="ghost" icon="i-lucide-x"
              title="Clear due date" @click="clearDueDate" />
          </div>

          <!-- Due date banner -->
          <UiPanel v-if="dueDateLabel" variant="subtle" size="sm" :class-name="dueDateLabel.isOverdue
            ? 'mb-2 bg-error/10 text-error-text border-error/20'
            : 'mb-2 bg-success/10 text-success-text border-success/20'" content-class="flex items-center gap-2 text-sm font-medium">
            <Icon :name="dueDateLabel.isOverdue ? 'i-lucide-triangle-alert' : 'i-lucide-clock'"
              class="w-4 h-4 shrink-0" />
            <span>{{ dueDateLabel.isOverdue ? "Overdue · " : "" }}{{ dueDateLabel.label }}</span>
          </UiPanel>

          <!-- design-allow: native datetime picker — no Ui primitive wraps type=datetime-local -->
          <input v-model="dueDateInput" type="datetime-local"
            class="w-full px-3 py-2 rounded-[var(--radius-lg)] border border-secondary bg-surface text-sm text-content-on-surface focus-visible:outline-none focus-visible:ring-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ds-focus-outline-color)]" />
        </section>

        <!-- Attachments -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-content-secondary uppercase tracking-widest flex items-center gap-1">
              <Icon name="i-lucide-paperclip" class="w-3.5 h-3.5" /> Attachments
              <UiBadge v-if="attachments.length > 0" size="xs" color="neutral" variant="soft">
                {{ attachments.length }}
              </UiBadge>
            </span>
            <UiButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus"
              @click="showAddAttachment = !showAddAttachment">Add</UiButton>
          </div>

          <!-- Add attachment form -->
          <UiPanel
            v-if="showAddAttachment"
            variant="subtle"
            size="sm"
            class-name="mb-3 border-dashed"
            content-class="space-y-2">
            <UiInput v-model="newAttachmentUrl" placeholder="https://..." size="sm" label="URL" />
            <UiInput v-model="newAttachmentName" placeholder="Display name (optional)" size="sm" />
            <div class="flex gap-2">
              <UiButton size="sm" color="primary" @click="addAttachment">Add Link</UiButton>
              <UiButton size="sm" color="neutral" variant="ghost"
                @click="showAddAttachment = false; newAttachmentUrl = ''; newAttachmentName = ''">
                Cancel
              </UiButton>
            </div>
          </UiPanel>

          <!-- Attachment list -->
          <div v-if="attachments.length > 0" class="space-y-2">
            <UiPanel
              v-for="att in attachments"
              :key="att.id"
              variant="surface"
              size="xs"
              content-class="flex items-center gap-2 group">
              <Icon :name="getAttachmentIcon(att.type)" class="w-4 h-4 text-content-secondary shrink-0" />
              <a :href="att.url" target="_blank" rel="noopener noreferrer"
                class="flex-1 text-sm text-primary truncate hover:underline" @click.stop>
                {{ att.name }}
              </a>
              <UiDoubleTapDeleteButton
                hide-label
                icon="i-lucide-x"
                label="Remove attachment"
                armed-label="Tap again to remove attachment"
                tone="error"
                size="xs"
                variant="ghost"
                class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                :reset-key="att.id"
                @confirm="removeAttachment(att.id)"
              />
            </UiPanel>
          </div>
          <p v-else-if="!showAddAttachment" class="text-xs text-content-secondary italic">No attachments yet</p>
        </section>
      </div>

      <!-- ── LINKS TAB ───────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'links'" class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-content-secondary uppercase tracking-widest">Item Links</span>
          <UiButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus" @click="showAddLink = !showAddLink">
            Link item</UiButton>
        </div>

        <!-- Add link form -->
        <UiPanel
          v-if="showAddLink"
          variant="subtle"
          size="sm"
          class-name="border-dashed"
          content-class="space-y-2">
          <label class="text-xs text-content-secondary font-medium">Target item</label>
          <UiSelect v-model="newLinkTargetId" :items="linkableItems" value-key="value" label-key="label"
            placeholder="Select an item..." size="sm" />
          <label class="text-xs text-content-secondary font-medium">Relationship type</label>
          <UiSelect v-model="newLinkType"
            :items="(['PARENT', 'CHILD', 'RELATED', 'BLOCKS', 'BLOCKED_BY', 'DUPLICATE'] as const).map(t => ({ label: LINK_TYPE_LABELS[t], value: t }))"
            value-key="value" label-key="label" size="sm" />
          <div class="flex gap-2">
            <UiButton size="sm" color="primary" :loading="addingLink" @click="addLink">Add Link</UiButton>
            <UiButton size="sm" color="neutral" variant="ghost" @click="showAddLink = false; newLinkTargetId = ''">Cancel
            </UiButton>
          </div>
        </UiPanel>

        <!-- Loading -->
        <div v-if="linksLoading" class="flex items-center gap-2 text-sm text-content-secondary">
          <Icon name="svg-spinners:ring-resize" class="w-4 h-4" />
          Loading links...
        </div>

        <!-- Empty -->
        <p v-else-if="!linksLoading && linkedItems.length === 0" class="text-sm text-content-secondary italic">
          No linked items yet
        </p>

        <!-- Link list -->
        <div v-else class="space-y-2">
          <UiPanel
            v-for="linked in linkedItems"
            :key="linked.linkId"
            variant="surface"
            size="xs"
            content-class="flex items-start gap-2 group">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                <UiBadge size="xs" color="neutral" variant="soft" class="shrink-0">
                  {{ LINK_TYPE_LABELS[linked.linkType] ?? linked.linkType }}
                </UiBadge>
                <span class="text-[10px] text-content-secondary">
                  {{ linked.direction === "sent" ? "→" : "←" }}
                </span>
              </div>
              <p class="text-sm text-content-on-surface truncate">
                {{ linked.item?.content.replace(/<[^>]*>/g, "").slice(0, 80) || "Unknown item" }}
              </p>
            </div>
            <UiDoubleTapDeleteButton
              hide-label
              icon="i-lucide-x"
              label="Remove link"
              armed-label="Tap again to remove link"
              tone="error"
              size="xs"
              variant="ghost"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
              :reset-key="linked.linkId"
              @confirm="deleteLink(linked.linkId)"
            />
          </UiPanel>
        </div>
      </div>

      <!-- ── INTEGRATIONS TAB ────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'integrations'" class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-content-secondary uppercase tracking-widest">External Sources</span>
          <UiButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="externalRefsLoading"
            @click="loadExternalRefs"
          >
            Refresh
          </UiButton>
        </div>

        <div v-if="externalRefsLoading" class="flex items-center gap-2 text-sm text-content-secondary">
          <Icon name="svg-spinners:ring-resize" class="w-4 h-4" />
          Loading sources...
        </div>

        <UiPanel
          v-else-if="externalRefsError"
          variant="subtle"
          size="sm"
          role="alert"
          class-name="border-error/20 bg-error/10"
          content-class="flex items-start gap-2 text-error-text text-sm"
        >
          <Icon name="i-lucide-circle-alert" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ externalRefsError }}</span>
        </UiPanel>

        <UiPanel v-else-if="externalRefs.length === 0" variant="transparent" size="md" class-name="border-dashed">
          <p class="text-sm font-medium text-content-on-surface">No external source linked</p>
          <p class="text-xs text-content-secondary mt-1">
            Imported Jira issues and Notion pages will appear here.
          </p>
        </UiPanel>

        <div v-else class="space-y-2">
          <UiPanel
            v-for="ref in externalRefs"
            :key="ref.id"
            variant="surface"
            size="sm"
            content-class="space-y-2"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-2 min-w-0">
                <div class="w-8 h-8 rounded-[var(--radius-lg)] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon :name="providerIcon(ref.provider)" class="w-4 h-4" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-content-on-surface truncate">
                    {{ ref.externalKey || providerLabel(ref.provider) }}
                  </p>
                  <p class="text-xs text-content-secondary">
                    {{ providerLabel(ref.provider) }} · {{ formatSyncDate(ref.lastSyncedAt) }}
                  </p>
                </div>
              </div>
              <UiBadge
                size="xs"
                :color="ref.syncStatus === 'CONFLICT' || ref.syncStatus === 'ERROR' ? 'error' : ref.syncStatus === 'PENDING' ? 'warning' : 'success'"
                variant="soft"
              >
                {{ ref.syncStatus.toLowerCase() }}
              </UiBadge>
            </div>

            <p v-if="ref.lastError" class="text-xs text-error-text bg-error/10 rounded-[var(--radius-lg)] px-2 py-1">
              {{ ref.lastError }}
            </p>

            <div class="flex items-center justify-between gap-2 pt-1">
              <p class="text-[10px] text-content-secondary truncate">
                External updated {{ formatSyncDate(ref.externalUpdatedAt) }}
              </p>
              <UiButton
                v-if="ref.externalUrl"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-external-link"
                :to="ref.externalUrl"
                target="_blank"
              >
                Open
              </UiButton>
            </div>
          </UiPanel>
        </div>
      </div>

      <!-- ── COMMENTS TAB ─────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'comments'" class="p-4 space-y-4 flex flex-col h-full">
        <!-- Loading -->
        <div v-if="commentsLoading" class="flex items-center gap-2 text-sm text-content-secondary">
          <Icon name="svg-spinners:ring-resize" class="w-4 h-4" />
          Loading comments...
        </div>

        <!-- Comment list -->
        <div class="flex-1 space-y-3 overflow-y-auto min-h-0">
          <div v-if="!commentsLoading && comments.length === 0"
            class="text-sm text-content-secondary italic text-center py-8">
            No comments yet.
            <br />
            <span class="text-xs mt-1 block">Comments from collaborators will appear here in a future update.</span>
          </div>

          <UiPanel v-for="comment in comments" :key="comment.id" variant="surface" size="sm" content-class="space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-content-on-surface">
                {{ comment.author?.name || comment.author?.email || "You" }}
              </span>
              <span class="text-[10px] text-content-secondary">{{ formatCommentDate(comment.createdAt) }}</span>
            </div>
            <p class="text-sm text-content-on-surface whitespace-pre-wrap leading-relaxed" dir="auto">
              {{ comment.content }}
            </p>
          </UiPanel>
        </div>

        <!-- New comment input (pinned to bottom) -->
        <div class="shrink-0 space-y-2 border-t border-secondary pt-3">
          <UiTextarea v-model="newCommentContent" placeholder="Add a comment…" :rows="2" size="sm"
            dir="auto" class="w-full resize-none" />
          <UiButton size="sm" color="primary" :loading="addingComment" :disabled="!newCommentContent.trim()"
            @click="addComment">
            Post Comment
          </UiButton>
        </div>
      </div>

    </div>
  </UiPanel>
</template>
