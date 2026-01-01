<script setup lang="ts">
import { Motion } from "motion-v";

interface DragInfo {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

interface DrawerProps {
  show: boolean;
  side?: "right" | "left";
  mobile?: MobileProp;
  breakpoint?: string;
  handleVisible?: number;
  sheetHeight?: string;
  widthClasses?: string;
  teleportTo?: string;
  lockScroll?: boolean;
  threshold?: number;
  fastVelocity?: number;
  /** Accessible title used if no header slot is provided */
  title?: string;
  backdrop?: boolean;
  backdropClass?: string;
  closeOnBackdrop?: boolean;
}

const emit = defineEmits<{ (e: "closed"): void }>();

type MobileProp = boolean | "auto";

const props = withDefaults(defineProps<DrawerProps>(), {
  side: "right",
  mobile: "auto",
  breakpoint: "(max-width: 639px)",
  handleVisible: 32,
  sheetHeight: "80vh",
  widthClasses: "w-full sm:w-[22rem] lg:w-[28rem] max-w-[90vw]",
  teleportTo: "body",
  lockScroll: true,
  threshold: 20,
  fastVelocity: 450,
  title: "Panel",
  backdrop: true,
  backdropClass: "bg-black/40",
  closeOnBackdrop: true,
});

const formRef = ref<HTMLElement>();
const panelEl = ref<HTMLElement | null>(null);

const mq = useMediaQuery(props.breakpoint);
const isMobile = computed(() =>
  props.mobile === "auto" ? mq.value : !!props.mobile
);

const drawer = useDrawerMotion(panelEl, {
  side: props.side!,
  handleVisible: props.handleVisible!,
  widthClasses: props.widthClasses!,
  threshold: props.threshold!,
  fastVelocity: props.fastVelocity!,
});
const sheet = useSheetMotion(panelEl, {
  sheetHeight: props.sheetHeight!,
  handleVisible: props.handleVisible!,
  threshold: props.threshold!,
  fastVelocity: props.fastVelocity!,
});

const mode = computed(() => {
  if (isMobile.value) {
    return {
      axis: "y" as const,
      open: sheet.open,
      closed: sheet.closed.value,
      constraints: { top: sheet.open, bottom: sheet.closed.value },
      containerClass: `left-0 right-0 bottom-0 w-full rounded-t-lg`,
      style: sheet.style,
      isMobile: true,
      handleClass: undefined as unknown as string,
    };
  }
  const closed = drawer.closed.value;
  const constraints =
    props.side === "right"
      ? { left: drawer.open, right: closed }
      : { left: closed, right: drawer.open };
  return {
    axis: "x" as const,
    open: drawer.open,
    closed,
    constraints,
    containerClass: drawer.containerClass,
    style: drawer.style,
    isMobile: false,
    handleClass: drawer.handleClass,
  };
});

const targetPos = ref(0);
const startPos = ref(0);


const suspendDrag = ref(false);

function isInteractive(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (node.isContentEditable) return true;
  // Buttons/links shouldn't start a drag either
  if (tag === "button" || tag === "a") return true;
  // ARIA textbox or role-based widgets
  const role = node.getAttribute("role");
  if (role && /^(textbox|combobox|button|link|switch|slider)$/.test(role))
    return true;
  // If inside an interactive ancestor
  return !!node.closest(
    'input, textarea, select, [contenteditable="true"], button, a, [role="textbox"], [role="combobox"], [role="button"], [role="link"], [role="switch"], [role="slider"]'
  );
}

function onPointerDownCapture(e: PointerEvent) {
  suspendDrag.value = isInteractive(e.target);
}
function onPointerUpCapture() {
  suspendDrag.value = false;
}
function onPointerCancelCapture() {
  suspendDrag.value = false;
}

const showOverlay = computed(() => {
  // Show when explicitly open or not snapped to the closed position
  return Math.abs(targetPos.value - mode.value.closed) > 1;
});
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
function snapTo(pos: number) {
  requestAnimationFrame(() => {
    if (alive) targetPos.value = pos;
  });
}

onMounted(() => {
  requestAnimationFrame(() => {
    drawer.recompute();
    sheet.recompute();
    requestAnimationFrame(() => {
      snapTo(props.show ? mode.value.open : mode.value.closed);
    });
  });
});

watch(
  () => props.show,
  (v) => {
    snapTo(v ? mode.value.open : mode.value.closed);
  }
);

watch(
  () => props.show,
  (v) => {
    if (!props.lockScroll) return;
    const root = document.documentElement;
    const body = document.body;
    if (v) {
      root.style.overflow = "hidden";
      body.style.overflow = "hidden";
    } else {
      root.style.overflow = "";
      body.style.overflow = "";
    }
  },
  { immediate: true }
);

const { onKeydown } = useFocusTrap(
  computed(() => props.show),
  panelEl,
  {
    onEscape: () => {
      snapTo(mode.value.closed);
      emit("closed");
    },
  }
);

const transitionProps = {
  type: "spring" as const,
  stiffness: 600,
  damping: 70,
};

function handleDragStart() {
  startPos.value = targetPos.value;
}

function handleDragEnd(_: Event, info: DragInfo) {
  const axis = mode.value.axis;
  const offset = axis === "y" ? info.offset.y : info.offset.x;
  const velocity = axis === "y" ? info.velocity.y : info.velocity.x;
  const decision = isMobile.value
    ? sheet.decide(offset, velocity, startPos.value)
    : drawer.decide(offset, velocity, startPos.value);
  if (decision === "open") snapTo(mode.value.open);
  else {
    snapTo(mode.value.closed);
    emit("closed");
  }
}
</script>

<template>
  <Teleport :to="props.teleportTo" defer>
    <div>
      <div v-if="props.backdrop && showOverlay" class="fixed inset-0 z-40" :class="props.backdropClass"
        aria-hidden="true" @click="
          () => {
            if (props.closeOnBackdrop) {
              snapTo(mode.closed);
              emit('closed');
            }
          }
        "></div>
      <Motion ref="formRef" as="div" :initial="mode.axis === 'y' ? { y: 0 } : { x: 0 }"
        :animate="mode.axis === 'y' ? { y: targetPos } : { x: targetPos }" :transition="transitionProps"
        :drag="suspendDrag ? false : mode.axis" :drag-constraints="mode.constraints" :drag-elastic="0"
        :drag-snap-to-origin="false" :drag-momentum="false" :on-drag-start="handleDragStart"
        :on-drag-end="handleDragEnd" :class="[
          'absolute cursor-grab active:cursor-grabbing overflow-hidden bg-muted backdrop-blur shadow-lg focus-visible:outline-none z-50 focus-visible:border border-primary',
          mode.containerClass,
        ]" :style="mode.style" role="dialog" aria-modal="true" :aria-labelledby="'drawer-title'">
        <div ref="panelEl" tabindex="-1" :class="[
          'relative h-full focus-visible:outline-none',
          mode.isMobile ? 'p-3 pt-6' : 'p-3 pl-7',
        ]" @keydown="onKeydown" @pointerdown.capture="onPointerDownCapture" @pointerup.capture="onPointerUpCapture"
          @pointercancel.capture="onPointerCancelCapture">
          <!-- Drag handle -->
          <div v-if="mode.isMobile" class="absolute top-2 left-1/2 -translate-x-1/2 flex justify-center">
            <div class="w-10 h-1 rounded-full bg-primary" />
          </div>
          <div v-else :class="[
            'flex justify-center mb-2 absolute top-1/2 -translate-y-1/2',
            mode.handleClass,
          ]">
            <div class="w-1 h-8 bg-primary rounded-full" />
          </div>

          <!-- Header: slot or fallback title -->
          <div class="flex flex-col gap-1">
            <slot name="header">
              <h4 id="drawer-title" class="flex items-center gap-2 text-lg font-semibold dark:text-light">
                {{ props.title }}
              </h4>
            </slot>
            <slot name="subtitle" />
          </div>

          <!-- Content -->
          <div class="mt-2 flex flex-col h-[calc(100%-4.5rem)] overflow-auto">
            <slot />
          </div>
          <u-button variant="subtle" size="xs" class="absolute top-3 right-3" @click="
            () => {
              snapTo(mode.closed);
              emit('closed');
            }
          ">
            <u-icon name="i-lucide-x" class="w-4 h-4" />
          </u-button>
        </div>
      </Motion>
    </div>
  </Teleport>
</template>
