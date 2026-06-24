/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { AssistantState } from "../types";

interface VoiceWaveformProps {
  state: AssistantState;
  volumes: { input: number; output: number };
}

export function VoiceWaveform({ state, volumes }: VoiceWaveformProps) {
  const isDisconnected = state === AssistantState.DISCONNECTED;
  const isListening = state === AssistantState.LISTENING;
  const isSpeaking = state === AssistantState.SPEAKING;
  const isThinking = state === AssistantState.THINKING;

  // Total lines to draw
  const barCount = 18;

  // Select current dominant volume level
  const activeVolume = isSpeaking ? volumes.output : isListening ? volumes.input : 0;

  // Pre-generate static offsets for varied wave aesthetic
  const scaleFactors = [
    0.3, 0.5, 0.8, 1.2, 1.5, 1.8, 2.0, 1.8, 1.4, 
    1.4, 1.8, 2.0, 1.8, 1.5, 1.2, 0.8, 0.5, 0.3
  ];

  return (
    <div id="voice-waveform-root" className="flex items-end justify-center gap-1.5 h-16 w-72 px-4 relative z-10 select-none">
      {/* Visualizer Lines */}
      {Array.from({ length: barCount }).map((_, index) => {
        // Base rest size
        let height = 4;
        let color = "bg-slate-700/60";

        if (isDisconnected) {
          height = 2; // Flat lined
          color = "bg-slate-800/45";
        } else if (isThinking) {
          // Sinusoidal wave shifting for waiting state
          const phase = (index + Date.now() * 0.005) * 0.6;
          height = 6 + Math.round(18 * Math.abs(Math.sin(phase)));
          color = "bg-purple-500/60";
        } else if (isListening || isSpeaking) {
          // Double-check volume reactivity
          const scalar = scaleFactors[index] || 1;
          const amplifiedVolume = Math.min(48, activeVolume * 1.5 * scalar);
          // Set organic minimum bar size when voice activity dips
          const noise = 3 + Math.abs(Math.sin(index + Date.now() * 0.01)) * 5;
          height = noise + amplifiedVolume;

          if (isListening) {
            color = activeVolume > 10 ? "bg-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.7)]" : "bg-purple-600/55";
          } else if (isSpeaking) {
            color = activeVolume > 10 ? "bg-pink-400 drop-shadow-[0_0_4px_rgba(244,114,182,0.7)]" : "bg-pink-600/55";
          }
        } else {
          // Connected normal idle state
          const noise = 3 + Math.abs(Math.sin(index + Date.now() * 0.001)) * 4;
          height = noise;
          color = "bg-purple-700/40";
        }

        return (
          <motion.div
            key={index}
            animate={{ height }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`w-1.5 rounded-full transition-colors duration-300 ${color}`}
            style={{
              maxHeight: "64px",
            }}
          />
        );
      })}
    </div>
  );
}

export default VoiceWaveform;
