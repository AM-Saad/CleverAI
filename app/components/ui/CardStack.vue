<script setup lang="ts">
import { ref, computed, h, watch, type PropType } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from 'motion-v'

// ── Types ─────────────────────────────────────────────────────
export interface DemoPhoto {
  id: string | number
  src: string
  label: string
}

const props = defineProps({
  items: {
    type: Array as PropType<any[]>,
    default: () => []
  }
})

// ── Constants ─────────────────────────────────────────────────
const PHOTOS: DemoPhoto[] = [
  { id: 0, src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=640&q=80', label: 'Swiss Alps' },
  { id: 1, src: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=640&q=80', label: 'Alpine Lake' },
  { id: 2, src: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=640&q=80', label: 'Forest Path' },
  { id: 3, src: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=640&q=80', label: 'Misty Ridge' },
  { id: 4, src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=640&q=80', label: 'Summit View' },
]

const SWIPE_DIST = 150
const SWIPE_VEL = 400
const FLY = 1600

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

// ── State ─────────────────────────────────────────────────────
const dataItems = computed(() => props.items && props.items.length ? props.items : PHOTOS)
const deck = ref<any[]>([...dataItems.value])

watch(dataItems, (newItems) => {
  deck.value = [...newItems]
}, { immediate: true })

const topDragX = ref(0)
// Ensure we always have slightly more visibility if playing with smooth entries, 4 is great.
const visible = computed(() => deck.value.slice(0, 4))

function swipeRight(): void {
  // Swipe Right = Next item. Move top card to the back of the deck.
  if (deck.value.length === 0) return
  const top = deck.value.shift()
  if (top !== undefined) deck.value.push(top)
  topDragX.value = 0
}

function swipeLeft(): void {
  // Swipe Left = Previous item. Move the very last card in the deck back to the top.
  if (deck.value.length === 0) return
  const last = deck.value.pop()
  if (last !== undefined) deck.value.unshift(last)
  topDragX.value = 0
}

// ── CardItem (render-function component) ──────────────────────
const CardItem = {
  name: 'CardItem',
  props: {
    item: { type: Object, required: true },
    stackIndex: { type: Number, required: true },
    total: { type: Number, required: true },
    swipeLeft: { type: Function as unknown as () => () => void, required: true },
    swipeRight: { type: Function as unknown as () => () => void, required: true },
    dragX: { type: Number, default: 0 },
    onDragX: { type: Function as unknown as () => (v: number) => void, default: () => { } },
    slots: { type: Object, required: true }
  },
  setup(props: any) {
    const springReturn = { type: 'spring', stiffness: 450, damping: 30 }
    const springFly = { type: 'spring', stiffness: 350, damping: 25 }

    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12])

    const likeOpacity = useTransform(x, [0, 80], [0, 1])
    const nopeOpacity = useTransform(x, [-80, 0], [1, 0])

    const isDragging = ref(false)
    const justThrown = ref(false)

    x.on('change', (val: number) => {
      // Only emit top card's drag x
      if (props.stackIndex === 0) props.onDragX(val)
    })

    // Listen to stackIndex. When a card is thrown offscreen and moved to the back,
    // stackIndex quickly grows > 0. We then animate x/y smoothly back to 0 so it flies visually 
    // behind the newly shifted deck instead of abruptly teleporting!
    watch(() => props.stackIndex, (newVal, oldVal) => {
      if (prefersReducedMotion.value) {
        x.jump(0)
        y.jump(0)
        return
      }

      if (newVal > 0 && oldVal === 0) {
        justThrown.value = true
        setTimeout(() => { justThrown.value = false }, 300);

        // Instantly snap the y value (depth) to its correct back-of-deck offset to prevent diagonal/upward flashes
        const finalY = newVal * 14;
        y.jump(finalY);

        // ONLY smoothly spring the horizontal x back to 0 so it slides directly from the right!
        (animate as any)(x, 0, { type: 'spring', stiffness: 300, damping: 35 });
      }
    }, { flush: 'sync' })

    function onClickCapture(e: MouseEvent) {
      if (isDragging.value || Math.abs(x.get()) > 5 || Math.abs(y.get()) > 5) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    async function onDragEnd(_event: PointerEvent, info: { velocity: { x: number } }): Promise<void> {
      setTimeout(() => { isDragging.value = false }, 50)

      const xNow = x.get()
      const vNow = info.velocity.x

      if (Math.abs(xNow) > SWIPE_DIST || Math.abs(vNow) > SWIPE_VEL) {
        const dir = xNow >= 0 ? 1 : -1

        if (prefersReducedMotion.value) {
          x.jump(0)
          y.jump(0)
          if (dir === 1) props.swipeRight()
          else props.swipeLeft()
        } else {
          // Trigger the fly away instantly (non-blocking)
          (animate as any)(x, dir * FLY, springFly)

          // Wait briefly while it smoothly exits view, then update deck state seamlessly.
          // This removes the "freeze" and creates a buttery infinite cycle!
          setTimeout(() => {
            if (dir === 1) {
              props.swipeRight()
            } else {
              props.swipeLeft()
            }
            props.onDragX(0) // Zero the drag offset AFTER shifting so layout completes its swell!
          }, 120) // 120ms avoids feeling sluggish
        }
      } else {
        if (prefersReducedMotion.value) {
          x.jump(0)
          y.jump(0)
        } else {
          (animate as any)(x, 0, springReturn);
          (animate as any)(y, 0, springReturn);
        }
        props.onDragX(0)
      }
    }

    return () => {
      const isTop = props.stackIndex === 0
      const zIndex = props.total - props.stackIndex

      // Map the drag distance (0 to SWIPE_DIST) into a 0 -> 1 progress multiplier
      const dragProgress = isTop ? 0 : Math.min(1, Math.abs(props.dragX) / SWIPE_DIST)

      // The cards behind the top card dynamically move up their index position
      const virtualIndex = isTop ? 0 : props.stackIndex - dragProgress

      const bgScale = 1 - virtualIndex * 0.04
      const bgY = virtualIndex * 14

      // Unify scale and Y to ensure it animates smoothly when moving from background to top
      const targetScale = isTop ? 1 : bgScale
      const targetY = isTop ? 0 : bgY

      const renderDemoCard = () => [
        h('img', { src: props.item.src, alt: props.item.label, class: 'w-full h-full object-cover block pointer-events-none -webkit-user-drag-none' }),
        h('div', { class: 'absolute inset-x-0 bottom-0 p-5 pt-16 bg-gradient-to-t from-black/80 to-transparent font-serif text-xl tracking-tight text-white' }, props.item.label),
        h(motion.div, { class: 'absolute top-5 right-5 px-4 py-1.5 rounded-lg text-[0.8rem] font-bold tracking-widest uppercase border text-green-400 border-green-400 rotate-[8deg] pointer-events-none', style: { opacity: likeOpacity } }, 'Next'),
        h(motion.div, { class: 'absolute top-5 left-5 px-4 py-1.5 rounded-lg text-[0.8rem] font-bold tracking-widest uppercase border text-red-500 border-red-500 -rotate-[8deg] pointer-events-none', style: { opacity: nopeOpacity } }, 'Prev'),
      ]

      const content = props.slots.default ? props.slots.default({ item: props.item }) : renderDemoCard()

      // The base wrapper container style
      const motionProps: any = {
        class: isTop
          ? 'absolute inset-0 rounded-2xl overflow-hidden shadow-xl will-change-transform touch-none select-none bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-10  border border-surface-subtle'
          : 'absolute inset-0 rounded-2xl overflow-hidden shadow-md will-change-transform touch-none select-none bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-10  border border-surface-subtle',
        style: { zIndex, x, y, rotate },
        onClickCapture
      }

      if (isTop) {
        motionProps.drag = true
        motionProps.dragElastic = 0.15
        motionProps.dragMomentum = false
        motionProps.onDragStart = () => { isDragging.value = true }
        motionProps.onDragEnd = onDragEnd
        motionProps.style.cursor = 'grab'
      }

      if (!prefersReducedMotion.value) {
        // Apply smooth transition to ALL cards for layout movements
        motionProps.animate = { scale: targetScale, y: targetY }
        motionProps.transition = justThrown.value
          ? { type: 'tween', duration: 0.01 }
          : { type: 'spring', stiffness: 450, damping: 35 }
      } else {
        motionProps.style.transform = `translateY(${targetY}px) scale(${targetScale})`
      }

      return h(motion.div, motionProps, content)
    }
  },
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-6 w-full h-full  relative overflow-hidden">
    <div class="relative w-full max-w-[250px] aspect-[4/3]">
      <CardItem v-for="(item, i) in visible" :key="item.id || i" :item="item" :stack-index="i" :total="visible.length"
        :swipe-left="swipeLeft" :swipe-right="swipeRight" :drag-x="topDragX"
        :on-drag-x="(v: number) => { topDragX = v }" :slots="$slots" />

      <!-- Empty State Fallback safely under the deck -->
      <div v-if="!deck.length"
        class="absolute inset-0 flex flex-col items-center justify-center text-content-secondary text-sm">
        <Icon name="i-lucide-layers" class="w-12 h-12 mb-3 opacity-50" />
        No more cards
      </div>
    </div>

    <!-- Controls -->
    <div v-if="deck.length > 0" class="flex items-center gap-8 mt-4 relative z-10">
      <button
        class="w-6 h-6 rounded-full border border-surface-subtle bg-white text-content-secondary active:scale-90 transition-all flex items-center justify-center shadow-sm"
        title="Previous" @click="swipeLeft">
        <Icon class="text-content-secondary" name="i-lucide-arrow-left" :size="UI_CONFIG.ICON_SIZE" />
      </button>

      <div class="flex gap-2.5">
        <div v-for="(p, i) in deck.slice(0, 5)" :key="p.id || i" :class="[
          'w-2 h-2 rounded-full transition-all duration-300',
          i === 0 ? 'bg-primary scale-125' : 'bg-slate-300'
        ]" />
      </div>

      <button
        class="w-6 h-6 rounded-full border border-surface-subtle bg-white text-content-secondary active:scale-90 transition-all flex items-center justify-center shadow-sm"
        title="Next" @click="swipeRight">
        <Icon class="text-content-secondary" name="i-lucide-arrow-right" :size="UI_CONFIG.ICON_SIZE" />
      </button>
    </div>

  </div>
</template>

<style scoped>
/* Modern component fully styled without direct CSS manipulation */
</style>
