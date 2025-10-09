<template>
    <div id="folder-page" class=" ">
        <div v-if="loading">Loading...</div>

        <shared-server-error v-model:typed-error="typedError" :loading="loading" />


        <Transition name="fade" mode="out-in" :duration="{ enter: 300, leave: 300 }">
            <div v-if="folder" class="order-2 transition-all duration-1000 will-change-auto">
                <header class="flex flex-wrap gap-4 justify-between my-4 pb-4">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <icon name="bi:folder" class="inline-block text-primary text-2xl" />
                            <UiTitle>{{ folder?.title }}</UiTitle>
                            <span v-if="folder.llmModel"
                                class="inline-flex items-center text-xs px-1 py-1 rounded bg-primary">
                                Model:
                                <span class="ml-1 font-medium">
                                    {{ folder.llmModel.toLocaleUpperCase() }}
                                </span>
                            </span>
                        </div>
                        <UiParagraph class="mt-2">
                            {{ folder?.description ?
                                folder.description : 'No description available.' }}
                        </UiParagraph>
                    </div>

                    <div class="flex flex-col items-start gap-1">
                        <UiParagraph size="xs">Created At: {{ createdAt }}</UiParagraph>
                        <div class="flex justify-between items-center gap-2">
                            <UButton color="primary" variant="outline" :aria-expanded="showUpload"
                                aria-controls="upload-materials" @click="toggleUploadForm">
                                Upload Materials
                            </UButton>
                            <UButton color="primary" variant="soft" @click="showMaterialsModal = true">
                                View Materials
                            </UButton>
                            <FolderUploadMaterialForm :show="showUpload" :backdrop="false" @closed="showUpload = false"
                                @cancel="showUpload = false" />
                        </div>
                    </div>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    <!-- CAROUSEL Goes Here -->
                    <UiCard variant="ghost">
                        <UiTabs v-model="activeIndex" :items="items" @select="select" />
                        <UCarousel ref="carousel" v-slot="{ item }" :items="items" :prev="{ onClick: onClickPrev }"
                            :next="{ onClick: onClickNext }" :ui="{ item: 'ps-0', container: '-ms-0' }"
                            @select="onSelect">
                            <div class="rounded overflow-scroll">
                                <component :is="item.component" />
                            </div>

                        </UCarousel>
                    </UiCard>

                    <!-- NOTES Goes Here -->
                    <FolderNotesSection :folder-id="`${id as string}`" />

                </div>


            </div>

        </Transition>

        <!-- Materials Modal -->
        <UiDialogModal :show="showMaterialsModal" @close="showMaterialsModal = false">
            <template #header>
                <div class="flex flex-col gap-1">
                    <h3 class="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        <icon name="bi:folder" class="" />
                        Materials in {{ folder?.title }}
                    </h3>
                    <p class="font-normal text-sm text-neutral-500">
                        View and manage materials in this folder
                    </p>
                </div>
            </template>
            <template #body>
                <MaterialsList :folder-id="`${id as string}`" @removed="() => { }" @error="(e) => console.error(e)" />
            </template>
        </UiDialogModal>

    </div>

</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { defineAsyncComponent } from 'vue'
import { useFolder } from '~/composables/folders/useFolders'

// Define page meta for authentication
definePageMeta({
    middleware: 'role-auth', // Use the role-auth middleware
})

const FlashCards = defineAsyncComponent(() => import('~/components/folder/FlashCards.vue'))
const Questions = defineAsyncComponent(() => import('~/components/folder/Questions.vue'))
const UiTabs = defineAsyncComponent(() => import('~/components/ui/UiTabs.vue'))


const route = useRoute()
const showUpload = ref(false)
const showMaterialsModal = ref(false)
const id = route.params.id
const { folder, loading, typedError } = useFolder(id! as string)
const createdAt = computed(() => useNuxtLocaleDate(new Date(folder.value?.createdAt || new Date().toISOString())))

const items = [
    {
        name: 'Flash Cards',
        icon: 'bi:card-text',
        component: FlashCards
    },
    {
        name: 'Questions',
        icon: 'bi:question-circle',
        component: Questions
    },

]

watch(typedError, (newError) => {
    if (newError) {
        console.error('Error fetching folder:', newError.stack)
    }
})
const carousel = useTemplateRef('carousel')
const activeIndex = ref(0)

function onClickPrev() {
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
}
function onClickNext() {
    activeIndex.value = Math.min(activeIndex.value + 1, items.length - 1)
}
function onSelect(index: number) {
    activeIndex.value = index
}

function select(index: number) {
    activeIndex.value = index

    carousel.value?.emblaApi?.scrollTo(index)
}

function toggleUploadForm() {
    showUpload.value = !showUpload.value
}

const MaterialsList = defineAsyncComponent(() => import('~/components/folder/MaterialsList.vue'))
const FolderNotesSection = defineAsyncComponent(() => import('~/components/folder/NotesSection.vue'))

</script>
