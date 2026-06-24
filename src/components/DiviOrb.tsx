/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { AssistantState } from "../types";

interface DiviOrbProps {
  state: AssistantState;
  volumes: { input: number; output: number };
  onToggleConnect?: () => void;
}

export function DiviOrb({ state, volumes, onToggleConnect }: DiviOrbProps) {
  const isDisconnected = state === AssistantState.DISCONNECTED;
  const isConnecting = state === AssistantState.CONNECTING;
  const isListening = state === AssistantState.LISTENING;
  const isThinking = state === AssistantState.THINKING;
  const isSpeaking = state === AssistantState.SPEAKING;

  // Derive active amplitude for dynamic scaling
  const amplitude = isSpeaking ? volumes.output : isListening ? volumes.input : 0;
  
  // Create a high-fidelity scale offset based on volume
  const dynamicScale = 1 + (amplitude / 85) * 0.18;

  // State colors & glow gradients
  const getOrbColorTheme = () => {
    switch (state) {
      case AssistantState.CONNECTING:
        return {
          glow: "rgba(59,130,246,0.35)",  // Blue glow
          gradient: "from-blue-500 via-indigo-600 to-violet-600",
          ringColor: "stroke-blue-400",
          innerColor: "bg-blue-900/40",
        };
      case AssistantState.LISTENING:
        return {
          glow: "rgba(168,85,247,0.4)",  // Purple glow
          gradient: "from-purple-500 via-pink-400 to-indigo-600",
          ringColor: "stroke-purple-400",
          innerColor: "bg-purple-950/40",
        };
      case AssistantState.THINKING:
        return {
          glow: "rgba(245,158,11,0.35)",  // Amber glow
          gradient: "from-amber-400 via-orange-500 to-indigo-700",
          ringColor: "stroke-amber-400",
          innerColor: "bg-amber-950/30",
        };
      case AssistantState.SPEAKING:
        return {
          glow: "rgba(236,72,153,0.5)",  // Pink glow
          gradient: "from-pink-500 via-fuchsia-600 to-cyan-500",
          ringColor: "stroke-pink-400",
          innerColor: "bg-pink-950/40",
        };
      case AssistantState.DISCONNECTED:
      default:
        return {
          glow: "rgba(147,51,234,0.1)",  // Dull purple glow
          gradient: "from-slate-700 via-purple-950 to-slate-900",
          ringColor: "stroke-slate-600",
          innerColor: "bg-black/50",
        };
    }
  };

  const { glow, gradient, ringColor, innerColor } = getOrbColorTheme();

  return (
    <div id="orb-visualizer-center" className="relative flex items-center justify-center w-[460px] h-[460px] z-10 select-none">
      
      {/* Concentric outer styling rings from Elegant Dark */}
      <div className="absolute w-[440px] h-[440px] rounded-full border border-white/5 pointer-events-none animate-pulse"></div>
      <div className="absolute w-[380px] h-[380px] rounded-full border border-white/10 pointer-events-none"></div>

      {/* Dynamic outermost background aura sphere */}
      <motion.div
        className="absolute w-56 h-56 rounded-full blur-[64px]"
        animate={{
          scale: [0.95, 1.2 * dynamicScale, 0.95],
          opacity: isDisconnected ? 0.15 : [0.25, 0.5, 0.25],
        }}
        transition={{
          duration: isThinking ? 1.5 : 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          boxShadow: `0 0 100px 30px ${glow}`,
          background: `radial-gradient(circle, ${glow} 20%, transparent 80%)`,
        }}
      />

      {/* Repeating out-pulse circles for speaking peaks */}
      {isSpeaking && amplitude > 12 && (
        <motion.div
          className="absolute w-44 h-44 rounded-full border border-pink-400/40 pointer-events-none"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {isListening && amplitude > 12 && (
        <motion.div
          className="absolute w-44 h-44 rounded-full border border-purple-400/40 pointer-events-none"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      {/* Interactive Rotating Outer Orbit Ring (SVG) */}
      <svg className="absolute w-72 h-72 pointer-events-none" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bf5af2" />
            <stop offset="100%" stopColor="#ff453a" />
          </linearGradient>
        </defs>

        {/* Static Background dotted ring */}
        <circle
          cx="50"
          cy="50"
          r="42"
          className="fill-none stroke-slate-800/20"
          strokeWidth="0.5"
          strokeDasharray="2, 2"
        />

        {/* Orbit Path 1 (Slow rot) */}
        {!isDisconnected && (
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            className={`fill-none ${ringColor} opacity-25`}
            strokeWidth="0.8"
            strokeDasharray="30 20 10 40"
            animate={{ rotate: 360 }}
            transition={{
              duration: isThinking ? 8 : 15,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ originX: "50px", originY: "50px" }}
          />
        )}

        {/* Orbit Path 2 (Fast counter-rot) */}
        {!isDisconnected && (
          <motion.circle
            cx="50"
            cy="50"
            r="41"
            className={`fill-none ${ringColor} opacity-40`}
            strokeWidth="0.5"
            strokeDasharray="5 15 10 5"
            animate={{ rotate: -360 }}
            transition={{
              duration: isThinking ? 5 : 10,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ originX: "50px", originY: "50px" }}
          />
        )}
      </svg>

      {/* Core Glowing Orb */}
      <motion.div
        id="orb-holographic-core"
        onClick={onToggleConnect}
        whileHover={{
          scale: dynamicScale * 1.04,
          boxShadow: "0 0 25px rgba(168,85,247,0.4)",
        }}
        whileTap={{ scale: dynamicScale * 0.96 }}
        animate={{
          scale: dynamicScale,
        }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 22,
        }}
        className={`relative w-48 h-48 rounded-full bg-gradient-to-tr ${gradient} p-[1.5px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.2)] flex items-center justify-center cursor-pointer outline-none select-none`}
      >
        {/* Futuristic glassmorphic inner capsule */}
        <div className={`w-full h-full rounded-full ${innerColor} backdrop-blur-xl flex flex-col items-center justify-center relative overflow-hidden`}>
          
          {/* Conic shining gradient backdrop from Elegant Dark */}
          <motion.div
            className="absolute w-[150%] h-[150%] bg-[conic-gradient(from_0deg,transparent_0deg,#9333ea_90deg,transparent_180deg,#3b82f6_270deg,transparent_360deg)] opacity-30 pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />

          {/* Subtle spinning space ring inside the core */}
          {!isDisconnected && (
            <motion.div
              className={`absolute w-40 h-40 rounded-full border-t border-b border-white/5`}
              animate={{ rotate: -360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Core Breathing Sphere */}
          <motion.div
            className={`w-28 h-28 rounded-full bg-gradient-to-br ${gradient} opacity-90 relative flex items-center justify-center`}
            animate={
              isDisconnected
                ? { scale: 0.95 }
                : isConnecting
                ? { scale: [1, 1.05, 1] }
                : isListening
                ? { scale: [1, 1.08, 1] }
                : isThinking
                ? { scale: [0.95, 1.02, 0.95], rotate: [0, 90, 180, 270, 360] }
                : { scale: [1, 1.15, 1] } // Speaking
            }
            transition={{
              duration: isDisconnected ? 0 : isThinking ? 1.2 : isListening ? 2.5 : isSpeaking ? 0.6 : 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Glossy Overlay highlight */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

            {/* Neural center core */}
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
              <motion.div
                className="w-3 h-3 rounded-full bg-white"
                animate={{
                  scale: isDisconnected ? 1 : [1, 1.6, 1],
                  opacity: isDisconnected ? 0.3 : [0.7, 1, 0.7],
                }}
                transition={{
                  duration: isSpeaking ? 0.4 : 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default DiviOrb;
