<script setup lang="ts">
import { useGenerativeAI } from "~/composables/ai/useGenerativeAI";
import type { ChatMessage } from "~/shared/types/ai-messages";

definePageMeta({ layout: "default" });

// ── State ──
const {
  ask,
  generate,
  loadModel,
  streamedText,
  completedText,
  isGenerating,
  isDownloading,
  progress,
  isReady,
  generationError,
  checkWebGPU,
  webgpuSupported,
} = useGenerativeAI();

interface Message {
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
}

const messages = ref<Message[]>([]);
const userInput = ref("");
const imageUrl = ref("");
const showImageInput = ref(false);
const chatContainer = ref<HTMLElement | null>(null);
const webgpuChecked = ref(false);
const webgpuOk = ref(false);

// Check WebGPU on mount
onMounted(async () => {
  webgpuOk.value = await checkWebGPU();
  webgpuChecked.value = true;
});

// Auto-scroll on new messages
watch(
  () => streamedText.value,
  () => {
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    });
  }
);

async function handleSend() {
  const text = userInput.value.trim();
  if (!text || isGenerating.value) return;

  // Add user message
  const userMsg: Message = {
    role: "user",
    text,
    imageUrl: imageUrl.value || undefined,
  };
  messages.value.push(userMsg);
  userInput.value = "";
  const currentImageUrl = imageUrl.value;
  imageUrl.value = "";
  showImageInput.value = false;

  // Add placeholder for assistant
  messages.value.push({ role: "assistant", text: "" });
  const assistantIdx = messages.value.length - 1;

  try {
    let result: string;

    if (currentImageUrl) {
      // Multimodal: image + text
      const chatMessages: ChatMessage[] = [
        {
          role: "user",
          content: [
            { type: "image" },
            { type: "text", text },
          ],
        },
      ];
      result = await generate(chatMessages, { imageUrl: currentImageUrl });
    } else {
      // Text only
      result = await ask(text);
    }

    messages.value[assistantIdx]!.text = result;
  } catch (err: any) {
    messages.value[assistantIdx]!.text = `❌ Error: ${err.message}`;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

async function handlePreload() {
  try {
    await loadModel();
  } catch (err: any) {
    console.error("Failed to preload model:", err);
  }
}
</script>

<template>
  <div class="ai-chat-demo">
    <div class="chat-header">
      <div class="header-left">
        <div class="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </div>
        <div>
          <h1 class="header-title">Gemma 4 Chat</h1>
          <p class="header-subtitle">Local AI · Runs in your browser via WebGPU</p>
        </div>
      </div>
      <div class="header-right">
        <span v-if="!webgpuChecked" class="status-badge status-checking">Checking...</span>
        <span v-else-if="!webgpuOk" class="status-badge status-error">WebGPU Not Supported</span>
        <span v-else-if="isReady" class="status-badge status-ready">Model Ready</span>
        <span v-else-if="isDownloading" class="status-badge status-downloading">
          Downloading {{ progress }}%
        </span>
        <button v-else class="preload-btn" :disabled="isDownloading" @click="handlePreload">
          Pre-load Model
        </button>
      </div>
    </div>

    <!-- WebGPU Error -->
    <div v-if="webgpuChecked && !webgpuOk" class="webgpu-error">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
      <div>
        <p class="error-title">WebGPU is required</p>
        <p class="error-desc">
          This demo requires a WebGPU-capable browser (Chrome 113+, Edge 113+).
          Your current browser does not support WebGPU.
        </p>
      </div>
    </div>

    <!-- Chat Messages -->
    <div v-else ref="chatContainer" class="chat-messages">
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">💬</div>
        <p class="empty-title">Start a conversation</p>
        <p class="empty-desc">
          Ask anything or attach an image URL for multimodal chat.
          The model runs entirely in your browser.
        </p>
        <div class="empty-examples">
          <button class="example-btn" @click="userInput = 'Explain how WebGPU works in 3 sentences'">
            "Explain WebGPU in 3 sentences"
          </button>
          <button class="example-btn" @click="userInput = 'Write a haiku about coding'">
            "Write a haiku about coding"
          </button>
          <button class="example-btn" @click="userInput = 'What are the benefits of local AI?'">
            "Benefits of local AI?"
          </button>
        </div>
      </div>

      <div v-for="(msg, i) in messages" :key="i" :class="['message', `message-${msg.role}`]">
        <div class="message-avatar">
          <span v-if="msg.role === 'user'">👤</span>
          <span v-else>🤖</span>
        </div>
        <div class="message-content">
          <div v-if="msg.imageUrl" class="message-image">
            <img :src="msg.imageUrl" alt="Attached image" />
          </div>
          <p v-if="msg.text" class="message-text" v-text="msg.text" />
          <!-- Streaming indicator for the last assistant message -->
          <p
            v-else-if="msg.role === 'assistant' && i === messages.length - 1 && isGenerating"
            class="message-text streaming"
            v-text="streamedText || '...'"
          />
          <p v-else-if="!msg.text" class="message-text placeholder">Thinking...</p>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="chat-input-area">
      <!-- Image URL input (togglable) -->
      <div v-if="showImageInput" class="image-input-row">
        <input
          v-model="imageUrl"
          type="url"
          placeholder="Paste image URL (https://...)"
          class="image-url-input"
        />
        <button class="icon-btn" title="Remove image" @click="showImageInput = false; imageUrl = ''">
          ✕
        </button>
      </div>

      <div class="input-row">
        <button
          class="icon-btn"
          title="Attach image URL"
          :class="{ active: showImageInput }"
          @click="showImageInput = !showImageInput"
        >
          🖼️
        </button>
        <textarea
          v-model="userInput"
          placeholder="Type a message..."
          class="chat-textarea"
          rows="1"
          :disabled="isGenerating || (webgpuChecked && !webgpuOk)"
          @keydown="handleKeydown"
        />
        <button
          class="send-btn"
          :disabled="!userInput.trim() || isGenerating || (webgpuChecked && !webgpuOk)"
          @click="handleSend"
        >
          <span v-if="isGenerating" class="sending-spinner" />
          <span v-else>↑</span>
        </button>
      </div>

      <!-- Error display -->
      <p v-if="generationError" class="gen-error">{{ generationError.message }}</p>
    </div>
  </div>
</template>

<style scoped>
.ai-chat-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* ── Header ── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border-radius: 10px;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  line-height: 1.2;
}
.header-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}

/* ── Status Badges ── */
.status-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 99px;
  font-weight: 500;
}
.status-checking { background: #f3f4f6; color: #6b7280; }
.status-ready { background: #dcfce7; color: #166534; }
.status-downloading { background: #dbeafe; color: #1e40af; }
.status-error { background: #fef2f2; color: #991b1b; }

.preload-btn {
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
}
.preload-btn:hover { background: #f9fafb; border-color: #9ca3af; }
.preload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── WebGPU Error ── */
.webgpu-error {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  margin: 20px 0;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  color: #991b1b;
}
.error-title { font-weight: 600; margin: 0 0 4px; }
.error-desc { font-size: 13px; margin: 0; color: #b91c1c; }

/* ── Chat Messages ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  gap: 8px;
  padding: 40px 20px;
}
.empty-icon { font-size: 40px; }
.empty-title { font-size: 18px; font-weight: 600; color: #111827; margin: 0; }
.empty-desc { font-size: 14px; color: #6b7280; margin: 0; max-width: 400px; }
.empty-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  justify-content: center;
}
.example-btn {
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}
.example-btn:hover { background: #f3f4f6; border-color: #6366f1; color: #4f46e5; }

/* ── Messages ── */
.message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.message-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 16px;
  flex-shrink: 0;
}
.message-user .message-avatar { background: #ede9fe; }
.message-assistant .message-avatar { background: #f0fdf4; }

.message-content {
  flex: 1;
  min-width: 0;
}
.message-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
}
.message-text.streaming {
  color: #4f46e5;
}
.message-text.placeholder {
  color: #9ca3af;
  font-style: italic;
}
.message-image {
  margin-bottom: 8px;
}
.message-image img {
  max-width: 300px;
  max-height: 200px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  object-fit: cover;
}

/* ── Input Area ── */
.chat-input-area {
  padding: 12px 0;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.image-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.image-url-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.image-url-input:focus { border-color: #6366f1; }

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.chat-textarea {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
  max-height: 120px;
  line-height: 1.5;
}
.chat-textarea:focus { border-color: #6366f1; }
.chat-textarea:disabled { background: #f9fafb; color: #9ca3af; }

.icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.15s;
  flex-shrink: 0;
}
.icon-btn:hover { background: #f3f4f6; }
.icon-btn.active { border-color: #6366f1; background: #ede9fe; }

.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  transition: all 0.15s;
  flex-shrink: 0;
}
.send-btn:hover { transform: scale(1.05); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.sending-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.gen-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: #dc2626;
}
</style>
