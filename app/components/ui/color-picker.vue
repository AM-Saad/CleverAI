<script setup lang="tsx">
/** @jsxImportSource vue */
import { ref, reactive, computed, watch, defineComponent } from 'vue'
import { useSpring, useTransform, motion, MotionValue, useMotionValue, animate } from 'motion-v'
import { usePointerPosition } from 'motion-plus-vue'

/**
 * ==============   Utils   ================
 */

function calculateAngle(index: number, totalInRing: number): number {
  return (index / totalInRing) * Math.PI * 2
}

function calculateBasePosition(angle: number, radius: number) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function calculateHue(angle: number): number {
  const hueDegrees = (angle * 180) / Math.PI - 90 - 180
  return ((hueDegrees % 360) + 360) % 360
}

// ===============================
// Child components (GradientCircle and ColorDot)
// ===============================

/* ColorDot */
const ColorDot = defineComponent({
  props: {
    ring: Number,
    index: Number,
    totalInRing: Number,
    centerX: Number,
    centerY: Number,
    pointerX: Object as PropType<MotionValue<number>>,
    pointerY: Object as PropType<MotionValue<number>>,
    pushMagnitude: Number,
    pushSpring: Object,
    radius: Number,
    selectedColor: String,
    setSelectedColor: Function
  },
  setup(props) {
    const baseRadius = computed(() => props.ring! * 20)
    const angle = computed(() => calculateAngle(props.index!, props.totalInRing!))
    const basePos = computed(() => calculateBasePosition(angle.value, baseRadius.value))

    const normalizedHue = computed(() => calculateHue(angle.value))
    const color = computed(() => {
      if (props.ring === 0) return "hsl(0, 0%, 100%)"
      if (props.ring === 1)
        return `hsl(${normalizedHue.value}, 60%, 85%)`
      return `hsl(${normalizedHue.value}, 90%, 60%)`
    })

    const pushDistance = useTransform(() => {
      if (props.centerX === 0 || props.centerY === 0) return 0

      const px = props.pointerX!.get()
      const py = props.pointerY!.get()

      const dx = px - props.centerX!
      const dy = py - props.centerY!
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy)

      if (distanceFromCenter > props.radius!) return 0

      const dotX = props.centerX! + basePos.value.x
      const dotY = props.centerY! + basePos.value.y

      const cursorToDotX = dotX - px
      const cursorToDotY = dotY - py
      const cursorToDotDistance = Math.sqrt(
        cursorToDotX * cursorToDotX + cursorToDotY * cursorToDotY
      )

      const minDistance = 80
      if (cursorToDotDistance < minDistance) {
        const pushStrength = 1 - cursorToDotDistance / minDistance
        return pushStrength * props.pushMagnitude!
      }

      return 0
    })

    const pushAngle = useTransform(() => {
      if (!props.centerX || !props.centerY) return angle.value
      const px = props.pointerX!.get()
      const py = props.pointerY!.get()
      const dotX = props.centerX! + basePos.value.x
      const dotY = props.centerY! + basePos.value.y
      const cursorToDotX = dotX - px
      const cursorToDotY = dotY - py
      return Math.atan2(cursorToDotY, cursorToDotX)
    })
    const pushX = useTransform(() => {
      const distance = pushDistance.get()
      const angle = pushAngle.get()
      return Math.cos(angle) * distance
    })

    const pushY = useTransform(() => {
      const distance = pushDistance.get()
      const angle = pushAngle.get()
      return Math.sin(angle) * distance
    })

    const springPushX = useSpring(pushX, props.pushSpring)
    const springPushY = useSpring(pushY, props.pushSpring)

    const x = useTransform(() => basePos.value.x + springPushX.get())
    const y = useTransform(() => basePos.value.y + springPushY.get())

    const dotVariants = {
      default: {
        scale: 1,
      },
      hover: {
        scale: 1.5,
        transition: { duration: 0.13 },
      },
    }

    const ringVariants = {
      default: {
        opacity: 0,
      },
      hover: {
        opacity: 0.4,
        transition: { duration: 0.13 },
      },
    }

    const isSelected = computed(() => props.selectedColor === color.value)
    const activate = () => {
      props.setSelectedColor?.(isSelected.value ? null : color.value)
    }

    return () => (
      <motion.div
        class="color-dot"
        style={{
          x: x,
          y,
          backgroundColor: color.value,
          willChange: "transform, background-color",
        }}
        variants={dotVariants}
        initial="default"
        whileHover="hover"
        whilePress={{ scale: 1.2 }}
        onPress={activate}
        onKeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            activate()
          }
        }}
        tabindex={0}
        role="button"
        aria-label={`Select color ${color.value}`}
        aria-pressed={isSelected.value}
        transition={{
          scale: { type: "spring", damping: 30, stiffness: 200 },
        }}

      >
        <motion.div class="color-dot-ring" variants={ringVariants} />
      </motion.div>
    )
  }
})

/* GradientCircle */
const GradientCircle = defineComponent({
  props: {
    index: Number,
    totalInRing: Number,
    centerX: Number,
    centerY: Number,
    pointerX: { type: Object as PropType<MotionValue<number>> },
    pointerY: { type: Object as PropType<MotionValue<number>> },
    containerRadius: Number
  },
  setup(props) {
    const angle = computed(() => calculateAngle(props.index!, props.totalInRing!))
    const baseRadius = computed(() => props.containerRadius! - 40)
    const basePos = computed(() => calculateBasePosition(angle.value, baseRadius.value))
    const normalizedHue = computed(() => calculateHue(angle.value))
    const gradient = computed(() =>
      `radial-gradient(circle, hsla(${normalizedHue.value}, 90%, 60%, 1) 0%, hsla(${normalizedHue.value}, 90%, 60%, 0) 66%)`
    )

    const proximity = useTransform(() => {
      if (props.centerX === 0 || props.centerY === 0) return 0

      const px = props.pointerX?.get()!
      const py = props.pointerY?.get()!

      const gradientX = props.centerX! + basePos.value.x
      const gradientY = props.centerY! + basePos.value.y

      const dx = px - gradientX
      const dy = py - gradientY
      const distance = Math.sqrt(dx * dx + dy * dy)

      const maxDistance = 100
      const proximityValue = Math.max(0, 1 - distance / maxDistance)

      return proximityValue
    })

    const opacity = useTransform(proximity, [0, 1], [0.15, 0.35])
    const scale = useTransform(proximity, [0, 1], [1, 1.2])

    const springOpacity = useSpring(opacity, {
      damping: 30,
      stiffness: 100,
    })
    const springScale = useSpring(scale, {
      damping: 30,
      stiffness: 100,
    })


    return () => (
      <motion.div
        class="gradient-circle"
        style={{
          x: basePos.value.x,
          y: basePos.value.y,
          opacity: springOpacity,
          scale: springScale,
          background: gradient.value,
          willChange: "transform, opacity",
        }}
      />
    )
  }
})

const containerRef = ref<HTMLDivElement>()
const containerDimensions = reactive({
  centerX: 0,
  centerY: 0,
  radius: 200,
})
const { x: pointerX, y: pointerY } = usePointerPosition()
const selectedColor = ref<string | null>(null)

watch(containerRef, () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    containerDimensions.centerX = rect.left + rect.width / 2
    containerDimensions.centerY = rect.top + rect.height / 2
    containerDimensions.radius = rect.width / 2
  }
}, {
  flush: 'pre'
})

const rings = [{ count: 1 }, { count: 6 }, { count: 12 }]
const dots = computed(() => {
  const arr: Array<{
    ring: number
    index: number
    totalInRing: number
  }> = []
  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.count; i++) {
      arr.push({
        ring: ringIndex,
        index: i,
        totalInRing: ring.count,
      })
    }
  })
  return arr
})

const originalStopValues: string[] = []
for (let i = 0; i <= 360; i += 30) {
  originalStopValues.push(`hsl(${i}, 90%, 60%)`)
}
const stopMotionValues = originalStopValues.map(
  (value: string) => useMotionValue(value)
)

watch(selectedColor, () => {
  if (selectedColor.value !== null) {
    for (const stopValue of stopMotionValues) {
      animate(stopValue, selectedColor.value, {
        duration: 0.2,
      })
    }
  } else {
    for (let i = 0; i < stopMotionValues.length; i++) {
      const stopValue = stopMotionValues[i]
      const originalStopValue = originalStopValues[i]
      if (!stopValue || !originalStopValue) continue

      animate(stopValue, originalStopValue, {
        duration: 0.2,
      })
    }
  }
}, {
  immediate: true,
  flush: 'post'
})

const gradientBackground = useTransform(() => {
  let stops = ""
  for (let i = 0; i < stopMotionValues.length; i++) {
    const stopValue = stopMotionValues[i]
    if (!stopValue) continue

    stops += stopValue.get()
    if (i < stopMotionValues.length - 1) {
      stops += ", "
    }
  }
  return `conic-gradient(from 0deg, ${stops})`
})

const gradientScale = useMotionValue(1)

watch([selectedColor, gradientScale], () => {
  if (selectedColor.value !== null) {
    animate(gradientScale, 1.1, {
      type: "spring",
      visualDuration: 0.2,
      bounce: 0.8,
      velocity: 2,
    })
  } else {
    animate(gradientScale, 1, {
      type: "spring",
      visualDuration: 0.2,
      bounce: 0,
    })
  }
}, {
  immediate: true,
  flush: 'post'
})

const handleSetSelectedColor = (color: string | null) => {
  selectedColor.value = color === selectedColor.value ? null : color as string
}
</script>

<template>
  <div class="gradient-wrapper" ref="gradientWrapper">
    <div class="background">
      <motion.div class="gradient-background" :style="{
        background: gradientBackground,
        scale: gradientScale,
      }" />
      <motion.div class="solid-background" :animate="{
        scale: selectedColor !== null ? 0.9 : 0.98,
      }" :transition="{
        type: 'spring',
        visualDuration: 0.2,
        bounce: 0.2,
      }" />

    </div>
    <div ref="containerRef" class="picker-background">
      <GradientCircle v-for="(dot, index) in dots" :key="`gradient-${index}`" :index="dot.index"
        :totalInRing="dot.totalInRing" :centerX="containerDimensions.centerX" :centerY="containerDimensions.centerY"
        :pointerX="pointerX" :pointerY="pointerY" :containerRadius="containerDimensions.radius" />
      <ColorDot v-for="dot in dots.slice().reverse()" :key="`${dot.ring}-${dot.index}`" :ring="dot.ring"
        :index="dot.index" :totalInRing="dot.totalInRing" :centerX="containerDimensions.centerX"
        :centerY="containerDimensions.centerY" :pointerX="pointerX" :pointerY="pointerY"
        :radius="containerDimensions.radius" :pushMagnitude="5" :pushSpring="{
          damping: 30,
          stiffness: 100,
        }" :selectedColor="selectedColor ?? undefined" :setSelectedColor="handleSetSelectedColor" />
    </div>

  </div>
</template>

<style scoped>
.gradient-wrapper {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.gradient-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  z-index: 0;
}

.solid-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-content-on-background);
  border-radius: 50%;
  z-index: 1;
}

.picker-background {
  position: relative;
  width: calc(100% - 5px);
  height: calc(100% - 5px);
  border-radius: 50%;
  overflow: visible;
  z-index: 2;
}

.color-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  translate: -50% -50%;
  cursor: pointer;
}

.color-dot:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 2px;
}

.color-dot-ring {
  position: absolute;
  inset: 0;
  border: 2px solid white;
  border-radius: 50%;
  mix-blend-mode: overlay;
  pointer-events: none;
  transition: opacity 0.13s;
}

.gradient-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  translate: -50% -50%;
  pointer-events: none;
  mix-blend-mode: color-burn;
}
</style>
