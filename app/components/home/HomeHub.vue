<template>
  <div class="home">
    <WorkspacePill class="home__wspill" />
    <!-- greeting -->
    <header class="home__greet">
      <div>
        <p class="home__date">{{ today }}</p>
        <ui-title tag="h1" class="home__hello">{{ greeting }}, {{ firstName }}</ui-title>
      </div>
      <div class="home__greet-actions">
        <NuxtLink to="/account" class="home__avatar" aria-label="Account">
          <img v-if="avatar" :src="avatar" :alt="firstName" />
          <template v-else>{{ initial }}</template>
          <span v-if="unreadCount > 0" class="home__avatar-dot" />
        </NuxtLink>
        <NuxtLink
          to="/review"
          class="home__streak"
          :aria-label="`${streak} day streak`"
        >
          <span class="home__streak-badge">{{ streak }}</span>
          <span class="home__streak-label">streak</span>
        </NuxtLink>
      </div>
    </header>

    <!-- due-now review card -->
    <NuxtLink
      to="/review"
      class="home__hero"
      :aria-label="`Start review: ${dueCount} ${dueCount === 1 ? 'card' : 'cards'} due`"
    >
      <span class="home__hero-deco" aria-hidden="true" />
      <span class="home__hero-icon" aria-hidden="true">
        <UiIcon
          :name="dueCount ? 'i-lucide-layers-3' : 'i-lucide-check-check'"
          class="h-5 w-5"
        />
      </span>
      <span class="home__hero-main">
        <span class="home__hero-top">
          <span class="home__hero-eyebrow">Due now</span>
          <span v-if="dueCount" class="home__hero-est"
            >~{{ estMinutes }} min</span
          >
        </span>
        <span class="home__hero-count">
          <strong>{{ dueCount }}</strong>
          <span>{{ dueCount === 1 ? "card" : "cards" }}</span>
        </span>
        <span class="home__hero-sub">{{ heroSub }}</span>
      </span>
      <span class="home__hero-cta" aria-hidden="true">
        <UiIcon name="i-lucide-arrow-right" class="h-4 w-4" />
      </span>
    </NuxtLink>

    <!-- stat row -->
    <div class="home__stats">
      <div class="home__stat">
        <span class="home__stat-label">TODAY</span>
        <span class="home__stat-value"
          >{{ todayReviews }} <small>reviewed</small></span
        >
      </div>
      <div class="home__stat">
        <span class="home__stat-label">MASTERED</span>
        <span class="home__stat-value">{{ mastered }}</span>
      </div>
    </div>

    <!-- jump back in -->
    <section v-if="recentNotes.length" class="home__recent">
      <ui-title tag="h2" class="home__section">JUMP BACK IN</ui-title>
      <ul class="home__rows">
        <li v-for="note in recentNotes" :key="note.id">
          <UiListCard
            clickable
            :title="note.title || 'Untitled note'"
            :description="relativeTime(note.updatedAt)"
            :leading-background="tint(spineFor(note.noteType), 14)"
            :leading-color="spineFor(note.noteType)"
            @click="openNote(note.id)"
          >
            <template #leading>
              <UiIcon
                :name="iconFor(note.noteType)"
                class="h-4 w-4"
                aria-hidden="true"
              />
            </template>
            <template #trailing>
              <SyncBadge :state="note.isDirty ? 'local' : 'synced'" />
            </template>
          </UiListCard>
        </li>
      </ul>
    </section>

    <!-- compact card analytics -->
    <section class="home__insights" aria-labelledby="home-insights-title">
      <div class="home__insights-head">
        <ui-title tag="h2" id="home-insights-title" class="home__section">CARDS</ui-title>
        <span class="home__range">Last 7 days</span>
      </div>

      <div class="home__pulse-card">
        <div class="home__pulse-top">
          <div>
            <span class="home__pulse-kicker">Review pulse</span>
            <p class="home__pulse-value">
              {{ totalRecentReviews }}
              <small>{{
                totalRecentReviews === 1 ? "review" : "reviews"
              }}</small>
            </p>
          </div>
          <div class="home__retention">
            <strong>{{ retentionPercent }}%</strong>
            <span>retained</span>
          </div>
        </div>

        <div
          class="home__spark"
          aria-label="Reviews per day for the last seven days"
        >
          <span
            v-for="day in dailySeries"
            :key="day.date"
            class="home__spark-day"
          >
            <span
              class="home__spark-bar"
              :style="{ height: barHeight(day.count) }"
              :aria-label="`${day.count} reviews on ${day.label}`"
              role="img"
            />
            <span class="home__spark-label">{{ day.shortLabel }}</span>
          </span>
        </div>

        <div
          class="home__queue-strip"
          :aria-label="`Current queue: ${queueTotal} cards`"
        >
          <span
            v-for="item in reviewMixSegments"
            :key="item.label"
            class="home__queue-segment"
            :style="{ '--segment-color': item.color, flexGrow: item.share }"
          />
        </div>

        <ul class="home__queue-list" aria-label="Current card state counts">
          <li v-for="item in reviewMix" :key="item.label">
            <span class="home__queue-dot" :style="{ background: item.color }" />
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import SyncBadge from "~/components/shell/SyncBadge.vue";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import { noteSpineVar, tint } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import type { NoteState } from "~/features/notes/composables/useNotesStore";

type DashboardAnalytics = {
  totalCards: number;
  totalReviews: number;
  currentStreak: number;
  longestStreak: number;
  averageGrade: number;
  retentionRate: number;
  dailyReviewCounts: { date: string; count: number }[];
};

const { data: authData } = useAuth();
const { activeId } = useActiveWorkspace();
const reviewStats = useReviewStats({ immediate: true });

const streak = ref(0);
const todayReviews = ref(0);
const analytics = ref<DashboardAnalytics | null>(null);

const { unreadCount } = useInAppNotifications();
const authUser = computed(
  () => (authData.value?.user ?? {}) as { name?: string; image?: string },
);
const firstName = computed(
  () => (authUser.value.name ?? "there").split(" ")[0],
);
const avatar = computed(() => authUser.value.image || "");
const initial = computed(() =>
  (authUser.value.name?.trim()[0] || "U").toUpperCase(),
);
const today = computed(() =>
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }),
);
const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
});

const dueCount = computed(() => reviewStats.stats.value?.due ?? 0);
const mastered = computed(() => reviewStats.stats.value?.mature ?? 0);
const newCount = computed(() => reviewStats.stats.value?.new ?? 0);
const learningCount = computed(() => reviewStats.stats.value?.learning ?? 0);
const heroSub = computed(() =>
  dueCount.value > 0
    ? "across your workspaces"
    : "You're all caught up — nice.",
);
// Rough study-time estimate (~30s/card), matching the design's "~6 min".
const estMinutes = computed(() =>
  Math.max(1, Math.round(dueCount.value * 0.5)),
);
const dailySeries = computed(() => {
  const source = analytics.value?.dailyReviewCounts ?? [];
  return source.slice(-7).map((entry) => {
    const date = new Date(`${entry.date}T00:00:00.000Z`);
    return {
      ...entry,
      label: date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      shortLabel: date
        .toLocaleDateString(undefined, { weekday: "short" })
        .slice(0, 1),
    };
  });
});
const maxDailyReviews = computed(() =>
  Math.max(1, ...dailySeries.value.map((entry) => entry.count)),
);
const totalRecentReviews = computed(() =>
  dailySeries.value.reduce((sum, entry) => sum + entry.count, 0),
);
const retentionPercent = computed(() =>
  Math.round((analytics.value?.retentionRate ?? 0) * 100),
);
const reviewMix = computed(() => [
  { label: "Due", value: dueCount.value, color: "var(--color-warning)" },
  { label: "Learning", value: learningCount.value, color: "var(--color-info)" },
  { label: "New", value: newCount.value, color: "var(--color-primary)" },
  { label: "Mature", value: mastered.value, color: "var(--color-success)" },
]);
const queueTotal = computed(() =>
  reviewMix.value.reduce((sum, item) => sum + item.value, 0),
);
const reviewMixSegments = computed(() => {
  const total = reviewMix.value.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    return [
      {
        label: "Empty",
        value: 1,
        share: 1,
        color: "var(--color-surface-strong)",
      },
    ];
  }
  return reviewMix.value
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      share: Math.max(0.08, item.value / total),
    }));
});

const store = computed(() =>
  activeId.value ? useNotesStore(activeId.value) : null,
);
const recentNotes = computed<NoteState[]>(() => {
  const map = store.value?.notes.value;
  if (!map) return [];
  return Array.from(map.values())
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3);
});

function spineFor(t?: string) {
  return noteSpineVar(t ?? "TEXT");
}
function iconFor(t?: string) {
  if (t === "MATH") return "i-lucide-sigma";
  if (t === "CANVAS") return "i-lucide-pen-tool";
  return "i-lucide-file-text";
}
function openNote(id: string) {
  navigateTo(`/notes/${id}`);
}
function relativeTime(value?: Date | string | null) {
  const timestamp = value ? new Date(value).getTime() : Date.now();
  const diff =
    Date.now() - (Number.isFinite(timestamp) ? timestamp : Date.now());
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
function barHeight(count: number) {
  if (count <= 0) return "8%";
  return `${Math.max(16, Math.round((count / maxDailyReviews.value) * 100))}%`;
}

async function fetchAnalytics() {
  try {
    const res = await $fetch<{ data?: DashboardAnalytics }>(
      "/api/review/analytics?days=14",
    );
    analytics.value = res?.data ?? null;
    streak.value = analytics.value?.currentStreak ?? 0;
    const daily = analytics.value?.dailyReviewCounts ?? [];
    const todayStr = new Date().toISOString().slice(0, 10);
    todayReviews.value =
      daily.find((d) => d.date.slice(0, 10) === todayStr)?.count ?? 0;
  } catch {
    /* non-blocking */
  }
}

onMounted(async () => {
  void fetchAnalytics();
  if (store.value) {
    await store.value.hydrateLocalNotes();
    void store.value.refreshFromServer();
  }
});
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.home__wspill {
  align-self: flex-start;
  margin-top: var(--space-2);
  margin-bottom: calc(-1 * var(--space-5));
}

.home__greet {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.home__date {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-content-secondary);
}

.home__hello {
  font-size: 27px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.1;
  color: var(--color-content-on-surface-strong);
}

.home__greet-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.home__avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  background: var(--color-surface-strong);
  color: var(--color-content-on-surface-strong);
  font-size: 15px;
  font-weight: 700;
}

.home__avatar img {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.home__avatar-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 11px;
  height: 11px;
  border-radius: var(--radius-full);
  background: var(--color-error);
  border: 2px solid var(--color-background);
}

.home__streak {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.home__streak-badge {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: var(--radius-full);
  background: linear-gradient(
    135deg,
    var(--color-warning),
    var(--color-accent-orange)
  );
  color: var(--color-white);
  font-size: 17px;
  font-weight: 800;
  box-shadow: 0 4px 12px
    color-mix(in srgb, var(--color-warning) 35%, transparent);
}

.home__streak-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-content-secondary);
}

.home__hero {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 92px;
  padding: var(--space-3);
  border-radius: var(--radius-2xl);
  background: var(--ds-gradient-due);
  color: var(--color-white);
  overflow: hidden;
  box-shadow: 0 6px 18px
    color-mix(in srgb, var(--color-primary) 22%, transparent);
  outline: none;
  transition:
    transform var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

.home__hero:hover {
  box-shadow: 0 8px 22px
    color-mix(in srgb, var(--color-primary) 28%, transparent);
}

.home__hero:active {
  transform: scale(0.985);
}

.home__hero:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: -2px;
}

.home__hero-deco {
  position: absolute;
  top: -36px;
  right: -24px;
  width: 112px;
  height: 112px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-white) 9%, transparent);
}

.home__hero-icon {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid color-mix(in srgb, var(--color-white) 24%, transparent);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--color-white) 15%, transparent);
  color: var(--color-white);
  box-shadow: inset 0 1px 0
    color-mix(in srgb, var(--color-white) 18%, transparent);
}

.home__hero-main {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.home__hero-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.home__hero-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-white) 72%, transparent);
}

.home__hero-est {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-white) 14%, transparent);
  font-size: 12px;
  font-weight: 800;
  color: color-mix(in srgb, var(--color-white) 86%, transparent);
}

.home__hero-count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 3px;
  line-height: 0.95;
}

.home__hero-count strong {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0;
}

.home__hero-count span {
  font-size: 13px;
  font-weight: 800;
  color: color-mix(in srgb, var(--color-white) 78%, transparent);
}

.home__hero-sub {
  display: block;
  overflow: hidden;
  margin-top: 4px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: color-mix(in srgb, var(--color-white) 72%, transparent);
}

.home__hero-cta {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-white) 92%, transparent);
  color: var(--color-primary);
}

.home__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.home__stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  border: 1px solid var(--color-secondary);
  box-shadow: var(--shadow-card);
}

.home__stat-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--color-content-secondary);
}

.home__stat-value {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--color-content-on-surface-strong);
}

.home__stat-value small {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-success-text);
}

.home__insights {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.home__insights-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.home__insights-head .home__section {
  margin-bottom: 0;
}

.home__range {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-content-disabled);
}

.home__pulse-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  box-shadow: var(--shadow-card);
}

.home__pulse-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.home__pulse-kicker {
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.7px;
  color: var(--color-content-secondary);
  text-transform: uppercase;
}

.home__pulse-value {
  margin-top: 2px;
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  color: var(--color-content-on-surface-strong);
}

.home__pulse-value small {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--color-content-secondary);
}

.home__retention {
  display: flex;
  min-width: 82px;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 7px 10px;
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
  text-align: center;
}

.home__retention strong {
  font-size: 16px;
  font-weight: 900;
  color: var(--color-success-text);
}

.home__retention span {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.4px;
  color: var(--color-content-secondary);
  text-transform: uppercase;
}

.home__spark {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  align-items: end;
  gap: 7px;
  height: 64px;
  padding-top: 2px;
}

.home__spark-day {
  display: flex;
  height: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
}

.home__spark-bar {
  width: 100%;
  min-height: 8px;
  max-width: 18px;
  border-radius: var(--radius-full);
  background:
    linear-gradient(180deg, var(--color-accent-blue), var(--color-primary)),
    var(--color-primary);
  box-shadow: 0 5px 12px
    color-mix(in srgb, var(--color-primary) 18%, transparent);
  transition: height var(--duration-normal) var(--ease-emphasized);
}

.home__spark-label {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-content-disabled);
}

.home__queue-strip {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--color-surface-subtle);
}

.home__queue-segment {
  min-width: 8px;
  background: var(--segment-color);
}

.home__queue-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.home__queue-list li {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  padding: 7px 6px;
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
}

.home__queue-list span:not(.home__queue-dot) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-content-secondary);
}

.home__queue-list strong {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-content-on-surface-strong);
}

.home__queue-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
}

.home__section {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
  margin-bottom: var(--space-3);
}

.home__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
