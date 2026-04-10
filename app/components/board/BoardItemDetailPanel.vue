<script setup lang="ts">
import type { BoardItemState } from "~/composables/board/useBoardItemsStore";
import type { Attachment, BoardItemLink, CreateBoardItemLinkDTO, LinkType, LINK_TYPES } from "~/shared/utils/boardItem.contract";

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

// ─── Tabs ──────────────────────────────────────────────────────────────────
const activeTab = ref<"content" | "details" | "links" | "comments">("content");

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
  if (type === "pdf") return "heroicons:document-text";
  if (type === "image") return "heroicons:photo";
  return "heroicons:link";
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
  try {
    const result = await $api.boardItems.createLink({
      sourceId: props.item.id,
      targetId: newLinkTargetId.value,
      linkType: newLinkType.value,
    });
    if (result.success) {
      await itemsStore.loadItemLinks(props.item.id);
      showAddLink.value = false;
      newLinkTargetId.value = "";
      newLinkType.value = "RELATED";
    } else {
      toast.add({ title: "Error", description: "Could not create link", color: "error" });
    }
  } catch {
    toast.add({ title: "Error", description: "Could not create link", color: "error" });
  } finally {
    addingLink.value = false;
  }
}

async function deleteLink(linkId: string) {
  try {
    const result = await $api.boardItems.deleteLink(linkId);
    if (result.success || (result as any).status === 204) {
      await itemsStore.loadItemLinks(props.item.id);
    }
  } catch {
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
  try {
    const result = await $api.boardItems.createComment({ itemId: props.item.id, content: text });
    if (result.success) {
      await itemsStore.loadItemComments(props.item.id);
      newCommentContent.value = "";
    } else {
      toast.add({ title: "Error", description: "Could not add comment", color: "error" });
    }
  } catch {
    toast.add({ title: "Error", description: "Could not add comment", color: "error" });
  } finally {
    addingComment.value = false;
  }
}

function formatCommentDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Load relational data when tab is opened ───────────────────────────────
watch(activeTab, async (tab) => {
  if (tab === "links" && !props.item.links) {
    await itemsStore.loadItemLinks(props.item.id);
  }
  if (tab === "comments" && !props.item.comments) {
    await itemsStore.loadItemComments(props.item.id);
  }
});

// Also load when item changes
watch(() => props.item.id, async () => {
  if (activeTab.value === "links") await itemsStore.loadItemLinks(props.item.id);
  if (activeTab.value === "comments") await itemsStore.loadItemComments(props.item.id);
}, { immediate: false });
</script>

<template>
  <div class="flex flex-col h-full min-h-0 bg-white dark:bg-gray-900">

    <!-- ─── Header ────────────────────────────────────────────────────── -->
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <div class="flex items-center gap-2">
        <!-- Back / close (mobile) -->
        <UButton variant="ghost" color="neutral" icon="heroicons:chevron-left" class="lg:hidden"
          @click="emit('close')" />
        <span class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Item Details
        </span>
        <!-- Dirty / saving indicator -->
        <span v-if="item.isDirty && !item.isLoading"
          class="text-[10px] text-amber-500 font-medium">Unsaved</span>
        <Icon v-if="item.isLoading" name="svg-spinners:ring-resize" class="w-3.5 h-3.5 text-primary-500" />
      </div>
      <div class="flex items-center gap-1">
        <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:arrows-pointing-out"
          title="Fullscreen" @click="emit('toggle-fullscreen')" />
        <UButton size="xs" color="error" variant="ghost" icon="heroicons:trash" title="Delete item"
          @click="emit('delete', item.id)" />
      </div>
    </div>

    <!-- ─── Tab Navigation ────────────────────────────────────────────── -->
    <div class="flex items-center gap-0.5 px-4 pt-2 shrink-0 border-b border-gray-100 dark:border-gray-800">
      <button v-for="tab in (['content', 'details', 'links', 'comments'] as const)" :key="tab"
        class="px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors relative"
        :class="activeTab === tab
          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        @click="activeTab = tab">
        <span class="capitalize">{{ tab }}</span>
        <!-- badges -->
        <span v-if="tab === 'links' && linkedItems.length > 0"
          class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-[9px] font-bold">
          {{ linkedItems.length }}
        </span>
        <span v-if="tab === 'comments' && comments.length > 0"
          class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-bold">
          {{ comments.length }}
        </span>
      </button>
    </div>

    <!-- ─── Tab Body ──────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto min-h-0">

      <!-- ── CONTENT TAB ─────────────────────────────────────────────── -->
      <div v-if="activeTab === 'content'" class="p-4 h-full flex flex-col gap-4">

        <!-- Error state -->
        <div v-if="item.error"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <Icon name="heroicons:exclamation-circle" class="w-4 h-4 shrink-0" />
          <span>{{ item.error }}</span>
          <UButton size="xs" variant="ghost" color="error" @click="emit('retry', item.id)">Retry</UButton>
        </div>

        <!-- Tags: inline chip-input, auto-saves on every change -->
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-400 uppercase tracking-widest">Tags</span>
          <SharedTagInput
            :model-value="item.tags || []"
            placeholder="Add tags…"
            @update:model-value="updateTags"
          />
        </div>

        <!-- Rich text editor -->
        <div class="flex-1 min-h-75">
          <workspace-text-note :note="item" :delete-note="() => emit('delete', item.id)"
            placeholder="Write your note..." :is-board-item="true"
            @update="(id, content) => emit('update', id, content)"
            @retry="(id) => emit('retry', id)"
            @toggle-fullscreen="emit('toggle-fullscreen')" />
        </div>
      </div>

      <!-- ── DETAILS TAB ─────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'details'" class="p-4 space-y-6">

        <!-- Due Date -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Icon name="heroicons:calendar-days" class="w-3.5 h-3.5" /> Due Date
            </span>
            <UButton v-if="item.dueDate" size="xs" color="neutral" variant="ghost"
              icon="heroicons:x-mark" title="Clear due date" @click="clearDueDate" />
          </div>

          <!-- Due date banner -->
          <div v-if="dueDateLabel"
            :class="['flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mb-2',
              dueDateLabel.isOverdue
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800']">
            <Icon :name="dueDateLabel.isOverdue ? 'heroicons:exclamation-triangle' : 'heroicons:clock'"
              class="w-4 h-4 shrink-0" />
            <span>{{ dueDateLabel.isOverdue ? "Overdue · " : "" }}{{ dueDateLabel.label }}</span>
          </div>

          <input
            v-model="dueDateInput"
            type="datetime-local"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </section>

        <!-- Attachments -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Icon name="heroicons:paper-clip" class="w-3.5 h-3.5" /> Attachments
              <UBadge v-if="attachments.length > 0" size="xs" color="neutral" variant="soft">
                {{ attachments.length }}
              </UBadge>
            </span>
            <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:plus"
              @click="showAddAttachment = !showAddAttachment">Add</UButton>
          </div>

          <!-- Add attachment form -->
          <div v-if="showAddAttachment"
            class="mb-3 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
            <UInput v-model="newAttachmentUrl" placeholder="https://..." size="sm" label="URL" />
            <UInput v-model="newAttachmentName" placeholder="Display name (optional)" size="sm" />
            <div class="flex gap-2">
              <UButton size="sm" color="primary" @click="addAttachment">Add Link</UButton>
              <UButton size="sm" color="neutral" variant="ghost"
                @click="showAddAttachment = false; newAttachmentUrl = ''; newAttachmentName = ''">
                Cancel
              </UButton>
            </div>
          </div>

          <!-- Attachment list -->
          <div v-if="attachments.length > 0" class="space-y-2">
            <div v-for="att in attachments" :key="att.id"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 group">
              <Icon :name="getAttachmentIcon(att.type)" class="w-4 h-4 text-gray-400 shrink-0" />
              <a :href="att.url" target="_blank" rel="noopener noreferrer"
                class="flex-1 text-sm text-primary-600 dark:text-primary-400 truncate hover:underline"
                @click.stop>
                {{ att.name }}
              </a>
              <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:x-mark"
                class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                @click="removeAttachment(att.id)" />
            </div>
          </div>
          <p v-else-if="!showAddAttachment" class="text-xs text-gray-400 italic">No attachments yet</p>
        </section>
      </div>

      <!-- ── LINKS TAB ───────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'links'" class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400 uppercase tracking-widest">Item Links</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:plus"
            @click="showAddLink = !showAddLink">Link item</UButton>
        </div>

        <!-- Add link form -->
        <div v-if="showAddLink"
          class="p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
          <label class="text-xs text-gray-500 font-medium">Target item</label>
          <USelect v-model="newLinkTargetId" :items="linkableItems" value-key="value" label-key="label"
            placeholder="Select an item..." size="sm" />
          <label class="text-xs text-gray-500 font-medium">Relationship type</label>
          <USelect v-model="newLinkType"
            :items="(['PARENT','CHILD','RELATED','BLOCKS','BLOCKED_BY','DUPLICATE'] as const).map(t => ({ label: LINK_TYPE_LABELS[t], value: t }))"
            value-key="value" label-key="label" size="sm" />
          <div class="flex gap-2">
            <UButton size="sm" color="primary" :loading="addingLink" @click="addLink">Add Link</UButton>
            <UButton size="sm" color="neutral" variant="ghost"
              @click="showAddLink = false; newLinkTargetId = ''">Cancel</UButton>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="linksLoading" class="flex items-center gap-2 text-sm text-gray-400">
          <Icon name="svg-spinners:ring-resize" class="w-4 h-4" />
          Loading links...
        </div>

        <!-- Empty -->
        <p v-else-if="!linksLoading && linkedItems.length === 0" class="text-sm text-gray-400 italic">
          No linked items yet
        </p>

        <!-- Link list -->
        <div v-else class="space-y-2">
          <div v-for="linked in linkedItems" :key="linked.linkId"
            class="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 group">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                <UBadge size="xs" color="neutral" variant="soft" class="shrink-0">
                  {{ LINK_TYPE_LABELS[linked.linkType] ?? linked.linkType }}
                </UBadge>
                <span class="text-[10px] text-gray-400">
                  {{ linked.direction === "sent" ? "→" : "←" }}
                </span>
              </div>
              <p class="text-sm text-gray-700 dark:text-gray-300 truncate">
                {{ linked.item?.content.replace(/<[^>]*>/g, "").slice(0, 80) || "Unknown item" }}
              </p>
            </div>
            <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:x-mark"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
              @click="deleteLink(linked.linkId)" />
          </div>
        </div>
      </div>

      <!-- ── COMMENTS TAB ─────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'comments'" class="p-4 space-y-4 flex flex-col h-full">
        <!-- Loading -->
        <div v-if="commentsLoading" class="flex items-center gap-2 text-sm text-gray-400">
          <Icon name="svg-spinners:ring-resize" class="w-4 h-4" />
          Loading comments...
        </div>

        <!-- Comment list -->
        <div class="flex-1 space-y-3 overflow-y-auto min-h-0">
          <div v-if="!commentsLoading && comments.length === 0"
            class="text-sm text-gray-400 italic text-center py-8">
            No comments yet.
            <br />
            <span class="text-xs mt-1 block">Comments from collaborators will appear here in a future update.</span>
          </div>

          <div v-for="comment in comments" :key="comment.id"
            class="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {{ comment.author?.name || comment.author?.email || "You" }}
              </span>
              <span class="text-[10px] text-gray-400">{{ formatCommentDate(comment.createdAt) }}</span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {{ comment.content }}
            </p>
          </div>
        </div>

        <!-- New comment input (pinned to bottom) -->
        <div class="shrink-0 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
          <UTextarea v-model="newCommentContent" placeholder="Add a comment…" :rows="2" size="sm"
            class="w-full resize-none" />
          <UButton size="sm" color="primary" :loading="addingComment"
            :disabled="!newCommentContent.trim()" @click="addComment">
            Post Comment
          </UButton>
        </div>
      </div>

    </div>
  </div>
</template>
