/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { useAssistantStore } from "../store";
import { liveSessionInstance } from "../services/LiveSessionManager";
import { AssistantState } from "../types";

export function useGeminiLive() {
  const state = useAssistantStore((s) => s.state);
  const isMuted = useAssistantStore((s) => s.isMuted);
  const serverError = useAssistantStore((s) => s.serverError);
  const permissionError = useAssistantStore((s) => s.permissionError);
  const isPermissionGranted = useAssistantStore((s) => s.isPermissionGranted);
  const setMuted = useAssistantStore((s) => s.setMuted);

  const [volumes, setVolumes] = useState({ input: 0, output: 0 });

  useEffect(() => {
    let animId: number;
    const tick = () => {
      if (state !== AssistantState.DISCONNECTED) {
        setVolumes(liveSessionInstance.getVolumes());
      } else {
        setVolumes({ input: 0, output: 0 });
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [state]);

  const toggleMute = () => {
    setMuted(!isMuted);
  };

  const connect = async (idToken?: string) => {
    await liveSessionInstance.connect(idToken);
  };

  const disconnect = () => {
    liveSessionInstance.disconnect();
  };

  return {
    state,
    isMuted,
    serverError,
    permissionError,
    isPermissionGranted,
    volumes,
    toggleMute,
    connect,
    disconnect,
  };
}
