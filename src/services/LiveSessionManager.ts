/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssistantState } from "../types";
import { useAssistantStore } from "../store";
import { AudioStreamer } from "./AudioStreamer";
import { getWsUrl } from "../lib/api";

export class LiveSessionManager {
  private socket: WebSocket | null = null;
  private audioStreamer: AudioStreamer;
  private stateChangeTimeout: NodeJS.Timeout | null = null;
  private lastInputTime: number = 0;
  private audioEmptyTimeout: NodeJS.Timeout | null = null;
  private isSpeaking: boolean = false;
  private lastIdToken?: string;
  private isIntentionallyDisconnected: boolean = false;
  private reconnectAttempts: number = 0;

  constructor() {
    this.audioStreamer = new AudioStreamer();
  }

  /**
   * Connects to the server's WebSocket, initializes audio hardware, and establishes the Live session.
   */
  public async connect(idToken?: string): Promise<void> {
    const store = useAssistantStore.getState();
    if (store.state !== AssistantState.DISCONNECTED && store.state !== AssistantState.CONNECTING) return;
    
    this.isIntentionallyDisconnected = false;
    this.lastIdToken = idToken || this.lastIdToken;

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
        store.setPermissionError("Microphone permission denied. Please allow microphone access. If you are in the preview, try opening the app in a new tab.");
        store.setState(AssistantState.DISCONNECTED);
        return;
      }

      // 2. Prep standard connection URL with optional ID Token for user memory lookup
      const storeVoice = store.voice || "Kore";
      const storeLanguage = store.language || "en-US";
      const params = new URLSearchParams();
      if (idToken) params.append("token", idToken);
      params.append("voice", storeVoice);
      params.append("language", storeLanguage);
      const queryParam = `?${params.toString()}`;
      
      const socketUrl = getWsUrl(`/api/live-stream${queryParam}`);

      console.log(`Connecting Divi Live WebSocket to: ${socketUrl}`);
      this.socket = new WebSocket(socketUrl);

      // 3. Configure WebSocket events
      this.socket.onopen = () => {
        try {
          console.log("WebSocket connection connected, waiting for Gemini API acknowledgement...");
        } catch (e) {
          console.error("Error in onopen handler:", e?.message || String(e));
        }
      };

      this.socket.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "session_ready") {
            console.log("Gemini Live acknowledgement received! Setting up microphones...");
            this.reconnectAttempts = 0; // reset reconnect attempts
            
            // Start audio streams
            this.audioStreamer.startPlayback();
            
            await this.audioStreamer.startRecording((base64PCM) => {
              this.sendAudioChunkToBack(base64PCM);
            });

            useAssistantStore.getState().setState(AssistantState.LISTENING);
            console.log("Divi AI is fully online and listening.");
          }

          else if (msg.type === "audio" && msg.data) {
            (window as any).receivedAudio = true;
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

          else if (msg.type === "closed") {
            console.log("Server indicated session closed.");
            this.disconnect();
          }

          else if (msg.type === "error") {
            const errorStr = typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message);
            console.error("Received server error feedback:", errorStr);
            useAssistantStore.getState().setServerError(errorStr);
            this.disconnect();
          }

          else if (msg.type === "browser_frame") {
            useAssistantStore.getState().setBrowserFrame(msg.data);
          }
          
          else if (msg.type === "browser_action") {
            useAssistantStore.getState().setBrowserCurrentAction(msg.data);
          }

        } catch (err) {
          console.error("Failed to parse incoming WebSocket frame:", err?.message || String(err));
        }
      };

      this.socket.onclose = (event) => {
        try {
          console.log(`Server connection closed. Code: ${event.code}`);
          this.handleUnexpectedDisconnect();
        } catch (e) {
          console.error("Error in onclose handler:", e?.message || String(e));
        }
      };

      this.socket.onerror = (err) => {
        try {
          console.error("WebSocket transport error:", (err as any)?.message || String(err));
          useAssistantStore.getState().setServerError("Unable to connect to Divi's server websocket feed.");
          this.handleUnexpectedDisconnect();
        } catch (e) {
          console.error("Error in onerror handler:", e?.message || String(e));
        }
      };

    } catch (err: any) {
      console.error("LiveSessionManager connect broke:", err?.message || String(err));
      useAssistantStore.getState().setServerError(err?.message || "Failed to start conversation.");
      this.disconnect();
    }
  }

  /**
   * Helper to write raw user voice chunk to WebSocket
   */
  public sendBrowserInteraction(action: string, payload: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify({
        type: "browser_interaction",
        action,
        ...payload
      }));
    } catch (e) {
      console.error("Failed to send browser interaction:", e?.message || String(e));
    }
  }

  private sendAudioChunkToBack(base64PCM: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    const store = useAssistantStore.getState();
    if (store.isMuted) return;

    // Measure input activity for state transitions
    const vol = this.audioStreamer.getInputVolume();
    const now = Date.now();

    if (vol > 15) { // Speech threshold
      this.lastInputTime = now;
      
      if (!this.isSpeaking && useAssistantStore.getState().state === AssistantState.LISTENING) {
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
      console.error("Failed to stream audio chunk to server:", e?.message || String(e));
    }
  }

  /**
   * Automatically schedule return to LISTENING state when audio stream terminates.
   */
  private scheduleReturnToListening(): void {
    if (this.audioEmptyTimeout) {
      clearTimeout(this.audioEmptyTimeout);
    }

    const timeRemainingSeconds = this.audioStreamer.getTimeUntilPlaybackEnds();
    const waitMs = Math.max(timeRemainingSeconds * 1000 + 200, 1400); // Wait until audio finishes + 200ms padding

    this.audioEmptyTimeout = setTimeout(() => {
      if (this.isSpeaking) {
        this.isSpeaking = false;
        if (useAssistantStore.getState().state === AssistantState.SPEAKING) {
          useAssistantStore.getState().setState(AssistantState.LISTENING);
        }
      }
    }, waitMs);
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
   * Automatically attempts to reconnect if the connection dropped unexpectedly.
   */
  private handleUnexpectedDisconnect(): void {
    if (this.isIntentionallyDisconnected) return;
    
    console.log(`Unexpected disconnect. Attempting reconnect ${this.reconnectAttempts + 1}/5...`);
    this.clearPlaybackQueue();
    this.clearThinkingTimer();
    this.isSpeaking = false;
    
    if (this.socket) {
      try { this.socket.close(); } catch (e) {}
      this.socket = null;
    }
    
    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      useAssistantStore.getState().setState(AssistantState.CONNECTING);
      useAssistantStore.getState().setServerError("Connection lost. Reconnecting...");
      setTimeout(() => {
        this.connect(this.lastIdToken).catch(e => console.error("Reconnect failed:", e?.message || String(e)));
      }, 2000 * this.reconnectAttempts); // Exponential-ish backoff
    } else {
      useAssistantStore.getState().setServerError("Lost connection to server and failed to reconnect.");
      this.disconnect();
    }
  }

  /**
   * Tears down WebSocket session, stops hardware inputs/outputs.
   */
  public disconnect(): void {
    console.log("Disconnecting and cleaning up hardware/sessions...");
    this.isIntentionallyDisconnected = true;
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
