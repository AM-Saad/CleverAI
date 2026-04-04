<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { loadStripe } from '@stripe/stripe-js'
import { useCreditsStore } from '~/composables/useCreditsStore'
import { storeToRefs } from 'pinia'
import { useRuntimeConfig } from '#app'
import UiDrawer from '~/components/ui/Drawer.vue'
import UiButton from '~/components/ui/Button.vue'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const config = useRuntimeConfig()
const creditsStore = useCreditsStore()
const { balance } = storeToRefs(creditsStore)

const internalIsOpen = ref(props.isOpen)

watch(() => props.isOpen, (newVal) => {
  internalIsOpen.value = newVal
})

watch(internalIsOpen, (newVal) => {
  if (!newVal) emit('close')
})

// === Packs definition ===
const packs = [
  { id: 'pack_50', credits: 50, displayPrice: '$5.50', description: 'Perfect for a light study session' },
  { id: 'pack_120', credits: 120, displayPrice: '$10.99', description: 'Great value for focused learners' },
  { id: 'pack_300', credits: 300, displayPrice: '$21.50', description: 'Best value for power users' },
]

// === Stripe State ===
const stripe = ref<any>(null)
const elements = ref<any>(null)
const clientSecret = ref<string | null>(null)
const checkoutLoading = ref<string | null>(null)
const isPaymentProcessing = ref(false)
const paymentError = ref<string | null>(null)

onMounted(async () => {
  if (config.public.STRIPE_PUBLIC_KEY) {
    stripe.value = await loadStripe(config.public.STRIPE_PUBLIC_KEY)
  }

  if (!document.getElementById('applixir-script')) {
    const script = document.createElement('script')
    script.id = 'applixir-script'
    script.src = 'https://cdn.applixir.com/applixir.video3.0.js'
    script.async = true
    document.head.appendChild(script)
  }
})

async function initCheckout(packId: string) {
  checkoutLoading.value = packId
  paymentError.value = null

  try {
    const res = await $fetch('/api/credits/checkout', {
      method: 'POST',
      body: { packId }
    })

    clientSecret.value = (res as any).clientSecret

    setTimeout(() => {
      elements.value = stripe.value.elements({
        clientSecret: clientSecret.value,
        appearance: { theme: 'stripe' }
      })
      const paymentElement = elements.value.create('payment')
      const target = document.getElementById('payment-element')
      if (target) {
        paymentElement.mount('#payment-element')
      }
    }, 100)

  } catch (err: any) {
    console.error('Failed to init checkout', err)
    paymentError.value = err?.data?.message || err?.message || 'Failed to initialize checkout. Is Stripe configured?'
  } finally {
    checkoutLoading.value = null
  }
}

async function submitPayment() {
  if (!stripe.value || !elements.value) return

  isPaymentProcessing.value = true
  paymentError.value = null

  try {
    const { error } = await stripe.value.confirmPayment({
      elements: elements.value,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required'
    })

    if (error) {
      paymentError.value = error.message
    } else {
      clientSecret.value = null
      useToast().add({ title: 'Payment Successful', description: 'Your credits have been added.', color: 'success' })
      creditsStore.fetchBalance()
    }
  } catch (err) {
    paymentError.value = 'An unexpected error occurred.'
  } finally {
    isPaymentProcessing.value = false
  }
}

const adLoading = ref(false)
declare global { function invokeApplixirVideoUnit(opts: any): void }

function invokeAd() {
  if (typeof invokeApplixirVideoUnit !== 'function') {
    paymentError.value = 'Ad system not loaded yet.'
    return
  }
  adLoading.value = true
  try {
    invokeApplixirVideoUnit({
      zoneId: 2050,
      accountId: config.public.APPLIXIR_SITE_ID,
      siteId: config.public.APPLIXIR_SITE_ID,
      playCallback: (status: string) => { console.log('AppLixir Status', status) },
      adStatusCallback: async (status: string) => {
        adLoading.value = false
        if (status === 'ad-watched' || status === 'sys-closing') {
          try {
            await $fetch('/api/credits/ad-reward', {
              method: 'POST',
              body: { userId: 'me', sessionToken: crypto.randomUUID(), signature: 'mock' }
            })
            creditsStore.fetchBalance()
            useToast().add({ title: 'Reward Earned', description: '+1 Credit', color: 'success' })
          } catch (e) {
            console.error('Ad reward failed', e)
          }
        }
      }
    })
  } catch (err) {
    adLoading.value = false
    console.error('Failed to init ad', err)
  }
}
</script>



<template>
  <UiDrawer :show="internalIsOpen" @closed="internalIsOpen = false" side="right"
    widthClasses="w-full sm:w-[28rem] max-w-[90vw]" title="Credits Wallet" :backdrop="false" :handleVisible="0">
    <template #header>
      <div class="flex items-center gap-2 px-2 py-1">
        <UIcon name="i-heroicons-wallet" class="w-6 h-6 text-primary" />
        Wallet
      </div>
    </template>

    <div class="flex flex-col gap-6 px-2 pb-6">
      <!-- Hero Section -->
      <div
        class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/50 to-blue-500/10  border-primary/20 p-8 text-center mt-2 shadow-sm">
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-primary/90 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/90 rounded-full blur-3xl"></div>

        <p class="font-medium mb-2 relative text-white text-xl z-10">Current Balance</p>
        <div
          class="text-6xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent z-10 relative flex items-center justify-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="w-10 h-10 text-primary" />
          {{ balance }}
        </div>
      </div>

      <!-- AppLixir Section -->
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wider">Earn Free Credits</h3>
        <UButton @click="invokeAd"
          class="w-full flex items-center justify-center gap-2 hover:bg-black transition-colors">
          <UIcon v-if="adLoading" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
          <UIcon v-else name="i-heroicons-play-circle" class="w-5 h-5" />
          Watch Video (+1 Credit)
        </UButton>
        <p class="text-xs text-gray-500 text-center">Support us by watching a short ad.</p>

        <!-- AppLixir Hidden Divs -->
        <div id="applixir_vanishing_div" style="display:none;position:absolute;z-index:2000">
          <iframe id="applixir_parent" allowed="autoplay"></iframe>
        </div>
      </div>

      <div class="border-t border-gray-100 my-2"></div>

      <!-- Stripe Top-up Section -->
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wider mb-4">Top Up Credits</h3>

        <div v-if="clientSecret"
          class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm relative focus-within:ring-2 focus-within:ring-primary/50">
          <button v-if="!isPaymentProcessing"
            class="absolute top-2 right-2 z-10 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
            @click="clientSecret = null">
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
          </button>

          <div id="payment-element" class="mb-4 min-h-[250px]"></div>

          <UiButton class="w-full py-3 rounded-xl flex items-center justify-center" @click="submitPayment">
            <span v-if="isPaymentProcessing" class="flex items-center gap-2">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
              Processing...
            </span>
            <span v-else>Pay Now</span>
          </UiButton>
          <div v-if="paymentError" class="text-red-500 text-sm mt-3 text-center bg-red-50 p-2 rounded-lg">{{
            paymentError }}
          </div>
        </div>

        <div v-else class="grid grid-cols-1 gap-3">
          <div v-if="paymentError && !clientSecret"
            class="mb-2 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
            {{ paymentError }}
          </div>

          <div v-for="pack in packs" :key="pack.id" @click="initCheckout(pack.id)"
            class="relative flex items-center justify-between p-4 rounded-xl bg-white hover:border-primary/50 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer transition-all shadow-sm hover:shadow-md group">
            <div class="flex flex-col">
              <UiSubtitle class="flex items-center gap-1.5">
                {{ pack.credits }} Credits
              </UiSubtitle>
              <span class="text-xs text-gray-500">{{ pack.description }}</span>
            </div>
            <div
              class="bg-gray-100 px-3 py-1.5 rounded-lg font-medium text-sm group-hover:bg-primary group-hover:text-white transition-colors">
              {{ pack.displayPrice }}
            </div>

            <div v-if="checkoutLoading === pack.id"
              class="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </UiDrawer>
</template>