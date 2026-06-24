/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Mic, MicOff, Power, Square } from "lucide-react";
import { AssistantState } from "../types";

interface MicButtonProps {
  state: AssistantState;
  isMuted: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
}

export function MicButton({
  state,
  isMuted,
  onConnect,
  onDisconnect,
  onToggleMute,
}: MicButtonProps) {
  const isDisconnected = state === AssistantState.DISCONNECTED;
  const isConnecting = state === AssistantState.CONNECTING;

  return (
    <div id="controls-hub" className="flex flex-col items-center gap-6 relative z-10">
      {/* Primary Connection Trigger / Call control wrapped in Elegant Dark glass capsule */}
      <div className="flex items-center gap-8 bg-white/5 backdrop-blur-xl px-8 py-3.5 rounded-[40px] border border-white/10 shadow-2xl transition-all duration-300">
        
        {/* Connection toggle button */}
        <motion.button
          id="btn-connection-toggle"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isDisconnected ? onConnect : onDisconnect}
          disabled={isConnecting}
          className={`relative w-14 h-14 rounded-full transition-all duration-300 md:cursor-pointer flex items-center justify-center ${
            isDisconnected
              ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              : "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
          }`}
          aria-label={isDisconnected ? "Connect with Divi" : "Disconnect from Divi"}
        >
          {isDisconnected ? (
            <Power className="w-5 h-5 stroke-[2.5]" />
          ) : isConnecting ? (
            <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
          ) : (
            <Square className="w-4 h-4 fill-current" />
          )}
        </motion.button>

        {/* Microphone mute toggle - matches style from Elegant Dark auxiliary slots */}
        <motion.button
          id="btn-mute-toggle"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleMute}
          disabled={isDisconnected || isConnecting}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isDisconnected || isConnecting
              ? "text-slate-600 cursor-not-allowed opacity-30"
              : isMuted
              ? "text-red-400 hover:text-red-500 hover:bg-red-500/10"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
          aria-label={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </motion.button>
      </div>

      {/* Action Helper Hints */}
      <span className="font-mono text-[10px] tracking-widest text-slate-500 uppercase select-none">
        {isDisconnected ? "TAP TO AWAKEN" : isConnecting ? "SYNCHRONIZING..." : isMuted ? "MUTED" : "LIVE CAPTURE ACTIVE"}
      </span>
    </div>
  );
}

export default MicButton;
