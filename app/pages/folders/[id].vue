<template>
    <div id="folder-page" class="inline-flex overflow-hidden w-full">
        <div v-if="loading">Loading...</div>
        <shared-error-message v-if="error" :error="error.message" />
        <Transition name="fade" mode="out-in" :duration="{
            enter: 300,
            leave: 300
        }">
            <div v-if="folder" class=" max-w-full order-2 transition-all duration-1000 will-change-auto">
                <div class="flex flex-wrap gap-4 justify-between my-4 pb-4">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <icon name="bi:folder" class="inline-block text-primary text-2xl" />
                            <UiTitle>{{ folder?.title }}</UiTitle>
                            <span v-if="folder.llmModel"
                                class="inline-flex items-center text-xs px-1 py-1 rounded bg-primary">
                                Model: <span class="ml-1 font-medium">{{ folder.llmModel.toLocaleUpperCase() }}</span>
                            </span>
                        </div>
                        <p class="mt-2">{{ folder?.description ? folder.description : 'No description available.' }}
                        </p>
                    </div>
                    <div class="flex flex-col items-start gap-1">
                        <p class="text-xs"><strong>Created At:</strong> {{ createdAt }}</p>
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
                </div>

                <div class="flex-1 w-full my-xl rounded-md">
                    <div class="flex gap-8 mx-auto border-b border-dark py-sm">
                        <div v-for="(item, index) in items" :key="index"
                            class="font-medium hover:opacity-100 transition-opacity rounded cursor-pointer flex items-center text-base gap-1"
                            :class="{ 'text-primary': activeIndex === index }" @click="select(index)">
                            <icon :name="item.icon" class="inline-block" />
                            <span>{{ item.name }}</span>
                        </div>
                    </div>
                    <UCarousel ref="carousel" v-slot="{ item }" :items="items" :prev="{ onClick: onClickPrev }"
                        :next="{ onClick: onClickNext }" class="w-full mx-auto" @select="onSelect">
                        <div class="rounded overflow-scroll my-lg">
                            <component :is="item.component" />
                        </div>

                    </UCarousel>
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


const route = useRoute()
const showUpload = ref(false)
const showMaterialsModal = ref(false)
const id = route.params.id
const { folder, loading, error } = useFolder(id! as string)
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

</script>
