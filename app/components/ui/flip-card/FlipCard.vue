<template>
    <div :class="cn('h-72 w-64 select-none [perspective:1000px]', props.class)">
        <div :class="cn(
            'relative h-full rounded-2xl transition-transform duration-500 will-change-transform cursor-pointer [transform-style:preserve-3d]'
        )" :style="{ transform: wrapperTransform }" @click="flipped = !flipped">
            <!-- Front -->
            <div
                class="absolute size-full overflow-hidden rounded-2xl border [backface-visibility:hidden] bg-accent p-4">
                <slot name="front" />
            </div>

            <!-- Back -->
            <div :class="cn(
                'absolute h-full w-full overflow-hidden rounded-2xl border bg-black/80 p-4 text-slate-200 [backface-visibility:hidden]'
            )" :style="{ transform: backTransform }">
                <slot name="back" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils';
import { computed, ref } from "vue";

interface FlipCardProps {
    rotate?: "x" | "y";
    class?: string;
    front?: string;
    back?: string;
}

const props = withDefaults(defineProps<FlipCardProps>(), {
    rotate: "y",
});
const flipped = ref(false);

const axis = computed(() => (props.rotate === 'x' ? 'X' : 'Y'));
const wrapperTransform = computed(() => `rotate${axis.value}(${flipped.value ? 180 : 0}deg)`);
const backTransform = computed(() => `rotate${axis.value}(180deg)`);
</script>
