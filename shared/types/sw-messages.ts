// shared/types/sw-messages.ts
// Canonical service worker <-> window messaging contracts.
// IMPORT ONLY TYPES from here in runtime code to avoid bundling duplication.
// Runtime string values must come from SW_MESSAGE_TYPES in `app/utils/constants/pwa`.

import type { SW_MESSAGE_TYPES } from "../../app/utils/constants/pwa";

// Helper literal extraction for discriminated unions
type ValueOf<T> = T[keyof T];

// Modes for sync operations
export type SyncMode = "manual" | "background";

// ---------------- Outgoing (SW -> Window) ----------------
// Notes sync lifecycle
export interface NotesSyncStartedMessage {
  type: typeof SW_MESSAGE_TYPES.NOTES_SYNC_STARTED;
  data: { message: string; pendingCount: number; mode: SyncMode };
}
export interface NotesSyncedMessage {
  type: typeof SW_MESSAGE_TYPES.NOTES_SYNCED;
  data: { appliedCount: number; conflictsCount: number; mode: SyncMode };
}
export interface NotesSyncErrorMessage {
  type: typeof SW_MESSAGE_TYPES.NOTES_SYNC_ERROR;
  data?: { message?: string; mode?: SyncMode };
}
export interface NotesSyncConflictsMessage {
  type: typeof SW_MESSAGE_TYPES.NOTES_SYNC_CONFLICTS;
  data: { conflictsCount: number; mode: SyncMode };
}

// Form sync lifecycle
export interface FormSyncStartedMessage {
  type: typeof SW_MESSAGE_TYPES.FORM_SYNC_STARTED;
  data: { message: string; mode: SyncMode };
}
export interface FormSyncedMessage {
  type: typeof SW_MESSAGE_TYPES.FORM_SYNCED;
  data: { message: string; appliedCount?: number; mode?: SyncMode };
}
export interface FormSyncErrorMessage {
  type: typeof SW_MESSAGE_TYPES.FORM_SYNC_ERROR;
  data: { message: string; attemptedCount?: number; mode?: SyncMode };
}

// SW lifecycle & update
export interface SwActivatedMessage {
  type: typeof SW_MESSAGE_TYPES.SW_ACTIVATED;
  version: string;
}
export interface SwControlClaimedMessage {
  type: typeof SW_MESSAGE_TYPES.SW_CONTROL_CLAIMED;
}
export interface SwUpdateAvailableMessage {
  type: typeof SW_MESSAGE_TYPES.SW_UPDATE_AVAILABLE;
  version: string;
}

// Navigation after notification click
export interface NotificationClickNavigateMessage {
  type: typeof SW_MESSAGE_TYPES.NOTIFICATION_CLICK_NAVIGATE;
  url: string;
}

// Generic error surface from SW
export interface SwGenericErrorMessage {
  type: typeof SW_MESSAGE_TYPES.ERROR;
  data: { message: string; identifier?: string };
}

export type OutgoingSWMessage =
  | NotesSyncStartedMessage
  | NotesSyncedMessage
  | NotesSyncErrorMessage
  | NotesSyncConflictsMessage
  | FormSyncStartedMessage
  | FormSyncedMessage
  | FormSyncErrorMessage
  | SwActivatedMessage
  | SwControlClaimedMessage
  | SwUpdateAvailableMessage
  | NotificationClickNavigateMessage
  | SwGenericErrorMessage;

// ---------------- Incoming (Window -> SW) ----------------
export interface SkipWaitingMessage {
  type: typeof SW_MESSAGE_TYPES.SKIP_WAITING;
}
export interface ClaimControlMessage {
  type: typeof SW_MESSAGE_TYPES.CLAIM_CONTROL;
}
export interface SetDebugMessage {
  type: typeof SW_MESSAGE_TYPES.SET_DEBUG;
  value: boolean;
}
export interface SyncNotesMessage {
  type: typeof SW_MESSAGE_TYPES.SYNC_NOTES;
}

// (Internal test notification click trigger retained separately)
export interface TestNotificationClickMessage {
  type: typeof SW_MESSAGE_TYPES.TEST_NOTIFICATION_CLICK;
  data?: { url?: string };
}

export type IncomingSWMessage =
  | SkipWaitingMessage
  | ClaimControlMessage
  | SetDebugMessage
  | SyncNotesMessage
  | TestNotificationClickMessage;

// Public aggregate namespace
export type AnySWMessage = OutgoingSWMessage | IncomingSWMessage;
