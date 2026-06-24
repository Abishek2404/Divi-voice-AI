import { create } from "zustand";
import { AssistantState, AssistantStoreState } from "./types";

export const useAssistantStore = create<AssistantStoreState>((set) => ({
  state: AssistantState.DISCONNECTED,
  permissionError: null,
  serverError: null,
  isMuted: false,
  isPermissionGranted: false,

  setState: (state) => set({ state }),
  setPermissionError: (permissionError) => set({ permissionError }),
  setServerError: (serverError) => set({ serverError }),
  setMuted: (isMuted) => set({ isMuted }),
  setPermissionGranted: (isPermissionGranted) => set({ isPermissionGranted }),
  reset: () =>
    set({
      state: AssistantState.DISCONNECTED,
      permissionError: null,
      serverError: null,
      isMuted: false,
    }),
}));
