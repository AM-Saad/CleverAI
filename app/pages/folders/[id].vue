<template>
    <div id="folder-page" class="inline-flex mt-xl overflow-hidden w-full">
        <div v-if="loading">Loading...</div>
        <shared-error-message v-if="error" :error="error.message" />
        <Transition name="fade" mode="out-in" :duration="{
            enter: 300,
            leave: 300
        }">
            <div v-if="folder"
                class="bg-white dark:bg-foreground max-w-full order-2 transition-all duration-1000 will-change-auto">
                <div class="flex flex-wrap gap-4 justify-between my-4 pb-4">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <icon name="bi:folder" class="inline-block text-primary text-2xl" />
                            <h1 class="font-bold dark:text-background text-2xl">{{ folder?.title }}</h1>
                            <span v-if="folder.llmModel"
                                class="inline-flex items-center text-xs px-1 py-1 rounded bg-foreground text-accent dark:bg-neutral-800">
                                Model: <span class="ml-1 font-medium">{{ folder.llmModel.toLocaleUpperCase() }}</span>
                            </span>
                        </div>
                        <p class="mt-2">{{ folder?.description ? folder.description : 'No description available.' }}
                        </p>
                    </div>
                    <div class="flex flex-col items-start gap-1">
                        <p class="text-xs"><strong>Created At:</strong> {{ createdAt }}</p>
                        <div class="flex justify-between items-center">
                            <button class="btn bg-accent text-foreground" :aria-expanded="showUpload"
                                aria-controls="upload-materials" @click="toggleUploadForm">
                                Upload Materials
                            </button>
                            <FolderUploadMaterialForm :show="showUpload" :backdrop="false" @closed="showUpload = false"
                                @cancel="showUpload = false" />
                        </div>
                    </div>
                </div>

                <div class="flex-1 w-full my-xl rounded-md">
                    <div class="flex gap-4 mx-auto border-b border-gray-200 py-sm">
                        <div v-for="(item, index) in items" :key="index"
                            class="font-medium hover:opacity-100 transition-opacity rounded cursor-pointer flex items-center text-base gap-1"
                            :class="{ 'text-secondary': activeIndex === index }" @click="select(index)">
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

</script>
