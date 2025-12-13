<script setup>
import { ref } from "vue";

definePageMeta({
  auth: false,
  title: "Upgrade to CleverAI Pro | AI-Powered Spaced Repetition Learning Platform",
});

useHead({
  meta: [
    {
      name: "description",
      content:
        "Upgrade to CleverAI Pro and unlock unlimited AI-powered spaced repetition learning, adaptive flashcards, priority support, and advanced study tools.",
    },
    {
      property: "og:title",
      content: "Upgrade to CleverAI Pro | CleverAI",
    },
    {
      property: "og:description",
      content:
        "Unlock unlimited AI-powered learning with CleverAI Pro. Access adaptive flashcards, priority support, and advanced study workflows.",
    },
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:url",
      content: "https://cleverai.app/pricing",
    },
    {
      property: "og:image",
      content: "https://cleverai.app/images/og/pricing.png",
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: "CleverAI Pro Pricing | CleverAI",
    },
    {
      name: "twitter:description",
      content:
        "Go Pro with CleverAI and get unlimited AI-powered spaced repetition, flashcards, and study tools.",
    },
    {
      name: "twitter:image",
      content: "https://cleverai.app/images/og/pricing.png",
    },
  ],
});

const upgrading = ref(false);
const selectedPlan = ref("monthly");

const plans = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$9.99",
    period: "month",
    features: [
      "Unlimited AI generations",
      "Access to all LLM models",
      "Priority support",
      "Export to PDF",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$99.99",
    period: "year",
    features: [
      "Unlimited AI generations",
      "Access to all LLM models",
      "Priority support",
      "Export to PDF",
      "Save 16% compared to monthly",
    ],
  },
];

const handleSubscribe = async () => {
  upgrading.value = true;
  try {
    // In a real implementation, this would initiate a payment flow
    // For now, we'll just simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Redirect to success page or show a success message
    const toast = useToast();
    toast.add({
      title: "Subscription in development",
      description: "This feature is not yet implemented. Check back soon!",
      color: "info",
      timeout: 5000,
    });
  } catch (error) {
    console.error("Error subscribing:", error);
  } finally {
    upgrading.value = false;
  }
};
</script>

<template>
  <main class="upgrade-page">
    <div class="container">
      <header>
        <h1 id="pricing-title">Upgrade to CleverAI Pro</h1>
        <p class="subtitle">Get unlimited access to AI-powered study tools</p>
      </header>

      <section class="plans-container" aria-labelledby="pricing-title">
        <div class="plan-toggle">
          <button :class="{ active: selectedPlan === 'monthly' }" @click="selectedPlan = 'monthly'">
            Monthly
          </button>
          <button :class="{ active: selectedPlan === 'yearly' }" @click="selectedPlan = 'yearly'">
            Yearly <span class="save-badge">Save 16%</span>
          </button>
        </div>

        <div class="plan-cards">
          <div v-for="plan in plans" :key="plan.id" class="plan-card" :class="{ active: selectedPlan === plan.id }">
            <div class="plan-header">
              <h3>{{ plan.name }}</h3>
              <div class="plan-price">
                <span class="amount">{{ plan.price }}</span>
                <span class="period">/ {{ plan.period }}</span>
              </div>
            </div>
            <div class="plan-features">
              <ul>
                <li v-for="(feature, index) in plan.features" :key="index">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {{ feature }}
                </li>
              </ul>
            </div>
            <button v-if="selectedPlan === plan.id" :disabled="upgrading" class="subscribe-button"
              @click="handleSubscribe">
              <span v-if="upgrading">
                <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Processing...
              </span>
              <span v-else>Subscribe Now</span>
            </button>
          </div>
        </div>
      </section>

      <div class="guarantees">
        <div class="guarantee-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <h4>Secure Payments</h4>
            <p>All transactions are secure and encrypted</p>
          </div>
        </div>
        <div class="guarantee-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <div>
            <h4>Cancel Anytime</h4>
            <p>No long-term contracts, cancel when you want</p>
          </div>
        </div>
        <div class="guarantee-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
          <div>
            <h4>14-Day Money Back</h4>
            <p>Not satisfied? Get a full refund</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.upgrade-page {
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 0.5rem;
}

.subtitle {
  text-align: center;
  color: #64748b;
  margin-bottom: 3rem;
  font-size: 1.25rem;
}

.plans-container {
  margin-bottom: 3rem;
}

.plan-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  background-color: #f1f5f9;
  max-width: 220px;
  margin-left: auto;
  margin-right: auto;
  border-radius: 9999px;
  padding: 0.25rem;
}

.plan-toggle button {
  padding: 0.75rem 0rem;
  width: 105px;
  border: none;
  background: transparent;
  border-radius: 9999px;
  cursor: pointer;
  position: relative;
  font-weight: 500;
}

.plan-toggle button.active {
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.save-badge {
  position: absolute;
  top: -10px;
  right: -10px;
  background-color: #16a34a;
  color: white;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  font-weight: 600;
}

.plan-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.plan-card {
  background-color: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  border: 2px solid transparent;
  opacity: 0.7;
  transition: all 0.2s;
}

.plan-card.active {
  border-color: #0ea5e9;
  opacity: 1;
}

.plan-header {
  margin-bottom: 1.5rem;
}

.plan-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.plan-price {
  display: flex;
  align-items: baseline;
}

.plan-price .amount {
  font-size: 2rem;
  font-weight: 700;
}

.plan-price .period {
  color: #64748b;
  margin-left: 0.25rem;
}

.plan-features {
  margin-bottom: 1.5rem;
  flex-grow: 1;
}

.plan-features ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.plan-features li {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}

.plan-features li svg {
  color: #16a34a;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.subscribe-button {
  background-color: #0ea5e9;
  color: white;
  font-weight: 600;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.subscribe-button:hover {
  background-color: #0284c7;
}

.subscribe-button:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.subscribe-button svg {
  margin-right: 0.5rem;
}

.guarantees {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.guarantee-item {
  display: flex;
  align-items: flex-start;
}

.guarantee-item svg {
  color: #0ea5e9;
  margin-right: 1rem;
  flex-shrink: 0;
}

.guarantee-item h4 {
  margin: 0 0 0.25rem;
  font-weight: 600;
}

.guarantee-item p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
}

@media (max-width: 640px) {
  .plan-cards {
    grid-template-columns: 1fr;
  }

  .guarantees {
    grid-template-columns: 1fr;
  }
}
</style>
