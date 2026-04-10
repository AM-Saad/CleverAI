// shared/types/ai-messages.ts
// Message contracts for AI Worker <-> Window communication
// Follows the same pattern as sw-messages.ts

import type { AI_WORKER_MESSAGE_TYPES } from "../../app/utils/constants/pwa";

// Supported AI tasks
export type AITask =
  | "summarization"
  | "question-answering"
  | "text-generation"
  | "text-to-speech"
  | "image-to-text"
  | "automatic-speech-recognition"
  | "image-text-to-text"
  | "generative"; // auto-classes generative models (Gemma 4, etc.)

// Chat message content part (multimodal)
export interface ChatContentPart {
  type: "text" | "image" | "audio";
  text?: string;
  image_url?: string;
  audio_url?: string;
}

// Chat message (follows OpenAI/Gemma format)
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}

// Generative model configuration
export interface GenerativeModelConfig {
  modelId: string;
  modelClass?: string; // e.g. "Gemma4ForConditionalGeneration" — auto-resolved if omitted
  dtype?: string; // e.g. "q4f16", "q4", "fp16", "fp32"
  device?: string; // "webgpu" | "wasm" | "cpu"
}

// Model configuration
export interface ModelConfig {
  task: AITask;
  modelId: string;
  options?: {
    quantized?: boolean;
    device?: string;
    [key: string]: unknown;
  };
}

// ---------------- Outgoing (Worker -> Window) ----------------

// Model loading lifecycle
export interface ModelLoadInitiateMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_INITIATE;
  data: {
    modelId: string;
    file: string;
    task: AITask;
  };
}

export interface ModelLoadProgressMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_PROGRESS;
  data: {
    modelId: string;
    file: string;
    progress: number; // 0-100
    loaded?: number;
    total?: number;
  };
}

export interface ModelLoadDoneMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_DONE;
  data: {
    modelId: string;
    file: string;
  };
}

export interface ModelLoadCompleteMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_COMPLETE;
  data: {
    modelId: string;
    task: AITask;
  };
}

export interface ModelLoadErrorMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.MODEL_LOAD_ERROR;
  data: {
    modelId: string;
    error: string;
  };
}

// Inference lifecycle (pipeline API)
export interface InferenceStartedMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.INFERENCE_STARTED;
  data: {
    requestId: string;
    task: AITask;
  };
}

export interface InferenceCompleteMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.INFERENCE_COMPLETE;
  data: {
    requestId: string;
    result: unknown;
  };
}

export interface InferenceErrorMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.INFERENCE_ERROR;
  data: {
    requestId: string;
    error: string;
  };
}

// Generative model lifecycle (auto-classes API)
export interface GenerationTokenMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.GENERATION_TOKEN;
  data: {
    requestId: string;
    token: string;
  };
}

export interface GenerationCompleteMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.GENERATION_COMPLETE;
  data: {
    requestId: string;
    text: string;
  };
}

export interface GenerationErrorMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.GENERATION_ERROR;
  data: {
    requestId: string;
    error: string;
  };
}

// Worker ready state
export interface WorkerReadyMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.WORKER_READY;
}

// Worker-level error (Transformers.js load failure, unhandled errors/rejections)
export interface WorkerErrorMessage {
  type: "WORKER_ERROR";
  data: {
    message: string;
    stack?: string;
  };
}

export type OutgoingAIMessage =
  | ModelLoadInitiateMessage
  | ModelLoadProgressMessage
  | ModelLoadDoneMessage
  | ModelLoadCompleteMessage
  | ModelLoadErrorMessage
  | InferenceStartedMessage
  | InferenceCompleteMessage
  | InferenceErrorMessage
  | GenerationTokenMessage
  | GenerationCompleteMessage
  | GenerationErrorMessage
  | WorkerReadyMessage
  | WorkerErrorMessage;

// ---------------- Incoming (Window -> Worker) ----------------

// Load a model (pipeline API)
export interface LoadModelMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.LOAD_MODEL;
  data: ModelConfig;
}

// Load a generative model (auto-classes API)
export interface LoadGenerativeModelMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.LOAD_GENERATIVE_MODEL;
  data: GenerativeModelConfig;
}

// Run inference (pipeline API)
export interface RunInferenceMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.RUN_INFERENCE;
  data: {
    requestId: string;
    modelId: string;
    task: AITask;
    input: unknown;
    options?: Record<string, unknown>;
  };
}

// Run generation (auto-classes API)
export interface RunGenerationMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.RUN_GENERATION;
  data: {
    requestId: string;
    modelId: string;
    messages: ChatMessage[];
    imageUrl?: string;
    audioUrl?: string;
    options?: {
      maxNewTokens?: number;
      doSample?: boolean;
      temperature?: number;
      topP?: number;
      topK?: number;
      enableThinking?: boolean;
      [key: string]: unknown;
    };
  };
}

// Unload a model
export interface UnloadModelMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.UNLOAD_MODEL;
  data: {
    modelId: string;
  };
}

// Set debug mode
export interface SetDebugMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.SET_DEBUG;
  value: boolean;
}

export type IncomingAIMessage =
  | LoadModelMessage
  | LoadGenerativeModelMessage
  | RunInferenceMessage
  | RunGenerationMessage
  | UnloadModelMessage
  | SetDebugMessage;

// Utility type guards
export function isOutgoingAIMessage(msg: unknown): msg is OutgoingAIMessage {
  return !!msg && typeof (msg as { type?: unknown }).type === "string";
}

export function isIncomingAIMessage(msg: unknown): msg is IncomingAIMessage {
  return !!msg && typeof (msg as { type?: unknown }).type === "string";
}

/**
 * Union of ALL AI Worker message types (both directions).
 * Use this when a function needs to accept any AI message
 * (e.g., the worker plugin's postMessage queue).
 */
export type AIWorkerMessage = OutgoingAIMessage | IncomingAIMessage;

