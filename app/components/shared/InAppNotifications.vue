<script setup lang="ts">
defineProps<{ show: boolean }>()
const emit = defineEmits<{ (event: "close"): void }>()

onMounted(() => {
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") return emit("close")
    })
})

onUnmounted(() => {
    window.removeEventListener("keydown", (e) => {
        if (e.key === "Escape") return emit("close")
    })
})
</script>

<template>
    <Transition
name="modal" type="animation" :duration="{
        enter: 1700,
        leave: 1700,
    }">
        <div v-if="show">
            <div class=" z-40 rounded-lg p-3 shadow-lg mt-2">
                <div class="flex justify-between">
                    <slot name="header">default header</slot>
                    <button class="modal-default-button place-self-start dark:text-gray-400" @click="$emit('close')">
                        X
                    </button>
                </div>
                <slot name="body"> default body </slot>
            </div>
        </div>
    </Transition>
</template>
