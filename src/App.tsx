/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
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
  Check
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
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

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
  } = useGeminiLive();

  const isDisconnected = state === AssistantState.DISCONNECTED;

  // Authentication & Memory States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [memoriesList, setMemoriesList] = useState<any[]>([]);
  const [showMemoriesModal, setShowMemoriesModal] = useState<boolean>(false);
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

  const handleCreateMemory = async () => {
    if (!newKey.trim() || !newValue.trim() || !idToken) return;
    setIsCreating(true);
    setMemoryError(null);
    try {
      const response = await fetch("/api/memories", {
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
      console.error("Create memory failed:", e);
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
      const response = await fetch(`/api/memories/${id}`, {
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
      console.error("Update memory failed:", e);
      setMemoryError("Update memory failed due to a network or server error.");
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!idToken) return;
    setMemoryError(null);
    try {
      const response = await fetch(`/api/memories/${id}`, {
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
      console.error("Delete memory failed:", e);
      setMemoryError("Delete memory failed due to a network or server error.");
    }
  };

  const runDebugSearch = async () => {
    if (!debugSearchQuery.trim() || !idToken) return;
    setIsDebugSearchLoading(true);
    try {
      const res = await fetch("/api/memories/search", {
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
      const res = await fetch(`/api/memories/inspector/${targetId}`, {
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
      const res = await fetch("/api/memories/debug-prompt", {
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
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsSyncing(true);
        try {
          const tokenStr = await user.getIdToken();
          setIdToken(tokenStr);

          // Synchronize user profile database record in Cloud SQL
          await fetch("/api/auth/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${tokenStr}`
            }
          });

          // Fetch user recollections from Postgres
          await loadUserMemories(tokenStr);
        } catch (err) {
          console.error("Critical Profile sync error:", err);
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
      const response = await fetch("/api/memories", {
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

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error("Popup Sign in rejected:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowMemoriesModal(false);
    } catch (err) {
      console.error("Failed to disconnect Google Account session:", err);
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(235,50,150,0.3)]">
            <div className="w-5 h-5 border-[1.5px] border-white/95 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
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
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Brain className="w-3.5 h-3.5 text-indigo-400 rotate-6 animate-pulse" />
                Memory Vault
                <span className="bg-indigo-500/20 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded">
                  {memoriesList.length}
                </span>
              </button>

              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/5">
                <img
                  src={currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                  alt="avatar"
                  className="w-5 h-5 rounded-full border border-white/10"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs font-medium text-slate-300 max-w-[100px] truncate hidden sm:inline">
                  {currentUser.displayName || "Friend"}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-400 text-xs transition-colors p-1 cursor-pointer flex items-center gap-1"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-950 hover:bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.25)] transition-all duration-300 transform active:scale-95 cursor-pointer z-20"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </header>

      {/* 3. Main Center Stage Container */}
      <main
        id="divi-centerstage"
        className="flex-1 flex flex-col items-center justify-center py-6 relative z-10"
      >
        <div className="flex flex-col items-center justify-center gap-4 relative">
          
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
          <VoiceWaveform state={state} volumes={volumes} />

        </div>
      </main>

      {/* 4. Controls, Logs, Warnings & Bottom Control Hub */}
      <footer
        id="divi-controls-panel"
        className="w-full flex flex-col items-center justify-end pb-12 gap-8 relative z-10 bg-gradient-to-t from-black via-black/95 to-transparent"
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

        {/* Minimal Disclaimer info banner */}
        <div className="flex items-center gap-2 max-w-sm px-6 text-center select-none opacity-40">
          <MessageSquareOff className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-sans text-[10px] text-slate-400 tracking-wide">
            Zero Text Bubbles. Voice-First Long-Term Relational AI.
          </span>
        </div>

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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
                    <p className="text-[10px] text-slate-500 font-mono">Durable recollections indexed inside asia-southeast1 PostgreSQL</p>
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
                            Simulate vector embedding querying. Executes real-time cosine distance sorting on Drizzle/PostgreSQL database records.
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
                              className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/5 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                            />
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
                          {filteredMemories.map((m) => {
                            const isEditingThis = editingId === m.id;
                            
                            if (isEditingThis) {
                              return (
                                <div
                                  key={m.id}
                                  className="p-4 rounded-2xl bg-indigo-950/15 border border-indigo-500/30 flex flex-col justify-between gap-3 transition-all"
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
                                </div>
                              );
                            }

                            return (
                              <div
                                key={m.id}
                                className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex flex-col justify-between gap-3 hover:bg-white/[0.04] transition-all group relative"
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
                              </div>
                            );
                          })}
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
    </div>
  );
}
