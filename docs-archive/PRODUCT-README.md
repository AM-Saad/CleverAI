

# CleverAI

AI-powered study app built with **Nuxt 3 + TypeScript**.
It lets students create **flashcards and quizzes** from any content (text, docs, YouTube transcripts), powered by multiple **LLM backends** like GPT-3.5, GPT-4o, and Gemini.

---

## ✨ Highlights

- 📂 **Organized Learning** – Create study folders with metadata and attach an AI model of choice.
- 🧠 **Smart Flashcards & Quizzes** – Automatically generated from user input.
- 🔌 **Pluggable AI Engines** – Strategy Pattern lets the app switch between OpenAI, Gemini, Claude, etc.
- 🏗️ **Scalable Architecture** – Service layer, shared contracts, and type-safe APIs.
- ⏱️ **Cost Control** – Built-in rate limiting and detailed token/cost tracking.

---

## 🛠️ Tech Stack

- **Frontend**: Nuxt 3, Vue 3, TypeScript, TailwindCSS
- **Backend**: Nuxt server routes, Prisma + MongoDB, Redis (rate limiting)
- **AI Providers**: OpenAI, Google Gemini (Claude & Mixtral planned)
- **Other**: Zod for schema validation, Strategy & Factory patterns for clean design

---

## 🚀 Why It Stands Out

- Not just “call OpenAI API” — it’s a **production-ready architecture** with cost tracking, error logging, and per-user analytics.
- Designed with **scalability in mind**: service layer, reusable composables, shared type contracts.
- Shows ability to combine **AI + frontend engineering** into a polished, user-facing product.

---

## 🔮 Roadmap

- Add more AI backends (Claude, Mixtral)
- UI dashboard for analytics & cost reports
- Budget ceilings per user/model
- Export study data (CSV, Anki)

---

## 📸 Screenshots / Demo

👉 *(Insert screenshots or deployed demo link here — recruiters love visual proof!)*

---

👉 For full technical breakdown, see `ARCHITECTURE.md`.
