/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { AssistantState } from "../types";

interface BackgroundEffectsProps {
  state: AssistantState;
  volume: number;
}

export function BackgroundEffects({ state, volume }: BackgroundEffectsProps) {
  // Get glow styles based on AssistantState to make the ambient lights pulsate and respond
  const getBlobColor = () => {
    switch (state) {
      case AssistantState.CONNECTING:
        return {
          blob1: "bg-blue-600/20",
          blob2: "bg-indigo-600/20",
          glowScale: 1.1,
        };
      case AssistantState.LISTENING:
        return {
          blob1: "bg-purple-600/25",
          blob2: "bg-pink-600/20",
          glowScale: 1.2 + volume * 0.005,
        };
      case AssistantState.THINKING:
        return {
          blob1: "bg-amber-600/15",
          blob2: "bg-indigo-600/20",
          glowScale: 0.9,
        };
      case AssistantState.SPEAKING:
        return {
          blob1: "bg-fuchsia-600/30",
          blob2: "bg-cyan-500/25",
          glowScale: 1.3 + volume * 0.01,
        };
      case AssistantState.DISCONNECTED:
      default:
        return {
          blob1: "bg-purple-950/20",
          blob2: "bg-slate-900/40",
          glowScale: 0.8,
        };
    }
  };

  const { blob1, blob2, glowScale } = getBlobColor();

  return (
    <div id="bg-effects-root" className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-[#020205]">
      {/* Starry coordinates from Elegant Dark */}
      <div className="absolute top-[20%] right-[15%] w-1 h-1 bg-white/40 rounded-full shadow-[0_0_8px_#fff]"></div>
      <div className="absolute top-[60%] left-[10%] w-1 h-1 bg-purple-400/30 rounded-full"></div>
      <div className="absolute bottom-[30%] right-[25%] w-1 h-1 bg-blue-400/30 rounded-full"></div>

      {/* Immersive space canvas starry grid */}
      <div 
        id="bg-starry-grid"
        className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"
      />

      {/* Floating Blur Blob 1 */}
      <motion.div
        id="bg-glow-blob-1"
        className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-colors duration-1000 ${blob1}`}
        animate={{
          scale: glowScale,
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      {/* Floating Blur Blob 2 */}
      <motion.div
        id="bg-glow-blob-2"
        className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-colors duration-1000 ${blob2}`}
        animate={{
          scale: glowScale * 0.9,
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

export default BackgroundEffects;
