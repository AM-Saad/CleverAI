<template>
    <div
        :class="`form-group min-w-full relative h-14 border has-[:focus-within]:border-primary-300 overflow-hidden rounded ${props.styles?.inputField || ''}`">
        <input
:id="props.id" v-model="model" :type="props.type" :name="props.name"
            :class="`w-full h-full p-3 peer focus:pt-8 ${model ? 'pt-8' : ''} ${props.styles?.input || ''} `"
            tabindex="1" placeholder="" autocomplete="false | unknown-autocomplete-value" :pattern="props.pattern"
            :title="props.title" >
        <label
:for="props.id" :class="`absolute transition-all duration-300 left-2 text-sm text-gray-400
            ${model ? 'top-2 text-xs' : ' top-4 peer-focus:top-2 peer-focus:text-xs'}
            ${props.styles?.label || ''}
            `">
            {{ label }}
        </label>
    </div>
</template>

<script setup lang="ts">
type InputStyles = {
    inputField?: string
    input?: string
    label?: string
}
interface InputFieldProps {
    id: string
    label: string
    type?: string
    title?: string
    name?: string
    pattern?: string | undefined
    tabindex?: string | number
    styles?: InputStyles
}
const model = defineModel({ type: String, required: true })

const props = withDefaults(defineProps<InputFieldProps>(), {
    id: "id",
    label: "label",
    type: "text",
    title: "title",
    name: "name",
    pattern: undefined,
    tabindex: 1,
    styles: undefined,
})
</script>
