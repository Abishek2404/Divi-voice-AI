/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { AssistantState } from "../types";

interface StatusIndicatorProps {
  state: AssistantState;
  error: string | null;
}

export function StatusIndicator({ state, error }: StatusIndicatorProps) {
  const getStatusConfig = () => {
    if (error) {
      return {
        text: "Error Encountered",
        subtext: error,
        color: "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]",
        badge: "bg-red-500/10 border-red-500/20 text-red-400",
      };
    }

    switch (state) {
      case AssistantState.CONNECTING:
        return {
          text: "Waking Divi",
          subtext: "Setting up secure neural voice bridge...",
          color: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]",
          badge: "bg-blue-500/15 border-blue-500/30 text-blue-300 animate-pulse",
        };
      case AssistantState.LISTENING:
        return {
          text: "Divi is Listening",
          subtext: "Go ahead, I'm all ears. Talk to me!",
          color: "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]",
          badge: "bg-purple-500/15 border-purple-500/30 text-purple-300",
        };
      case AssistantState.THINKING:
        return {
          text: "Divi is Thinking",
          subtext: "Ooh, processing that clever thought...",
          color: "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]",
          badge: "bg-amber-500/15 border-amber-500/30 text-amber-300 animate-pulse",
        };
      case AssistantState.SPEAKING:
        return {
          text: "Divi is Speaking",
          subtext: "Charming your ears with elegant answers...",
          color: "text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.5)]",
          badge: "bg-pink-500/15 border-pink-500/30 text-pink-300",
        };
      case AssistantState.DISCONNECTED:
      default:
        return {
          text: "Divi is Offline",
          subtext: "Tap the holographic power sphere to start conversing.",
          color: "text-slate-500 drop-shadow-[0_0_4px_rgba(100,116,139,0.2)]",
          badge: "bg-slate-500/10 border-slate-500/20 text-slate-400",
        };
    }
  };

  const config = getStatusConfig();

  const getWittyQuote = () => {
    if (error) {
      return "Whoops! Looks like some technical static got in our way...";
    }
    switch (state) {
      case AssistantState.CONNECTING:
        return "Hmm... let's set up this neural voice bridge. Don't keep me waiting too long!";
      case AssistantState.LISTENING:
        return "Okay, okay... I'm listening. Go ahead, what's on your mind?";
      case AssistantState.THINKING:
        return "I could tell you the boring answer, but where's the fun in that?";
      case AssistantState.SPEAKING:
        return "That's actually a pretty smart question. I'm impressed.";
      case AssistantState.DISCONNECTED:
      default:
        return "Well, look who's back. Missed me already?";
    }
  };

  return (
    <div id="status-container" className="flex flex-col items-center text-center px-6 relative z-10 select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={state + (error ? "-err" : "-success")}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          {/* Dynamic Quote from Elegant Dark design */}
          <p className="text-pink-400 font-medium italic mb-3 tracking-wide text-xs md:text-sm max-w-md">
            "{getWittyQuote()}"
          </p>

          {/* Holographic Badge */}
          <span
            id="status-badge"
            className={`px-3 py-1 text-[10px] font-mono tracking-widest uppercase rounded-full border mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.5)] transition-all duration-300 ${config.badge}`}
          >
            {state}
          </span>

          {/* Core Title (Updated text-4xl / text-5xl matching design template) */}
          <h1
            id="status-title"
            className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-none"
          >
            {config.text}
          </h1>

          {/* Subtitle description */}
          <p
            id="status-subtext"
            className="text-xs md:text-sm font-sans text-slate-400 mt-3 max-w-sm tracking-wide leading-relaxed"
          >
            {config.subtext}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default StatusIndicator;
