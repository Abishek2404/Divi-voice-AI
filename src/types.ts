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
  voice: string;
  language: string;
  orbTheme: string;
  highParticleDensity: boolean;
  visualizationStyle: "bars" | "circular" | "linear";
  
  // Browser Agent State
  browserFrame: string | null;
  browserCurrentAction: string | null;
  
  // Actions
  setState: (state: AssistantState) => void;
  setPermissionError: (error: string | null) => void;
  setServerError: (error: string | null) => void;
  setMuted: (muted: boolean) => void;
  setPermissionGranted: (granted: boolean) => void;
  setVoice: (voice: string) => void;
  setLanguage: (lang: string) => void;
  setOrbTheme: (theme: string) => void;
  setHighParticleDensity: (dense: boolean) => void;
  setVisualizationStyle: (style: "bars" | "circular" | "linear") => void;
  setBrowserFrame: (frame: string | null) => void;
  setBrowserCurrentAction: (action: string | null) => void;
  reset: () => void;
}
