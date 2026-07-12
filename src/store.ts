import { create } from "zustand";
import { AssistantState, AssistantStoreState } from "./types";

export const useAssistantStore = create<AssistantStoreState>((set) => ({
  state: AssistantState.DISCONNECTED,
  permissionError: null,
  serverError: null,
  isMuted: false,
  isPermissionGranted: false,
  voice: "Kore",
  language: "en-US",
  orbTheme: "indigo",
  highParticleDensity: false,
  visualizationStyle: "bars",
  browserFrame: null,
  browserCurrentAction: null,

  setState: (state) => set({ state }),
  setPermissionError: (permissionError) => set({ permissionError }),
  setServerError: (serverError) => set({ serverError }),
  setMuted: (isMuted) => set({ isMuted }),
  setPermissionGranted: (isPermissionGranted) => set({ isPermissionGranted }),
  setVoice: (voice) => set({ voice }),
  setLanguage: (language) => set({ language }),
  setOrbTheme: (orbTheme) => set({ orbTheme }),
  setHighParticleDensity: (highParticleDensity) => set({ highParticleDensity }),
  setVisualizationStyle: (visualizationStyle) => set({ visualizationStyle }),
  setBrowserFrame: (browserFrame) => set({ browserFrame }),
  setBrowserCurrentAction: (browserCurrentAction) => set({ browserCurrentAction }),
  reset: () =>
    set({
      state: AssistantState.DISCONNECTED,
      permissionError: null,
      serverError: null,
      isMuted: false,
      browserFrame: null,
      browserCurrentAction: null,
    }),
}));
