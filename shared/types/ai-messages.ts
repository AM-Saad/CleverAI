// shared/types/ai-messages.ts
// Message contracts for AI Worker <-> Window communication
// Follows the same pattern as sw-messages.ts

import type { AI_WORKER_MESSAGE_TYPES } from "../../app/utils/constants/pwa";

// Supported AI tasks
export type AITask =
  | "summarization"
  | "question-answering"
  | "text-generation"
  | "text-to-speech";

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

// Inference lifecycle
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

// Worker ready state
export interface WorkerReadyMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.WORKER_READY;
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
  | WorkerReadyMessage;

// ---------------- Incoming (Window -> Worker) ----------------

// Load a model
export interface LoadModelMessage {
  type: typeof AI_WORKER_MESSAGE_TYPES.LOAD_MODEL;
  data: ModelConfig;
}

// Run inference
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
  | RunInferenceMessage
  | UnloadModelMessage
  | SetDebugMessage;

// Utility type guards
export function isOutgoingAIMessage(msg: unknown): msg is OutgoingAIMessage {
  return !!msg && typeof (msg as { type?: unknown }).type === "string";
}

export function isIncomingAIMessage(msg: unknown): msg is IncomingAIMessage {
  return !!msg && typeof (msg as { type?: unknown }).type === "string";
}
