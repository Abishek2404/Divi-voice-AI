/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { getApiUrl } from "./lib/api";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquareOff, 
  HelpCircle, 
  ShieldAlert, 
  Sparkles, 
  AlertTriangle, 
  Brain, 
  X, 
  LogOut, 
  MapPin, 
  Calendar, 
  Layers, 
  Compass, 
  Users, 
  Target,
  Sparkle,
  Search,
  Terminal,
  Sliders,
  Database,
  Eye,
  Info,
  Trash2,
  Edit,
  Plus,
  Check,
  Mic,
  Maximize2,
  Minimize2,
  Settings
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useGeminiLive } from "./hooks/useGeminiLive";
import { BackgroundEffects } from "./components/BackgroundEffects";
import { DiviOrb } from "./components/DiviOrb";
import { VoiceWaveform } from "./components/VoiceWaveform";
import { StatusIndicator } from "./components/StatusIndicator";
import { MicButton } from "./components/MicButton";
import { AssistantState } from "./types";
import { auth, googleAuthProvider } from "./lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User, browserPopupRedirectResolver } from "firebase/auth";
import { useVoiceSearch } from "./hooks/useVoiceSearch";
import { useAssistantStore } from "./store";

export default function App() {
  const {
    state,
    isMuted,
    serverError,
    permissionError,
    volumes,
    toggleMute,
    connect,
    disconnect,
    sendBrowserInteraction,
  } = useGeminiLive();

  const { browserFrame, browserCurrentAction, voice, setVoice, language, setLanguage, orbTheme, setOrbTheme, highParticleDensity, setHighParticleDensity, visualizationStyle, setVisualizationStyle } = useAssistantStore();
  const isDisconnected = state === AssistantState.DISCONNECTED;

  // Authentication & Memory States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [memoriesList, setMemoriesList] = useState<any[]>([]);
  const [showMemoriesModal, setShowMemoriesModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Debugger Panel States
  const [debugSearchQuery, setDebugSearchQuery] = useState<string>("");
  const [debugSearchResults, setDebugSearchResults] = useState<any[]>([]);
  const [isDebugSearchLoading, setIsDebugSearchLoading] = useState<boolean>(false);
  
  const [debugInspectId, setDebugInspectId] = useState<string>("");
  const [debugInspectResult, setDebugInspectResult] = useState<any | null>(null);
  const [isDebugInspectLoading, setIsDebugInspectLoading] = useState<boolean>(false);
  
  const [debugPromptPreview, setDebugPromptPreview] = useState<string>("");
  const [isDebugPromptLoading, setIsDebugPromptLoading] = useState<boolean>(false);

  // Manual Memory Management States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newKey, setNewKey] = useState<string>("");
  const [newValue, setNewValue] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("fact");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string>("");
  const [editingValue, setEditingValue] = useState<string>("");
  const [editingCategory, setEditingCategory] = useState<string>("fact");
  const [isEditingSaving, setIsEditingSaving] = useState<boolean>(false);

  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Mobile virtual keyboard typing helper text
  const [mobileInputText, setMobileInputText] = useState<string>("");
  const [isBrowserFullView, setIsBrowserFullView] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<"split" | "divi" | "workspace">("split");

  // Voice Search setup
  const { isListening: isVoiceSearchListening, isSupported: isVoiceSearchSupported, toggleListening: toggleVoiceSearch } = useVoiceSearch((text) => {
    setSearchQuery(text);
  });

  const handleCreateMemory = async () => {
    if (!newKey.trim() || !newValue.trim() || !idToken) return;
    setIsCreating(true);
    setMemoryError(null);
    try {
      const response = await fetch(getApiUrl("/api/memories"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          key: newKey,
          value: newValue,
          type: newCategory
        })
      });
      const data = await response.json();
      if (data.success) {
        setNewKey("");
        setNewValue("");
        await loadUserMemories(idToken);
      } else {
        setMemoryError(data.error || "Failed to create memory");
      }
    } catch (e: any) {
      console.error("Create memory failed:", e?.message || String(e));
      setMemoryError("Create memory failed due to a network or server error.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateMemory = async (id: string) => {
    if (!editingKey.trim() || !editingValue.trim() || !idToken) return;
    setIsEditingSaving(true);
    setMemoryError(null);
    try {
      const response = await fetch(getApiUrl(`/api/memories/${id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          key: editingKey,
          value: editingValue,
          type: editingCategory
        })
      });
      const data = await response.json();
      if (data.success) {
        setEditingId(null);
        await loadUserMemories(idToken);
      } else {
        setMemoryError(data.error || "Failed to update memory");
      }
    } catch (e: any) {
      console.error("Update memory failed:", e?.message || String(e));
      setMemoryError("Update memory failed due to a network or server error.");
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!idToken) return;
    setMemoryError(null);
    try {
      const response = await fetch(getApiUrl(`/api/memories/${id}`), {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await response.json();
      if (data.success) {
        await loadUserMemories(idToken);
      } else {
        setMemoryError(data.error || "Failed to delete memory");
      }
    } catch (e: any) {
      console.error("Delete memory failed:", e?.message || String(e));
      setMemoryError("Delete memory failed due to a network or server error.");
    }
  };

  const runDebugSearch = async () => {
    if (!debugSearchQuery.trim() || !idToken) return;
    setIsDebugSearchLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/memories/search"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ query: debugSearchQuery, limit: 5 })
      });
      const data = await res.json();
      if (data.success && data.results) {
        setDebugSearchResults(data.results);
      }
    } catch (e) {
      console.warn("Memory Search Tester failed:", e);
    } finally {
      setIsDebugSearchLoading(false);
    }
  };

  const runDebugInspect = async (idOfMemory?: string | number) => {
    const targetId = idOfMemory || debugInspectId;
    if (!targetId || !idToken) return;
    setIsDebugInspectLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/memories/inspector/${targetId}`), {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.success && data.memory) {
        setDebugInspectResult(data.memory);
        if (!idOfMemory) {
          setDebugInspectId(String(targetId));
        }
      } else {
        setDebugInspectResult({ error: data.error || "Not found" });
      }
    } catch (e: any) {
      setDebugInspectResult({ error: e.message || "Request failed" });
    } finally {
      setIsDebugInspectLoading(false);
    }
  };

  const runDebugPromptFetch = async () => {
    if (!idToken) return;
    setIsDebugPromptLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/memories/debug-prompt"), {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.success && data.promptBlock) {
        setDebugPromptPreview(data.promptBlock);
      }
    } catch (e) {
      console.warn("Memory prompt block dynamic fetch failed:", e);
    } finally {
      setIsDebugPromptLoading(false);
    }
  };

  // Authenticate user state observer
  useEffect(() => {
    // Check if there is a cached demo session on mount
    const cachedUserJson = localStorage.getItem("divi_demo_user");
    const cachedToken = localStorage.getItem("divi_demo_token");
    if (cachedUserJson && cachedToken) {
      const parsed = JSON.parse(cachedUserJson);
      setCurrentUser(parsed);
      setIdToken(cachedToken);
      loadUserMemories(cachedToken);
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      // If we currently have a demo session, ignore Firebase auth changes until user signs out
      if (localStorage.getItem("divi_demo_user")) {
        return;
      }
      setCurrentUser(user);
      if (user) {
        setIsSyncing(true);
        try {
          const tokenStr = await user.getIdToken();
          setIdToken(tokenStr);

          // Synchronize user profile database record in MongoDB
          await fetch(getApiUrl("/api/auth/sync"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${tokenStr}`
            }
          });

          // Fetch user recollections from Postgres
          await loadUserMemories(tokenStr);
        } catch (err) {
          console.error("Critical Profile sync error:", err?.message || String(err));
        } finally {
          setIsSyncing(false);
        }
      } else {
        setIdToken(null);
        setMemoriesList([]);
      }
    });
  }, []);

  // Fetch the stored memory items from cloud REST APIs
  const loadUserMemories = async (tokenStr: string) => {
    try {
      const response = await fetch(getApiUrl("/api/memories"), {
        headers: {
          "Authorization": `Bearer ${tokenStr}`
        }
      });
      const data = await response.json();
      if (data.success && data.memories) {
        setMemoriesList(data.memories);
      }
    } catch (e) {
      console.warn("Unable to load recollects list:", e);
    }
  };

  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      setAuthError(null);
      await signInWithPopup(auth, googleAuthProvider, browserPopupRedirectResolver);
    } catch (err: any) {
      console.error("Popup Sign in rejected:", err?.message || String(err));
      if (err.code === "auth/popup-blocked") {
        setAuthError("Sign-in popup was blocked by your browser. Please allow popups or click 'Open App' in the top right to open in a new tab.");
      } else if (err.code === "auth/unauthorized-domain") {
        setAuthError(`Domain not authorized. Please add "${window.location.hostname}" to Firebase Console > Authentication > Settings > Authorized domains.`);
      } else if (err.code === "auth/cancelled-popup-request") {
        setAuthError("Sign in was cancelled. Please try again.");
      } else {
        setAuthError(err.message || "Failed to sign in. Check console for details.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoLogin = async () => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      setAuthError(null);
      
      const demoUser = {
        uid: "demo-user-123",
        email: "demo@divi.com",
        displayName: "Demo Explorer",
        emailVerified: true,
      };
      const demoToken = `demo_demo-user-123_demo@divi.com`;

      localStorage.setItem("divi_demo_user", JSON.stringify(demoUser));
      localStorage.setItem("divi_demo_token", demoToken);
      
      setCurrentUser(demoUser as any);
      setIdToken(demoToken);

      setIsSyncing(true);
      try {
        await fetch(getApiUrl("/api/auth/sync"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${demoToken}`
          }
        });
        await loadUserMemories(demoToken);
      } catch (err) {
        console.error("Critical Profile sync error:", err?.message || String(err));
      } finally {
        setIsSyncing(false);
      }
    } catch (e: any) {
      setAuthError(e.message || "Failed to activate Demo sandbox mode.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (idToken?.startsWith("demo_")) {
        setCurrentUser(null);
        setIdToken(null);
        localStorage.removeItem("divi_demo_user");
        localStorage.removeItem("divi_demo_token");
      } else {
        await signOut(auth);
      }
      setShowMemoriesModal(false);
    } catch (err) {
      console.error("Failed to disconnect Google Account session:", err?.message || String(err));
    }
  };

  // Filter memories by tab categories and search query
  const filteredMemories = memoriesList.filter((m) => {
    const matchesCategory = activeTab === "all" || m.type === activeTab;
    const matchesSearch = searchQuery.trim() === "" || 
      (m.key && m.key.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.value && m.value.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.type && m.type.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Calculate distribution of memory importance scores (1-10)
  const scoreDistribution = Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    const count = memoriesList.filter(m => Number(m.importance) === score).length;
    return { score, count };
  });

  // Category counts helpers
  const getCategoryCount = (type: string) => {
    if (type === "debugger") return "Dev";
    if (type === "all") return memoriesList.length;
    return memoriesList.filter(m => m.type === type).length;
  };

  return (
    <div
      id="divi-dashboard-root"
      className="min-h-screen bg-[#020205] text-slate-200 flex flex-col justify-between overflow-hidden relative font-sans select-none"
    >
      {/* 1. Futuristic Space Particles and Swirling Ambient Glow Blocks */}
      <BackgroundEffects state={state} volume={volumes.output || volumes.input} />

      {/* 2. Top Navigation Bar / Branding & Auth Container */}
      <header
        id="divi-header"
        className="w-full px-6 md:px-12 py-6 flex items-center justify-between bg-transparent relative z-20"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <img
              src="/divi_logo.png"
              alt="DIVI AI Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            DIVI
          </span>
        </div>

        {/* Auth status or sign in widget */}
        <div className="flex items-center gap-4">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {/* Glowing Memory Vault Trigger */}
              <button
                id="memory-vault-btn"
                onClick={() => {
                  if (idToken) loadUserMemories(idToken);
                  setShowMemoriesModal(true);
                }}
                className="p-2 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all flex items-center justify-center cursor-pointer active:scale-95 relative"
                title="Memory Vault"
              >
                <Brain className="w-4 h-4 text-indigo-400 rotate-6 animate-pulse" />
                {memoriesList.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {memoriesList.length}
                  </span>
                )}
              </button>

              <div className="flex items-center justify-center p-1 rounded-full bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors" title="Profile">
                <img
                  src={currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                  alt="avatar"
                  className="w-7 h-7 rounded-full border border-white/10"
                  referrerPolicy="no-referrer"
                />
              </div>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 rounded-full bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer flex items-center justify-center"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDemoLogin}
                  disabled={isLoggingIn}
                  className={`px-3 py-2 rounded-xl text-[11px] font-medium border border-white/10 text-slate-300 hover:bg-white/5 transition-all duration-300 transform active:scale-95 z-20 ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title="If Google popup is blocked or unauthorized, use Sandbox mode instantly"
                >
                  Demo Mode
                </button>
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-950 hover:bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.25)] transition-all duration-300 transform active:scale-95 z-20 ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isLoggingIn ? 'Signing In...' : 'Sign In with Google'}
                </button>
              </div>
              {authError && (
                <div className="absolute top-16 right-6 z-50 max-w-xs bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-3 py-2 rounded-lg backdrop-blur-md shadow-lg flex flex-col gap-1">
                  <div>{authError}</div>
                  <button 
                    onClick={handleDemoLogin}
                    className="text-[10px] text-left text-slate-300 underline hover:text-white mt-1 cursor-pointer"
                  >
                    👉 Bypass and Sign in with Sandbox Demo Account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Immersive Layout Mode Segmented Controller */}
      {browserFrame && (
        <div className="hidden md:flex justify-center mb-2 mt-1 relative z-20">
          <div className="bg-black/60 border border-white/10 p-1 rounded-2xl flex items-center gap-1 backdrop-blur-md shadow-xl">
            <button
              onClick={() => {
                setIsBrowserFullView(false);
                setLayoutMode("divi");
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                !isBrowserFullView && layoutMode === "divi"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Immersive Divi
            </button>
            <button
              onClick={() => {
                setIsBrowserFullView(false);
                setLayoutMode("split");
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                !isBrowserFullView && layoutMode === "split"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => {
                setIsBrowserFullView(true);
                setLayoutMode("workspace");
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                isBrowserFullView
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Full Workspace
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Center Stage Container */}
      <main
        id="divi-centerstage"
        className={`flex-1 flex items-center justify-center relative z-10 px-4 md:px-8 transition-all duration-500 ${
          isBrowserFullView ? "flex-col w-full max-w-full" : "flex-col md:flex-row gap-4 md:gap-12"
        }`}
      >
        {layoutMode !== "workspace" && (
          <div className="flex flex-col items-center justify-center gap-2 md:gap-4 relative shrink-0 m-0 p-0">
            
            {/* Central Holographic Sphere Avatar */}
            <DiviOrb
              state={state}
              volumes={volumes}
              onToggleConnect={() => {
                if (isDisconnected) {
                  connect(idToken || undefined);
                } else {
                  disconnect();
                }
              }}
            />

            {/* Sound waves frequency visualizer spectrum */}
            <VoiceWaveform state={state} volumes={volumes} style={visualizationStyle} />

          </div>
        )}

        {/* Floating Browser Panel */}
        {browserFrame && layoutMode !== "divi" && (
          <div className={`hidden md:flex relative bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex-col backdrop-blur-md transition-all duration-500 ease-in-out ${
            isBrowserFullView 
              ? "w-full max-w-full md:max-w-5xl lg:max-w-6xl xl:max-w-7xl z-30 ring-4 ring-indigo-500/15" 
              : "w-full max-w-2xl"
          }`}>
            <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
              {/* Left Side: Dot Buttons & Label */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                </div>
                <span className="ml-2 text-xs font-mono text-slate-300 whitespace-nowrap">Divi Workspace</span>
              </div>

              {/* Center Controls: Voice Status, Mute Button, Connect/Disconnect Actions */}
              <div className="flex items-center gap-2 md:gap-3 flex-1 justify-center min-w-[200px]">
                {/* Micro Status Indicator Badge */}
                <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-white/5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    state === AssistantState.DISCONNECTED ? "bg-slate-500" :
                    state === AssistantState.CONNECTING ? "bg-blue-400 animate-pulse" :
                    state === AssistantState.LISTENING ? "bg-purple-400 animate-ping" :
                    state === AssistantState.THINKING ? "bg-amber-400 animate-pulse" :
                    "bg-pink-400 animate-bounce"
                  }`}></span>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                    {state}
                  </span>
                </div>

                {/* Micro Action Buttons */}
                <div className="flex items-center gap-1">
                  {isDisconnected ? (
                    <div className="flex items-center gap-2">
                      <select 
                        value={voice}
                        onChange={(e) => setVoice(e.target.value)}
                        className="bg-black/30 border border-white/10 text-slate-300 text-[10px] rounded px-1.5 py-1 outline-none cursor-pointer"
                        title="Select Voice"
                      >
                        <option value="Kore">Kore (Female)</option>
                        <option value="Zephyr">Zephyr (Female)</option>
                        <option value="Puck">Puck (Male)</option>
                        <option value="Charon">Charon (Male)</option>
                        <option value="Fenrir">Fenrir (Male)</option>
                      </select>
                      <select 
                        value={["en-US", "es-ES", "fr-FR", "de-DE", "ja-JP", "ta-IN"].includes(language) ? language : "custom"}
                        onChange={(e) => {
                          if (e.target.value !== "custom") setLanguage(e.target.value);
                          else setLanguage("ta-IN"); // default to something if custom is picked initially, but we can let modal handle manual entry better. Actually, for toolbar let's just add Tamil, and keep it simple. If they picked custom in settings, it will say "Custom".
                        }}
                        className="bg-black/30 border border-white/10 text-slate-300 text-[10px] rounded px-1.5 py-1 outline-none cursor-pointer"
                        title="Select Language"
                      >
                        <option value="en-US">English</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                        <option value="ja-JP">Japanese</option>
                        <option value="ta-IN">Tamil</option>
                        {!["en-US", "es-ES", "fr-FR", "de-DE", "ja-JP", "ta-IN"].includes(language) && (
                          <option value="custom">{language}</option>
                        )}
                      </select>
                      <button
                        onClick={() => connect(idToken || undefined)}
                        className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-indigo-500/10 active:scale-95"
                        title="Wake Divi Voice Session"
                      >
                        Wake Voice
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Micro Mute Trigger */}
                      <button
                        onClick={toggleMute}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isMuted
                            ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
                            : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                      >
                        {isMuted ? <MessageSquareOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      </button>
                      
                      {/* Disconnect Voice Bridge */}
                      <button
                        onClick={disconnect}
                        className="px-2 py-1 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-400 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                        title="Disconnect Voice bridge session"
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right Side: Current Action Overlay and Maximize/Minimize Full View Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                {browserCurrentAction && (
                  <div className="hidden sm:block text-[10px] uppercase tracking-wider font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
                    {browserCurrentAction}
                  </div>
                )}

                <button
                  onClick={() => {
                    const nextVal = !isBrowserFullView;
                    setIsBrowserFullView(nextVal);
                    setLayoutMode(nextVal ? "workspace" : "split");
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                  title={isBrowserFullView ? "Collapse to standard panel layout" : "Expand browser workspace to full view"}
                >
                  {isBrowserFullView ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div 
              className="relative aspect-video bg-black/60 w-full overflow-hidden cursor-crosshair outline-none"
              tabIndex={0}
              onMouseDown={(e) => {
                e.currentTarget.focus();
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width * 1280;
                const y = (e.clientY - rect.top) / rect.height * 720;
                sendBrowserInteraction("mousedown", { x, y });
              }}
              onMouseMove={(e) => {
                // Only send mousemove if a button is pressed (dragging) to save bandwidth
                if (e.buttons > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width * 1280;
                  const y = (e.clientY - rect.top) / rect.height * 720;
                  sendBrowserInteraction("mousemove", { x, y });
                }
              }}
              onMouseUp={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width * 1280;
                const y = (e.clientY - rect.top) / rect.height * 720;
                sendBrowserInteraction("mouseup", { x, y });
              }}
              onClick={(e) => {
                // Keep click for simple tapping, though down/up often suffices
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width * 1280;
                const y = (e.clientY - rect.top) / rect.height * 720;
                sendBrowserInteraction("click", { x, y });
              }}
              onTouchStart={(e) => {
                e.currentTarget.focus();
                if (e.touches.length > 0) {
                  const touch = e.touches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (touch.clientX - rect.left) / rect.width * 1280;
                  const y = (touch.clientY - rect.top) / rect.height * 720;
                  sendBrowserInteraction("mousedown", { x, y });
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length > 0) {
                  const touch = e.touches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (touch.clientX - rect.left) / rect.width * 1280;
                  const y = (touch.clientY - rect.top) / rect.height * 720;
                  sendBrowserInteraction("mousemove", { x, y });
                }
              }}
              onTouchEnd={(e) => {
                if (e.changedTouches.length > 0) {
                  const touch = e.changedTouches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (touch.clientX - rect.left) / rect.width * 1280;
                  const y = (touch.clientY - rect.top) / rect.height * 720;
                  sendBrowserInteraction("mouseup", { x, y });
                  sendBrowserInteraction("click", { x, y });
                }
              }}
              onWheel={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width * 1280;
                const y = (e.clientY - rect.top) / rect.height * 720;
                sendBrowserInteraction("wheel", { deltaX: e.deltaX, deltaY: e.deltaY, x, y });
              }}
              onKeyDown={(e) => {
                // Prevent default scrolling for certain keys
                if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
                  e.preventDefault();
                }
                sendBrowserInteraction("keydown", { key: e.key });
              }}
            >
              <img 
                src={`data:image/jpeg;base64,${browserFrame}`} 
                alt="Browser Stream"
                className="w-full h-full object-contain pointer-events-none"
              />
              <div className="absolute inset-0 border border-white/5 pointer-events-none"></div>
            </div>

            {/* Mobile Keyboard Sync Bar / Mobile Input Helper */}
            <div className="bg-slate-900/90 border-t border-white/10 px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={mobileInputText}
                  onChange={(e) => setMobileInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (mobileInputText) {
                        sendBrowserInteraction("type", { text: mobileInputText });
                        setMobileInputText("");
                      } else {
                        sendBrowserInteraction("keydown", { key: "Enter" });
                      }
                    } else if (e.key === "Backspace" && mobileInputText === "") {
                      sendBrowserInteraction("keydown", { key: "Backspace" });
                    }
                  }}
                  placeholder="Mobile users: Type here to input text..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={() => {
                    if (mobileInputText) {
                      sendBrowserInteraction("type", { text: mobileInputText });
                      setMobileInputText("");
                    }
                  }}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  Type Text
                </button>
              </div>

              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => sendBrowserInteraction("keydown", { key: "Backspace" })}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  title="Backspace"
                >
                  ⌫
                </button>
                <button
                  onClick={() => sendBrowserInteraction("keydown", { key: "Enter" })}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  title="Enter"
                >
                  ↵
                </button>
                <button
                  onClick={() => sendBrowserInteraction("keydown", { key: "Tab" })}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  title="Tab"
                >
                  ⇥
                </button>
                <div className="w-px h-5 bg-white/10 mx-1 self-center"></div>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => sendBrowserInteraction("keydown", { key: "ArrowLeft" })}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Left"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => sendBrowserInteraction("keydown", { key: "ArrowUp" })}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => sendBrowserInteraction("keydown", { key: "ArrowDown" })}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => sendBrowserInteraction("keydown", { key: "ArrowRight" })}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Right"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. Controls, Logs, Warnings & Bottom Control Hub */}
      <footer
        id="divi-controls-panel"
        className="w-full flex flex-col items-center justify-end pb-6 md:pb-12 gap-4 md:gap-8 relative z-10 bg-gradient-to-t from-black via-black/95 to-transparent"
      >
        {/* Connection, hardware error banners */}
        <AnimatePresence>
          {(permissionError || serverError) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="max-w-md mx-6 bg-red-950/25 border border-red-500/20 backdrop-blur-xl rounded-2xl p-4 flex gap-3 shadow-[0_4px_30px_rgba(239,68,68,0.1)]"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-left">
                <span className="text-sm font-sans font-semibold text-red-200">
                  Connection Obstacle
                </span>
                <p className="text-xs text-red-300 leading-relaxed font-sans">
                  {permissionError || serverError}
                </p>
                {serverError && serverError.includes("GEMINI_API_KEY") && (
                  <p className="text-[10px] text-red-400 font-mono mt-1 leading-snug">
                    Tip: Configure your Google Gemini API Key in the **Secrets/Settings** panel of the workspace to activate voice streaming.
                  </p>
                )}
                {permissionError && (
                  <p className="text-[10px] text-red-400 font-mono mt-1 leading-snug">
                    Tip: If you are in the AI Studio preview, please open the app in a new tab or click the lock icon in the URL bar to allow microphone access.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* State Indicators (Badges, descriptions) */}
        <StatusIndicator state={state} error={permissionError || serverError} />

        {/* Floating action buttons (Connection triggers, Mute, Disconnect) */}
        <MicButton
          state={state}
          isMuted={isMuted}
          onConnect={() => connect(idToken || undefined)}
          onDisconnect={disconnect}
          onToggleMute={toggleMute}
        />



        {/* Absolute corner specs from Elegant Design */}
        <div className="absolute bottom-6 right-6 hidden md:flex items-center gap-3 text-[10px] text-slate-600 font-mono">
          <div className="px-2 py-1 rounded bg-white/5 border border-white/5">V 3.0 (Durable Memory)</div>
          <div className="px-2 py-1 rounded bg-white/5 border border-white/5">DB: CLOUD SQL ASIA-SE1</div>
        </div>
      </footer>

      {/* Floating Holographic Memory Vault Panel */}
      <AnimatePresence>
        {showMemoriesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal Backdrop with Ambient Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMemoriesModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            ></motion.div>

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, filter: "blur(12px)", y: 40, rotateX: 15 }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)", y: -20, rotateX: -10 }}
              transition={{ type: "spring", damping: 20, stiffness: 100, duration: 0.5 }}
              className="relative w-full max-w-4xl h-[85vh] bg-[#090911]/90 border border-slate-800 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col"
            >
              {/* Dynamic decorative light leak */}
              <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

              {/* Close Button / Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-md font-semibold text-slate-100 flex items-center gap-1.5">
                      Divi Memory Vault 
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
                    </h2>
                    <p className="text-[10px] text-slate-500 font-mono">Durable recollections indexed inside asia-southeast1 MongoDB</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowMemoriesModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Inner Structure */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 border-r border-white/5 bg-black/20 p-4 space-y-1.5 shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1 md:gap-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 hidden md:block">Categories</span>
                  {[
                    { id: "all", label: "All Index", icon: Layers },
                    { id: "identity", label: "Identity Profile", icon: Calendar },
                    { id: "preference", label: "Preferences & Likes", icon: Compass },
                    { id: "project", label: "Projects & Dev Work", icon: Sparkles },
                    { id: "relationship", label: "Friends & Family", icon: Users },
                    { id: "goal", label: "Goals & Dreams", icon: Target },
                    { id: "fact", label: "Factual Milestones", icon: Sparkle },
                    { id: "debugger", label: "Memory Debugger", icon: Sliders }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer shrink-0 ${
                        activeTab === tab.id
                          ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-200"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <tab.icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? "text-indigo-400" : "text-slate-500"}`} />
                      <span className="truncate">{tab.label}</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-slate-500 font-mono">
                        {getCategoryCount(tab.id)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Main Content Pane */}
                <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-black/10">
                  {activeTab === "debugger" ? (
                    <div className="space-y-6 text-left">
                      {/* Sub-Header */}
                      <div className="p-4 bg-indigo-950/15 border border-indigo-500/25 rounded-2xl flex items-start gap-3">
                        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-semibold text-indigo-300">Cognitive Memory Debugging Panel</h4>
                          <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                            Use these built-in utilities to inspect vector databases, verify semantic search queries, and preview context prompts injected live during calls.
                          </p>
                        </div>
                      </div>

                      {/* 1. Memory Search Tester & Retrieval Tester in 2 columns */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Memory Search Tester (Semantic Cosine Distance) */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-4">
                          <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-[#a855f7]" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Memory Search Tester</h3>
                          </div>
                          <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                            Simulate vector embedding querying. Executes real-time cosine distance sorting on MongoDB database records.
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={debugSearchQuery}
                              onChange={(e) => setDebugSearchQuery(e.target.value)}
                              placeholder="Type a test phrase (e.g. food, name)..."
                              className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50"
                              onKeyDown={(e) => e.key === "Enter" && runDebugSearch()}
                            />
                            <button
                              onClick={runDebugSearch}
                              disabled={isDebugSearchLoading}
                              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              {isDebugSearchLoading ? "Searching..." : "Test Search"}
                            </button>
                          </div>

                          {debugSearchResults.length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic p-2 border border-dashed border-white/5 rounded-xl text-center">
                              No test search results yet. Type a query above.
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {debugSearchResults.map((r, idx) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-white/[0.01] border border-white/[0.02] flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-all">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] font-mono uppercase bg-white/5 text-purple-400 px-1 hover:bg-white/10 rounded">ID {r.id}</span>
                                      <span className="text-[9px] font-mono uppercase text-slate-500">{r.type}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 font-medium truncate mt-0.5">{r.value}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[10px] font-mono text-indigo-400 font-bold">
                                      Dist: {typeof r.distance === "number" ? r.distance.toFixed(4) : r.distance}
                                    </span>
                                    <button 
                                      onClick={() => runDebugInspect(r.id)}
                                      className="block text-[8px] text-slate-500 hover:text-slate-300 underline mt-0.5 cursor-pointer"
                                    >
                                      Inspect Vector
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Memory Retrieval Tester (Exact Injected System Prompt Block) */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-4 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-[#ec4899]" />
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Memory Retrieval Tester</h3>
                            </div>
                            <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                              Inspect the actual text-formatted memory context block that gets dynamically generated, prioritized by importance scores, and injected into the Live API prompt on every connection.
                            </p>
                            <button
                              onClick={runDebugPromptFetch}
                              disabled={isDebugPromptLoading}
                              className="w-full py-2.5 rounded-xl bg-pink-600/10 hover:bg-pink-600/20 text-pink-300 border border-pink-500/20 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isDebugPromptLoading ? "Retrieving Context Block..." : "Retrieve Prompt Mockup"}
                            </button>
                          </div>

                          {debugPromptPreview ? (
                            <div className="bg-black/40 border border-white/5 rounded-xl p-3 font-mono text-[9px] text-slate-400 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-left">
                              {debugPromptPreview}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 italic p-3 border border-dashed border-white/5 rounded-xl text-center mt-2">
                              Prompt context has not been retrieved yet. Click button above to preview.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Memory Inspector (Embeddings inspecter) */}
                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4 text-indigo-400" />
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Memory Record Inspector</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="Memory ID"
                                value={debugInspectId}
                                onChange={(e) => setDebugInspectId(e.target.value)}
                                className="w-24 bg-black/40 border border-white/5 rounded-xl px-2.5 py-1 text-xs text-slate-200 outline-none font-mono focus:border-indigo-500/50"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    runDebugInspect();
                                  }
                                }}
                              />
                              <button
                                onClick={() => runDebugInspect()}
                                disabled={isDebugInspectLoading}
                                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isDebugInspectLoading ? "Inspecting..." : "Inspect"}
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                            Interrogate a specific database record to pull up detailed properties, including raw pgvector coordinates generated by the <code className="font-mono text-slate-400 bg-white/5 px-1 rounded">gemini-embedding-2-preview</code> model.
                          </p>

                          {debugInspectResult ? (
                            <div className="space-y-3">
                              <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-[10px] text-slate-400 space-y-2 text-left">
                                <div className="grid grid-cols-3 gap-1 border-b border-white/5 pb-2">
                                  <span className="text-slate-500">DATABASE ID:</span>
                                  <span className="col-span-2 text-indigo-300 font-bold">{debugInspectResult.id || "N/A"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 border-b border-white/5 pb-2">
                                  <span className="text-slate-500">CATEGORY TYPE:</span>
                                  <span className="col-span-2 text-slate-300 uppercase font-bold">{debugInspectResult.type || "N/A"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 border-b border-white/5 pb-2">
                                  <span className="text-slate-500">UNIQUE KEY:</span>
                                  <span className="col-span-2 text-slate-300">{debugInspectResult.key || "(None)"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 border-b border-white/5 pb-2">
                                  <span className="text-slate-500">VALUE CONTENT:</span>
                                  <span className="col-span-2 text-slate-200 font-sans font-medium">{debugInspectResult.value || "(Empty)"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 border-b border-white/5 pb-2">
                                  <span className="text-slate-500">IMPORTANCE:</span>
                                  <span className="col-span-2 text-slate-200">
                                    {debugInspectResult.importance || 0}/10 
                                    <span className="ml-2 text-slate-500">
                                      ({debugInspectResult.importance >= 8 ? "Permanent" : debugInspectResult.importance >= 4 ? "Useful" : "Transient"})
                                    </span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 border-b border-white/5 pb-2">
                                  <span className="text-slate-500 font-mono text-[9px] uppercase">Created At:</span>
                                  <span className="col-span-2 text-slate-400 text-[9px]">
                                    {debugInspectResult.createdAt ? new Date(debugInspectResult.createdAt).toLocaleString() : "N/A"}
                                  </span>
                                </div>
                                
                                {debugInspectResult.embedding && (
                                  <div className="pt-2">
                                    <span className="text-slate-500 block mb-1">PGVECTOR EMBEDDING VECTOR (768 Dimensions, truncated preview):</span>
                                    <div className="bg-[#040407] rounded-lg p-2 text-slate-500 text-[8px] break-all leading-normal">
                                      {Array.isArray(debugInspectResult.embedding) 
                                        ? `[${debugInspectResult.embedding.slice(0, 15).join(", ")}, ... +${debugInspectResult.embedding.length - 15} dims]`
                                        : typeof debugInspectResult.embedding === "string"
                                          ? `${debugInspectResult.embedding.substring(0, 80)}...`
                                          : JSON.stringify(debugInspectResult.embedding)
                                      }
                                    </div>
                                  </div>
                                )}
                                {debugInspectResult.error && (
                                  <div className="text-red-400 p-1 font-bold">
                                    INSPECTOR ERROR: {debugInspectResult.error}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 italic p-3 border border-dashed border-white/5 rounded-xl text-center">
                              No record inspected yet. Enter an ID or select &quot;Inspect Vector&quot; on search results.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3. Memory Viewer (Detailed Raw Table list) */}
                      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Memory Viewer (Comprehensive Database Model)</h3>
                          </div>
                          <span className="text-[10px] font-mono bg-white/5 text-slate-400 rounded-md px-2 py-0.5">
                            Total Records: {memoriesList.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                          A direct transparent view of the durable recollection store metadata table. Helpful for spotting duplicates, key tracking, and date intervals.
                        </p>

                        {memoriesList.length === 0 ? (
                          <div className="text-[10px] text-slate-500 italic p-6 border border-dashed border-white/5 rounded-xl text-center">
                            The Database is completely empty. Call or talk to Divi to generate records.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                            <table className="w-full border-collapse text-left text-[9px] font-mono text-slate-400">
                              <thead>
                                <tr className="border-b border-white/10 bg-white/[0.02]">
                                  <th className="p-2 text-slate-500">ID</th>
                                  <th className="p-2 text-slate-500">Category</th>
                                  <th className="p-2 text-slate-500">Key</th>
                                  <th className="p-2 text-slate-500">Value (Durable Text Segment)</th>
                                  <th className="p-2 text-slate-500 text-center">Imp</th>
                                  <th className="p-2 text-slate-500">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {memoriesList.map((m) => (
                                  <tr key={m.id} className="border-b border-white/[0.04] hover:bg-white/[0.01]">
                                    <td className="p-2 text-indigo-300 font-bold">{m.id}</td>
                                    <td className="p-2 text-purple-400 font-bold uppercase">{m.type}</td>
                                    <td className="p-2"><span className="bg-white/5 px-1 rounded-sm text-slate-300 text-[8px]">{m.key || "-"}</span></td>
                                    <td className="p-2 text-slate-200 font-sans text-xs truncate max-w-[200px]" title={m.value}>{m.value}</td>
                                    <td className="p-2 text-center text-slate-300">{m.importance}/10</td>
                                    <td className="p-2">
                                      <button
                                        onClick={() => runDebugInspect(m.id)}
                                        className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer hover:font-bold"
                                      >
                                        Inspect
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 text-left">
                      {/* Integrated Manual Memory Manager Header Tools */}
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Memory Search & Manual Entry</h3>
                          </div>
                          
                          {/* Search Input */}
                          <div className="relative w-full md:w-72">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search memories by key or value..."
                              className="w-full pl-9 pr-8 py-1.5 bg-black/40 border border-white/5 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                            />
                            {isVoiceSearchSupported && (
                              <button
                                onClick={toggleVoiceSearch}
                                className={`absolute right-2 top-2 ${isVoiceSearchListening ? 'text-red-400 animate-pulse' : 'text-slate-500 hover:text-indigo-400'} transition-colors`}
                                title="Voice Search"
                              >
                                <Mic className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Creator Form */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border-t border-white/5 pt-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Memory Key</label>
                            <input
                              type="text"
                              value={newKey}
                              onChange={(e) => setNewKey(e.target.value)}
                              placeholder="e.g. favorite_anime"
                              className="w-full px-3 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Memory Value</label>
                            <input
                              type="text"
                              value={newValue}
                              onChange={(e) => setNewValue(e.target.value)}
                              placeholder="e.g. Solo Leveling"
                              className="w-full px-3 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Category</label>
                            <div className="flex gap-2">
                              <select
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                className="flex-1 px-2.5 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="identity">Identity</option>
                                <option value="preference">Preference</option>
                                <option value="project">Project</option>
                                <option value="relationship">Relationship</option>
                                <option value="goal">Goal</option>
                                <option value="fact">Fact</option>
                              </select>
                              <button
                                onClick={handleCreateMemory}
                                disabled={isCreating || !newKey.trim() || !newValue.trim()}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 text-indigo-100 disabled:text-indigo-100/50 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Inline Error Visual Alert */}
                        {memoryError && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center justify-between">
                            <span>{memoryError}</span>
                            <button 
                              onClick={() => setMemoryError(null)}
                              className="text-rose-400 hover:text-rose-300 text-sm font-bold cursor-pointer px-1"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {activeTab === "all" && memoriesList.length > 0 && (
                        <div id="importance-distribution-chart-container" className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Brain className="w-4 h-4 text-indigo-400 rotate-6" />
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Recollection Importance Distribution</h3>
                            </div>
                            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 rounded-md px-2 py-0.5 border border-indigo-500/20">
                              Scale 1 to 10
                            </span>
                          </div>
                          
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <XAxis 
                                  dataKey="score" 
                                  stroke="#64748b" 
                                  fontSize={10}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis 
                                  stroke="#64748b" 
                                  fontSize={10}
                                  tickLine={false}
                                  axisLine={false}
                                  allowDecimals={false}
                                />
                                <Tooltip 
                                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                                  contentStyle={{ 
                                    backgroundColor: "#0d0d1a", 
                                    borderColor: "rgba(255,255,255,0.1)",
                                    borderRadius: "12px",
                                    color: "#cbd5e1"
                                  }}
                                  itemStyle={{ color: "#818cf8" }}
                                  labelFormatter={(label) => `Importance Score: ${label}`}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                  {scoreDistribution.map((entry, index) => {
                                    // Custom color grading based on importance score
                                    let fill = "#818cf8"; // useful
                                    if (entry.score >= 8) fill = "#ec4899"; // permanent (pink)
                                    else if (entry.score < 4) fill = "#64748b"; // transient (slate)
                                    return <Cell key={`cell-${index}`} fill={fill} />;
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {memoriesList.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-600">
                            <Brain className="w-6 h-6 animate-pulse" />
                          </div>
                          <h3 className="text-sm font-semibold text-slate-300">Vault Currently Empty</h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Divi hasn&apos;t archived any recollections for {currentUser?.displayName || "you"} yet. Start speaking with her about your favorite foods, age, name, software projects (like EduFlow), or career dreams to build her index!
                          </p>
                        </div>
                      ) : filteredMemories.length === 0 ? (
                        <div className="p-8 border border-dashed border-white/5 rounded-2xl text-center space-y-2">
                          <p className="text-xs text-slate-400 italic">No memories matched your active query filter.</p>
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery("")}
                              className="text-xs text-indigo-400 hover:underline hover:text-indigo-300 font-semibold"
                            >
                              Clear Search Filter
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <AnimatePresence mode="popLayout">
                            {filteredMemories.map((m) => {
                              const isEditingThis = editingId === m.id;
                              
                              if (isEditingThis) {
                                return (
                                  <motion.div
                                    key={m.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95, height: 0 }}
                                    animate={{ opacity: 1, scale: 1, height: "auto" }}
                                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 350,
                                      damping: 35,
                                      opacity: { duration: 0.2 },
                                      height: { duration: 0.25 }
                                    }}
                                    className="p-4 rounded-2xl bg-indigo-950/15 border border-indigo-500/30 flex flex-col justify-between gap-3 transition-all overflow-hidden"
                                  >
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 font-bold">
                                          Editing Memory
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-500">ID: {m.id}</span>
                                      </div>

                                      <div className="space-y-2">
                                        <div>
                                          <label className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Key</label>
                                          <input
                                            type="text"
                                            value={editingKey}
                                            onChange={(e) => setEditingKey(e.target.value)}
                                            className="w-full px-2 py-1 bg-black/60 border border-white/10 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Value</label>
                                          <input
                                            type="text"
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            className="w-full px-2 py-1 bg-black/60 border border-white/10 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Category</label>
                                          <select
                                            value={editingCategory}
                                            onChange={(e) => setEditingCategory(e.target.value)}
                                            className="w-full px-2 py-1 bg-black/60 border border-white/10 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                          >
                                            <option value="identity">Identity</option>
                                            <option value="preference">Preference</option>
                                            <option value="project">Project</option>
                                            <option value="relationship">Relationship</option>
                                            <option value="goal">Goal</option>
                                            <option value="fact">Fact</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] pt-2">
                                      <button
                                        onClick={() => setEditingId(null)}
                                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-semibold rounded-md cursor-pointer transition-all"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleUpdateMemory(m.id)}
                                        disabled={isEditingSaving}
                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-indigo-100 text-[10px] font-semibold rounded-md flex items-center gap-1 cursor-pointer transition-all"
                                      >
                                        <Check className="w-3 h-3" />
                                        {isEditingSaving ? "Saving..." : "Save"}
                                      </button>
                                    </div>
                                  </motion.div>
                                );
                              }

                              return (
                                <motion.div
                                  key={m.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.95, height: 0 }}
                                  animate={{ opacity: 1, scale: 1, height: "auto" }}
                                  exit={{ opacity: 0, scale: 0.95, height: 0 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 350,
                                    damping: 35,
                                    opacity: { duration: 0.2 },
                                    height: { duration: 0.25 }
                                  }}
                                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex flex-col justify-between gap-3 hover:bg-white/[0.04] transition-all group relative overflow-hidden"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#a855f7] font-semibold">
                                        {m.type}
                                      </span>
                                      {m.key && (
                                        <span className="text-slate-400 text-[11px] font-semibold bg-white/5 px-2 py-0.5 rounded-md w-max">
                                          {m.key}
                                        </span>
                                      )}
                                      <p className="text-xs text-slate-200 font-medium leading-relaxed mt-1">
                                        {m.value}
                                      </p>
                                    </div>
                                    
                                    {/* Edit & Delete Buttons with Dual-Stage Confirmation */}
                                    <div className="shrink-0 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-all">
                                      {deleteConfirmId === m.id ? (
                                        <div className="flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded border border-red-500/20">
                                          <button
                                            onClick={() => {
                                              handleDeleteMemory(m.id);
                                              setDeleteConfirmId(null);
                                            }}
                                            title="Confirm delete"
                                            className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-red-100 text-[9px] font-bold transition-all cursor-pointer"
                                          >
                                            Forget?
                                          </button>
                                          <button
                                            onClick={() => setDeleteConfirmId(null)}
                                            title="Cancel"
                                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 text-[9px] transition-all cursor-pointer"
                                          >
                                            Keep
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingId(m.id);
                                              setEditingKey(m.key || "");
                                              setEditingValue(m.value || "");
                                              setEditingCategory(m.type || "fact");
                                            }}
                                            title="Edit memory"
                                            className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-indigo-400 transition-all cursor-pointer"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => setDeleteConfirmId(m.id)}
                                            title="Delete memory"
                                            className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between border-t border-white/[0.03] pt-2.5 text-[10px] font-mono text-slate-500">
                                    <span>Imp: {m.importance || 10}/10</span>
                                    <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSettingsModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, filter: "blur(12px)", y: 40, rotateX: 15 }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)", y: -20, rotateX: -10 }}
              transition={{ type: "spring", damping: 20, stiffness: 100, duration: 0.5 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 shadow-2xl overflow-hidden rounded-2xl p-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">Divi Settings</h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Voice Persona
                  </label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="Kore">Kore (Female)</option>
                    <option value="Zephyr">Zephyr (Female)</option>
                    <option value="Puck">Puck (Male)</option>
                    <option value="Charon">Charon (Male)</option>
                    <option value="Fenrir">Fenrir (Male)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Language
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={["en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "ja-JP", "ko-KR", "zh-CN", "ta-IN"].includes(language) ? language : "custom"}
                      onChange={(e) => {
                        if (e.target.value !== "custom") {
                          setLanguage(e.target.value);
                        } else {
                          setLanguage("");
                        }
                      }}
                      className="flex-1 bg-black/30 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Spanish (Spain)</option>
                      <option value="fr-FR">French</option>
                      <option value="de-DE">German</option>
                      <option value="it-IT">Italian</option>
                      <option value="ja-JP">Japanese</option>
                      <option value="ko-KR">Korean</option>
                      <option value="zh-CN">Chinese (Simplified)</option>
                      <option value="ta-IN">Tamil</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {!["en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "ja-JP", "ko-KR", "zh-CN", "ta-IN"].includes(language) && (
                      <input
                        type="text"
                        placeholder="Language name"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="flex-1 min-w-[120px] bg-black/30 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                      />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Takes effect on next connection.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Orb Theme
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setOrbTheme("indigo")}
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        orbTheme === "indigo" 
                          ? "bg-indigo-500/20 border-indigo-400 text-indigo-300" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-medium">Indigo</span>
                    </button>
                    <button
                      onClick={() => setOrbTheme("emerald")}
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        orbTheme === "emerald" 
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-300" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-medium">Emerald</span>
                    </button>
                    <button
                      onClick={() => setOrbTheme("rose")}
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        orbTheme === "rose" 
                          ? "bg-rose-500/20 border-rose-400 text-rose-300" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-medium">Rose</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Orb Particle Density
                  </label>
                  <button
                    onClick={() => setHighParticleDensity(!highParticleDensity)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      highParticleDensity ? "bg-indigo-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        highParticleDensity ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3 mt-6">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Visualization Style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setVisualizationStyle("bars")}
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        visualizationStyle === "bars" 
                          ? "bg-indigo-500/20 border-indigo-400 text-indigo-300" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-medium">Bars</span>
                    </button>
                    <button
                      onClick={() => setVisualizationStyle("circular")}
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        visualizationStyle === "circular" 
                          ? "bg-indigo-500/20 border-indigo-400 text-indigo-300" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-medium">Circular</span>
                    </button>
                    <button
                      onClick={() => setVisualizationStyle("linear")}
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        visualizationStyle === "linear" 
                          ? "bg-indigo-500/20 border-indigo-400 text-indigo-300" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-medium">Linear</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
