<script setup lang="ts">
/**
 * CardStack — restored from the pre-split learning UI. Top card can be dragged
 * left/right or moved with controls; cards cycle infinitely through the deck.
 */
import { computed, h, ref, watch, type PropType } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { animate, motion, useMotionValue, useTransform } from "motion-v";

interface DemoPhoto {
  id: string | number;
  src: string;
  label: string;
}

const props = defineProps({
  items: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
});

const PHOTOS: DemoPhoto[] = [
  {
    id: 0,
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=640&q=80",
    label: "Swiss Alps",
  },
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=640&q=80",
    label: "Alpine Lake",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=640&q=80",
    label: "Forest Path",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=640&q=80",
    label: "Misty Ridge",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=640&q=80",
    label: "Summit View",
  },
];

const SWIPE_DIST = 150;
const SWIPE_VEL = 400;
const FLY = 1600;

const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
const dataItems = computed(() => (props.items?.length ? props.items : PHOTOS));
const deck = ref<any[]>([...dataItems.value]);
const topDragX = ref(0);
const visible = computed(() => deck.value.slice(0, 4));

watch(
  dataItems,
  (newItems) => {
    deck.value = [...newItems];
  },
  { immediate: true },
);

function swipeRight() {
  if (deck.value.length === 0) return;
  const top = deck.value.shift();
  if (top !== undefined) deck.value.push(top);
  topDragX.value = 0;
}

function swipeLeft() {
  if (deck.value.length === 0) return;
  const last = deck.value.pop();
  if (last !== undefined) deck.value.unshift(last);
  topDragX.value = 0;
}

const CardItem = {
  name: "CardStackItem",
  props: {
    item: { type: Object, required: true },
    stackIndex: { type: Number, required: true },
    total: { type: Number, required: true },
    swipeLeft: {
      type: Function as unknown as () => () => void,
      required: true,
    },
    swipeRight: {
      type: Function as unknown as () => () => void,
      required: true,
    },
    dragX: { type: Number, default: 0 },
    onDragX: {
      type: Function as unknown as () => (value: number) => void,
      default: () => {},
    },
    slots: { type: Object, required: true },
  },
  setup(itemProps: any) {
    const springReturn = { type: "spring", stiffness: 450, damping: 30 };
    const springFly = { type: "spring", stiffness: 350, damping: 25 };
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
    const likeOpacity = useTransform(x, [0, 80], [0, 1]);
    const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);
    const isDragging = ref(false);
    const justThrown = ref(false);

    x.on("change", (value: number) => {
      if (itemProps.stackIndex === 0) itemProps.onDragX(value);
    });

    watch(
      () => itemProps.stackIndex,
      (newValue, oldValue) => {
        if (prefersReducedMotion.value) {
          x.jump(0);
          y.jump(0);
          return;
        }
        if (newValue > 0 && oldValue === 0) {
          justThrown.value = true;
          setTimeout(() => {
            justThrown.value = false;
          }, 300);
          y.jump(newValue * 14);
          (animate as any)(x, 0, {
            type: "spring",
            stiffness: 300,
            damping: 35,
          });
        }
      },
      { flush: "sync" },
    );

    function onClickCapture(event: MouseEvent) {
      if (isDragging.value || Math.abs(x.get()) > 5 || Math.abs(y.get()) > 5) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onDragEnd(
      _event: PointerEvent,
      info: { velocity: { x: number } },
    ) {
      setTimeout(() => {
        isDragging.value = false;
      }, 50);

      const currentX = x.get();
      const velocity = info.velocity.x;
      if (Math.abs(currentX) <= SWIPE_DIST && Math.abs(velocity) <= SWIPE_VEL) {
        if (prefersReducedMotion.value) {
          x.jump(0);
          y.jump(0);
        } else {
          (animate as any)(x, 0, springReturn);
          (animate as any)(y, 0, springReturn);
        }
        itemProps.onDragX(0);
        return;
      }

      const direction = currentX >= 0 ? 1 : -1;
      if (prefersReducedMotion.value) {
        x.jump(0);
        y.jump(0);
        if (direction === 1) itemProps.swipeRight();
        else itemProps.swipeLeft();
        return;
      }

      (animate as any)(x, direction * FLY, springFly);
      setTimeout(() => {
        if (direction === 1) itemProps.swipeRight();
        else itemProps.swipeLeft();
        itemProps.onDragX(0);
      }, 120);
    }

    return () => {
      const isTop = itemProps.stackIndex === 0;
      const zIndex = itemProps.total - itemProps.stackIndex;
      const dragProgress = isTop
        ? 0
        : Math.min(1, Math.abs(itemProps.dragX) / SWIPE_DIST);
      const virtualIndex = isTop ? 0 : itemProps.stackIndex - dragProgress;
      const targetScale = isTop ? 1 : 1 - virtualIndex * 0.04;
      const targetY = isTop ? 0 : virtualIndex * 14;

      const demoContent = () => [
        h("img", {
          src: itemProps.item.src,
          alt: itemProps.item.label,
          class:
            "block h-full w-full object-cover pointer-events-none -webkit-user-drag-none",
        }),
        h(
          "div",
          {
            class:
              "absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--color-content-on-background)]/80 to-transparent p-4 pt-16 font-serif text-xl tracking-tight text-white",
          },
          itemProps.item.label,
        ),
        h(
          motion.div,
          {
            class:
              "pointer-events-none absolute right-5 top-5 rotate-[8deg] rounded-[var(--radius-lg)] border border-success px-4 py-1.5 text-[0.8rem] font-bold uppercase tracking-widest text-success-text",
            style: { opacity: likeOpacity },
          },
          "Next",
        ),
        h(
          motion.div,
          {
            class:
              "pointer-events-none absolute left-5 top-5 -rotate-[8deg] rounded-[var(--radius-lg)] border border-error px-4 py-1.5 text-[0.8rem] font-bold uppercase tracking-widest text-error-text",
            style: { opacity: nopeOpacity },
          },
          "Prev",
        ),
      ];
      const content = itemProps.slots.default
        ? itemProps.slots.default({ item: itemProps.item })
        : demoContent();
      const motionProps: any = {
        class: [
          "absolute inset-0 touch-none select-none overflow-hidden rounded-[var(--radius-2xl)] border border-surface-subtle bg-clip-padding bg-opacity-10 shadow-[var(--shadow-dropdown)] backdrop-blur-sm will-change-transform",
          isTop ? "shadow-[var(--shadow-card-hover)]" : "",
        ],
        style: { zIndex, x, y, rotate },
        onClickCapture,
      };

      if (isTop) {
        motionProps.drag = true;
        motionProps.dragElastic = 0.15;
        motionProps.dragMomentum = false;
        motionProps.onDragStart = () => {
          isDragging.value = true;
        };
        motionProps.onDragEnd = onDragEnd;
        motionProps.style.cursor = "grab";
      }

      if (prefersReducedMotion.value) {
        motionProps.style.transform = `translateY(${targetY}px) scale(${targetScale})`;
      } else {
        motionProps.animate = { scale: targetScale, y: targetY };
        motionProps.transition = justThrown.value
          ? { type: "tween", duration: 0.01 }
          : { type: "spring", stiffness: 450, damping: 35 };
      }

      return h(motion.div, motionProps, content);
    };
  },
};
</script>

<template>
  <div
    class="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden"
  >
    <div class="relative aspect-[4/3] w-full max-w-[250px]">
      <CardItem
        v-for="(item, index) in visible"
        :key="item.id || index"
        :item="item"
        :stack-index="index"
        :total="visible.length"
        :swipe-left="swipeLeft"
        :swipe-right="swipeRight"
        :drag-x="topDragX"
        :on-drag-x="(value: number) => (topDragX = value)"
        :slots="$slots"
      />

      <div
        v-if="!deck.length"
        class="absolute inset-0 flex flex-col items-center justify-center text-sm text-content-secondary"
      >
        <UiIcon name="i-lucide-layers" class="mb-3 h-12 w-12 opacity-50" />
        No cards
      </div>
    </div>

    <div
      v-if="deck.length > 0"
      class="relative z-10 mt-4 flex items-center gap-8"
    >
      <UiIconButton
        icon="i-lucide-arrow-left"
        label="Previous"
        variant="soft"
        size="xs"
        class="rounded-full shadow-[var(--shadow-dropdown)]"
        @click="swipeLeft"
      />

      <div class="flex gap-2.5" aria-hidden="true">
        <span
          v-for="(item, index) in deck.slice(0, 5)"
          :key="item.id || index"
          :class="[
            'h-2 w-2 rounded-full transition-all duration-300',
            index === 0 ? 'scale-125 bg-primary' : 'bg-secondary',
          ]"
        />
      </div>

      <UiIconButton
        icon="i-lucide-arrow-right"
        label="Next"
        variant="soft"
        size="xs"
        class="rounded-full shadow-[var(--shadow-dropdown)]"
        @click="swipeRight"
      />
    </div>
  </div>
</template>
