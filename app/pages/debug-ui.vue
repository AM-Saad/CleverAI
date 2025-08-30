<template>
    <div class="container mx-auto p-8 space-y-8">
        <h1 class="text-2xl font-bold">UI Component Testing - Buttons & Inputs</h1>

        <!-- Button Design Section -->
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-blue-600 border-b border-blue-200 pb-2">🎨 UButton Design System</h2>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Default UButton Variants</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton>Default Button</UButton>
                    <UButton variant="solid">Solid Button</UButton>
                    <UButton variant="outline">Outline Button</UButton>
                    <UButton variant="soft">Soft Button</UButton>
                    <UButton variant="ghost">Ghost Button</UButton>
                    <UButton variant="link">Link Button</UButton>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Custom Styled Buttons</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton
                        class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
                        Gradient Button
                    </UButton>

                    <UButton size="xs" :ui="{
                        font: 'font-bold',
                        rounded: 'rounded-full',
                        size: {
                            xs: ' px-0 py-0 bg-red-600'
                        }
                    }">
                        Green Pill
                    </UButton>

                    <UButton
                        class="bg-white text-gray-800 border-2 border-gray-300 hover:border-blue-500 hover:text-blue-500 font-semibold py-2 px-4 rounded-lg transition-all duration-200">
                        Bordered Button
                    </UButton>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">UButton with UI Prop Overrides</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton :ui="{
                        base: 'focus:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-75 flex-shrink-0',
                        font: 'font-bold',
                        rounded: 'rounded-xl',
                        size: {
                            md: 'text-sm px-6 py-3'
                        },
                        color: {
                            primary: {
                                solid: 'shadow-sm ring-1 ring-inset ring-blue-500 text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500'
                            }
                        }
                    }" color="primary" variant="solid">
                        Custom Primary
                    </UButton>

                    <UButton :ui="{
                        color: {
                            orange: {
                                solid: 'shadow-sm ring-1 ring-inset ring-orange-500 text-white bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500'
                            }
                        }
                    }" color="orange" variant="solid">
                        Custom Orange
                    </UButton>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Button Sizes</h3>
                <div class="flex flex-wrap items-center gap-4">
                    <UButton size="xs">Extra Small</UButton>
                    <UButton size="sm">Small</UButton>
                    <UButton size="md">Medium</UButton>
                    <UButton size="lg">Large</UButton>
                    <UButton size="xl">Extra Large</UButton>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Button Colors</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton color="primary">Primary</UButton>
                    <UButton color="gray">Gray</UButton>
                    <UButton color="red">Red</UButton>
                    <UButton color="orange">Orange</UButton>
                    <UButton color="amber">Amber</UButton>
                    <UButton color="yellow">Yellow</UButton>
                    <UButton color="lime">Lime</UButton>
                    <UButton color="green">Green</UButton>
                    <UButton color="emerald">Emerald</UButton>
                    <UButton color="teal">Teal</UButton>
                    <UButton color="cyan">Cyan</UButton>
                    <UButton color="sky">Sky</UButton>
                    <UButton color="blue">Blue</UButton>
                    <UButton color="indigo">Indigo</UButton>
                    <UButton color="violet">Violet</UButton>
                    <UButton color="purple">Purple</UButton>
                    <UButton color="fuchsia">Fuchsia</UButton>
                    <UButton color="pink">Pink</UButton>
                    <UButton color="rose">Rose</UButton>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Interactive Button Examples</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton
                        class="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-150"
                        @click="buttonClicked">
                        Click Me! ({{ clickCount }})
                    </UButton>

                    <UButton :disabled="isLoading"
                        class="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold  px-8 rounded-xl transition-colors duration-200 "
                        @click="simulateLoading">
                        <span v-if="!isLoading">Load Data</span>
                        <span v-else class="flex items-center gap-2">
                            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    stroke-width="4" />
                                <path class="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Loading...
                        </span>
                    </UButton>
                </div>
            </div>

            <!-- Custom Styled Button Component -->
            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Custom StyledButton Component</h3>
                <p class="text-gray-600">Reusable button component with theme system</p>

                <div class="space-y-6">
                    <!-- Theme Examples -->
                    <div>
                        <h4 class="text-lg font-medium mb-3">Theme Variants</h4>
                        <div class="flex flex-wrap gap-3">
                            <StyledButton theme="primary" @click="buttonClicked">
                                Primary ({{ clickCount }})
                            </StyledButton>
                            <StyledButton theme="secondary" @click="buttonClicked">
                                Secondary
                            </StyledButton>
                            <StyledButton theme="success" @click="buttonClicked">
                                Success
                            </StyledButton>
                            <StyledButton theme="warning" @click="buttonClicked">
                                Warning
                            </StyledButton>
                            <StyledButton theme="danger" @click="buttonClicked">
                                Danger
                            </StyledButton>
                            <StyledButton theme="gradient" @click="buttonClicked">
                                Gradient
                            </StyledButton>
                        </div>
                    </div>

                    <!-- Size Examples -->
                    <div>
                        <h4 class="text-lg font-medium mb-3">Size Variants</h4>
                        <div class="flex flex-wrap items-center gap-3">
                            <StyledButton size="xs" theme="primary">
                                Extra Small
                            </StyledButton>
                            <StyledButton size="sm" theme="primary">
                                Small
                            </StyledButton>
                            <StyledButton size="md" theme="primary">
                                Medium
                            </StyledButton>
                            <StyledButton size="lg" theme="primary">
                                Large
                            </StyledButton>
                            <StyledButton size="xl" theme="primary">
                                Extra Large
                            </StyledButton>
                        </div>
                    </div>

                    <!-- Rounded Examples -->
                    <div>
                        <h4 class="text-lg font-medium mb-3">Rounded Variants</h4>
                        <div class="flex flex-wrap gap-3">
                            <StyledButton rounded="none" theme="success">
                                No Rounded
                            </StyledButton>
                            <StyledButton rounded="sm" theme="success">
                                Small Rounded
                            </StyledButton>
                            <StyledButton rounded="md" theme="success">
                                Medium Rounded
                            </StyledButton>
                            <StyledButton rounded="lg" theme="success">
                                Large Rounded
                            </StyledButton>
                            <StyledButton rounded="full" theme="success">
                                Full Rounded
                            </StyledButton>
                        </div>
                    </div>

                    <!-- Elevation Examples -->
                    <div>
                        <h4 class="text-lg font-medium mb-3">Elevation Variants</h4>
                        <div class="flex flex-wrap gap-4">
                            <StyledButton elevation="none" theme="secondary">
                                No Shadow
                            </StyledButton>
                            <StyledButton elevation="sm" theme="secondary">
                                Small Shadow
                            </StyledButton>
                            <StyledButton elevation="md" theme="secondary">
                                Medium Shadow
                            </StyledButton>
                            <StyledButton elevation="lg" theme="secondary">
                                Large Shadow
                            </StyledButton>
                        </div>
                    </div>

                    <!-- Combined Examples -->
                    <div>
                        <h4 class="text-lg font-medium mb-3">Combined Examples</h4>
                        <div class="flex flex-wrap gap-3">
                            <StyledButton theme="gradient" rounded="full" elevation="lg" size="lg"
                                @click="simulateLoading">
                                Premium Button
                            </StyledButton>
                            <StyledButton theme="danger" rounded="lg" elevation="md" disabled>
                                Disabled Button
                            </StyledButton>
                            <StyledButton theme="success" rounded="sm" elevation="sm" size="sm">
                                Compact Success
                            </StyledButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Input Section (Previous Content) -->
        <div class="space-y-6 border-t border-gray-200 pt-8">
            <h2 class="text-2xl font-bold text-green-600 border-b border-green-200 pb-2">🎯 UInput Design System</h2>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">✅ Working Solution: GreenInput Component</h2>
                <GreenInput v-model="testValue5" placeholder="This uses our custom GreenInput component" />
                <p class="text-sm text-green-600 font-medium">✅ This should have green borders!</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Default UInput (should have green border from app.config.ts)</h2>
                <UInput v-model="testValue" placeholder="This should have green border from app.config.ts" />
                <p class="text-sm text-gray-600">Test: Type something to see focus state</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">UInput with explicit green border class</h2>
                <UInput v-model="testValue2" placeholder="This has explicit border-green-500 class"
                    class="!border-green-500 !focus:border-green-600" />
                <p class="text-sm text-gray-600">Test: This should definitely be green</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">UInput with ui prop override</h2>
                <UInput v-model="testValue4" placeholder="UI prop override test"
                    :ui="{ variant: { outline: 'shadow-sm bg-white text-gray-900 ring-1 ring-inset ring-green-500 focus:ring-2 focus:ring-green-600' } }"
                    variant="outline" />
                <p class="text-sm text-gray-600">Test: Using ui prop to override styling with ring classes</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">🎯 UInput with working ring classes</h2>
                <UInput v-model="testValue6" placeholder="This should work with ring classes"
                    class="ring-1 ring-green-500 focus:ring-2 focus:ring-green-600" />
                <p class="text-sm text-green-600">Test: Using ring classes directly (Nuxt UI style)</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Regular HTML input with Tailwind green border</h2>
                <input v-model="testValue3" placeholder="Plain HTML input with green border"
                    class="border border-green-500 px-3 py-2 rounded focus:border-green-600 focus:outline-none w-full">
                <p class="text-sm text-gray-600">Test: This should definitely show green to confirm Tailwind works</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">How to Use Green Styling</h2>
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 class="font-medium text-green-800 mb-2">Three Options Available:</h3>
                    <ol class="list-decimal list-inside text-sm text-green-700 space-y-1">
                        <li><strong>Use GreenInput component:</strong> <code>&lt;GreenInput v-model="value" /&gt;</code>
                        </li>
                        <li><strong>Use ui prop:</strong>
                            <code>&lt;UInput :ui="{ variant: { outline: 'ring-green-300 focus:ring-green-500' } }" /&gt;</code>
                        </li>
                        <li><strong>Use CSS classes:</strong> <code>&lt;UInput class="!border-green-500" /&gt;</code>
                        </li>
                    </ol>
                </div>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Inspect Elements</h2>
                <div class="bg-gray-100 p-4 rounded">
                    <p class="text-sm">Open browser dev tools and inspect the UInput elements above</p>
                    <p class="text-sm">Look for:</p>
                    <ul class="text-sm list-disc ml-4">
                        <li>Applied CSS classes on the input elements</li>
                        <li>Whether app.config.ts styles are being loaded</li>
                        <li>Any CSS conflicts or overrides</li>
                    </ul>
                </div>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Current app.config.ts UI values</h2>
                <details class="bg-gray-100 p-4 rounded">
                    <summary class="cursor-pointer font-medium">Click to show config</summary>
                    <pre class="text-xs mt-2">{{ JSON.stringify(appConfig.ui, null, 2) }}</pre>
                </details>
            </div>
        </div> <!-- Close Input Section -->
    </div> <!-- Close Container -->
</template>

<script setup>
// Input test values
const testValue = ref('')
const testValue2 = ref('')
const testValue3 = ref('')
const testValue4 = ref('')
const testValue5 = ref('')
const testValue6 = ref('')

// Button interaction state
const clickCount = ref(0)
const isLoading = ref(false)

// Button interaction methods
const buttonClicked = () => {
    clickCount.value++
}

const simulateLoading = async () => {
    isLoading.value = true
    await new Promise(resolve => setTimeout(resolve, 2000))
    isLoading.value = false
}

const appConfig = useAppConfig()
</script>
