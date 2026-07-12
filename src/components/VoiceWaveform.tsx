/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { AssistantState } from "../types";

interface VoiceWaveformProps {
  state: AssistantState;
  volumes: { input: number; output: number };
  style?: "bars" | "circular" | "linear";
}

export function VoiceWaveform({ state, volumes, style = "bars" }: VoiceWaveformProps) {
  const isDisconnected = state === AssistantState.DISCONNECTED;
  const isListening = state === AssistantState.LISTENING;
  const isSpeaking = state === AssistantState.SPEAKING;
  const isThinking = state === AssistantState.THINKING;

  // Total lines to draw
  const barCount = style === "circular" ? 36 : style === "linear" ? 32 : 18;

  // Select current dominant volume level
  const activeVolume = isSpeaking ? volumes.output : isListening ? volumes.input : 0;

  // Pre-generate static offsets for varied wave aesthetic
  const scaleFactors = Array.from({ length: barCount }).map((_, i) => {
    // Create a bell curve distribution
    const x = (i / (barCount - 1)) * 2 - 1; // -1 to 1
    return Math.max(0.2, 1 - x * x) * 2;
  });

  return (
    <div id="voice-waveform-root" className={`flex items-center justify-center relative z-10 select-none ${style === "circular" ? "w-32 h-32 md:w-48 md:h-48" : `h-10 md:h-16 w-56 md:w-72 px-4 ${style === "linear" ? "gap-0.5" : "gap-1.5"} items-end`}`}>
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
          const phase = (index + Date.now() * 0.005) * (style === "circular" ? 0.3 : 0.6);
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

        if (style === "circular") {
          const angle = (index / barCount) * 360;
          return (
            <div
              key={index}
              className="absolute inset-0 flex justify-center"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <motion.div
                animate={{ height }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className={`w-1 md:w-1.5 rounded-full transition-colors duration-300 ${color} mt-[48px] md:mt-[70px]`}
                style={{
                  maxHeight: "64px",
                }}
              />
            </div>
          );
        }

        if (style === "linear") {
          return (
            <motion.div
              key={index}
              animate={{ height }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={`flex-1 transition-colors duration-300 ${color}`}
              style={{
                maxHeight: "64px",
                borderRadius: "2px",
              }}
            />
          );
        }

        // Default: bars
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
