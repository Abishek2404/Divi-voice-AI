/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssistantState } from "../types";
import { useAssistantStore } from "../store";
import { AudioStreamer } from "./AudioStreamer";

export class LiveSessionManager {
  private socket: WebSocket | null = null;
  private audioStreamer: AudioStreamer;
  private stateChangeTimeout: NodeJS.Timeout | null = null;
  private lastInputTime: number = 0;
  private audioEmptyTimeout: NodeJS.Timeout | null = null;
  private isSpeaking: boolean = false;

  constructor() {
    this.audioStreamer = new AudioStreamer();
  }

  /**
   * Connects to the server's WebSocket, initializes audio hardware, and establishes the Live session.
   */
  public async connect(idToken?: string): Promise<void> {
    const store = useAssistantStore.getState();
    if (store.state !== AssistantState.DISCONNECTED) return;

    store.setState(AssistantState.CONNECTING);
    store.setServerError(null);

    // Warm up the speaker output AudioContext synchronously during user gesture interaction.
    // This strictly prevents browser Autoplay/Gesture detection engine from blocking our live voice speaker stream.
    try {
      this.audioStreamer.startPlayback();
    } catch (e) {
      console.warn("Failed to heat up speaker AudioContext synchronously:", e);
    }

    try {
      // 1. Request microphone permissions before establishing websocket
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone access is not available or disabled in this iframe preview environment.");
        }
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach((track) => track.stop());
        store.setPermissionGranted(true);
        store.setPermissionError(null);
      } catch (err: any) {
        store.setPermissionGranted(false);
        store.setPermissionError(err?.message || "Microphone permission denied. Divi needs microphone access to talk!");
        store.setState(AssistantState.DISCONNECTED);
        return;
      }

      // 2. Prep standard connection URL with optional ID Token for user memory lookup
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const queryParam = idToken ? `?token=${encodeURIComponent(idToken)}` : "";
      const socketUrl = `${protocol}//${host}/api/live-stream${queryParam}`;

      console.log(`Connecting Divi Live WebSocket to: ${socketUrl}`);
      this.socket = new WebSocket(socketUrl);

      // 3. Configure WebSocket events
      this.socket.onopen = () => {
        try {
          console.log("WebSocket connection connected, waiting for Gemini API acknowledgement...");
        } catch (e) {
          console.error("Error in onopen handler:", e);
        }
      };

      this.socket.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "session_ready") {
            console.log("Gemini Live acknowledgement received! Setting up microphones...");
            
            // Start audio streams
            this.audioStreamer.startPlayback();
            
            await this.audioStreamer.startRecording((base64PCM) => {
              this.sendAudioChunkToBack(base64PCM);
            });

            useAssistantStore.getState().setState(AssistantState.LISTENING);
            console.log("Divi AI is fully online and listening.");
          }

          else if (msg.type === "audio" && msg.data) {
            // Cancel thinking transitions
            this.clearThinkingTimer();
            
            // Mark speaking and feed chunk to speakers
            this.isSpeaking = true;
            useAssistantStore.getState().setState(AssistantState.SPEAKING);
            this.audioStreamer.playAudioChunk(msg.data);

            // Dynamically schedule transition back to LISTENING after audio finishes
            this.scheduleReturnToListening();
          }

          else if (msg.type === "interrupted") {
            console.log("Divi got interrupted! Stopping voice output immediately...");
            this.clearPlaybackQueue();
            this.isSpeaking = false;
            useAssistantStore.getState().setState(AssistantState.LISTENING);
          }

          else if (msg.type === "turn_complete") {
            console.log("Divi completed turn output generation.");
            // If we are currently playing back, wait until audio queue finishes
            // If nothing is playing, return to listening
          }

          else if (msg.type === "error") {
            console.error("Received server error feedback:", msg.message);
            useAssistantStore.getState().setServerError(msg.message);
            this.disconnect();
          }

        } catch (err) {
          console.error("Failed to parse incoming WebSocket frame:", err);
        }
      };

      this.socket.onclose = (event) => {
        try {
          console.log(`Server connection closed. Code: ${event.code}`);
          this.disconnect();
        } catch (e) {
          console.error("Error in onclose handler:", e);
        }
      };

      this.socket.onerror = (err) => {
        try {
          console.error("WebSocket transport error:", err);
          useAssistantStore.getState().setServerError("Unable to connect to Divi's server websocket feed.");
          this.disconnect();
        } catch (e) {
          console.error("Error in onerror handler:", e);
        }
      };

    } catch (err: any) {
      console.error("LiveSessionManager connect broke:", err);
      useAssistantStore.getState().setServerError(err?.message || "Failed to start conversation.");
      this.disconnect();
    }
  }

  /**
   * Helper to write raw user voice chunk to WebSocket
   */
  private sendAudioChunkToBack(base64PCM: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    const store = useAssistantStore.getState();
    if (store.isMuted) return;

    // Measure input activity for state transitions
    const vol = this.audioStreamer.getInputVolume();
    const now = Date.now();

    if (vol > 12) { // Speech threshold
      this.lastInputTime = now;
      
      // If we were speaking, user speech interrupts us
      if (this.isSpeaking) {
        this.clearPlaybackQueue();
        this.isSpeaking = false;
        useAssistantStore.getState().setState(AssistantState.LISTENING);
      } else if (useAssistantStore.getState().state === AssistantState.LISTENING) {
        // Highlighting that the user is actively talking
        useAssistantStore.getState().setState(AssistantState.LISTENING);
      }
    } else {
      // If user was speaking, but is now silent, transition to THINKING briefly
      if (now - this.lastInputTime > 900 && now - this.lastInputTime < 4000 && !this.isSpeaking) {
        if (useAssistantStore.getState().state === AssistantState.LISTENING) {
          useAssistantStore.getState().setState(AssistantState.THINKING);
        }
      }
    }

    try {
      this.socket.send(JSON.stringify({
        type: "audio",
        data: base64PCM
      }));
    } catch (e) {
      console.error("Failed to stream audio chunk to server:", e);
    }
  }

  /**
   * Automatically schedule return to LISTENING state when audio stream terminates.
   */
  private scheduleReturnToListening(): void {
    if (this.audioEmptyTimeout) {
      clearTimeout(this.audioEmptyTimeout);
    }

    // Since sample frames run continuously, if no new chunk arrives in 1.4s, assume speaking finished
    this.audioEmptyTimeout = setTimeout(() => {
      if (this.isSpeaking) {
        this.isSpeaking = false;
        if (useAssistantStore.getState().state === AssistantState.SPEAKING) {
          useAssistantStore.getState().setState(AssistantState.LISTENING);
        }
      }
    }, 1400);
  }

  private clearThinkingTimer(): void {
    if (this.stateChangeTimeout) {
      clearTimeout(this.stateChangeTimeout);
      this.stateChangeTimeout = null;
    }
  }

  /**
   * Stop AI audio playback instantly
   */
  private clearPlaybackQueue(): void {
    this.audioStreamer.stopPlayback();
    if (this.audioEmptyTimeout) {
      clearTimeout(this.audioEmptyTimeout);
      this.audioEmptyTimeout = null;
    }
  }

  /**
   * Tears down WebSocket session, stops hardware inputs/outputs.
   */
  public disconnect(): void {
    console.log("Disconnecting and cleaning up hardware/sessions...");
    this.clearPlaybackQueue();
    this.clearThinkingTimer();
    this.isSpeaking = false;

    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }

    this.audioStreamer.destroy();
    useAssistantStore.getState().setState(AssistantState.DISCONNECTED);
  }

  /**
   * Fetch live volume statistics for visualization
   */
  public getVolumes(): { input: number; output: number } {
    return {
      input: this.audioStreamer.getInputVolume(),
      output: this.audioStreamer.getOutputVolume()
    };
  }
}

// Single instance of LiveSessionManager to export to React hooks
export const liveSessionInstance = new LiveSessionManager();
export default liveSessionInstance;
