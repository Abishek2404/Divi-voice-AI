/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Must use standard enum, not const enum
export enum AssistantState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  LISTENING = "LISTENING",
  THINKING = "THINKING",
  SPEAKING = "SPEAKING"
}

export interface AssistantStoreState {
  state: AssistantState;
  permissionError: string | null;
  serverError: string | null;
  isMuted: boolean;
  isPermissionGranted: boolean;
  
  // Actions
  setState: (state: AssistantState) => void;
  setPermissionError: (error: string | null) => void;
  setServerError: (error: string | null) => void;
  setMuted: (muted: boolean) => void;
  setPermissionGranted: (granted: boolean) => void;
  reset: () => void;
}
