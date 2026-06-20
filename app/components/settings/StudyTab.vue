<template>
    <div class="space-y-6">
        <UiPanel size="md" variant="surface">
            <template #header>
                <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-book-open" class="w-5 h-5" />
                    Study Preferences
                </div>
            </template>
            <div class="space-y-4">
                <UFormField label="Default Cards per Session" help="How many cards to review in a single session">
                    <UiInput v-model.number="studySettings.defaultSessionSize" type="number" min="5" max="100"
                        placeholder="20" :ui="{
                            root: 'w-full',
                        }" />
                </UFormField>

                <UFormField label="Auto-advance after grading" help="Automatically move to next card after grading">
                    <UiSwitch v-model="studySettings.autoAdvance" />
                </UFormField>

                <UFormField label="Show answer immediately" help="Reveal answer without requiring a click">
                    <UiSwitch v-model="studySettings.showAnswerImmediately" />
                </UFormField>
            </div>

            <template #footer>
                <div class="flex justify-end">
                    <UiButton @click="saveSettings">
                        Save Changes
                    </UiButton>
                </div>
            </template>
        </UiPanel>
    </div>
</template>

<script setup lang="ts">
const toast = useToast();

// Study settings
const studySettings = ref({
    defaultSessionSize: 20,
    autoAdvance: true,
    showAnswerImmediately: false,
});

// Save settings
const saveSettings = () => {
    // TODO: Implement API call to save study settings
    toast.add({
        title: "Success",
        description: "Study preferences saved",
        color: "success",
    });
};

// Load settings on mount
onMounted(() => {
    // TODO: Load actual study settings from API
});
</script>
