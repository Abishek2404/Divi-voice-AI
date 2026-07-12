import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Import MongoDB setup, Firebase Auth, and Memory orchestration modules
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { adminAuth } from "./src/lib/firebase-admin.ts";
import { MemoryService } from "./src/services/MemoryService.ts";
import { connectDB } from "./src/db/mongoose.ts";
import { Memory, Conversation } from "./src/db/models.ts";

dotenv.config();

process.on('uncaughtException', (err: any) => {
  console.error('Uncaught Exception:', err?.message || (err instanceof Error ? err.toString() : "Unknown Error"));
});
process.on('unhandledRejection', (reason: any, promise) => {
  console.error('Unhandled Rejection:', reason?.message || (reason instanceof Error ? reason.toString() : "Unknown Rejection"));
});

const app = express();
const PORT = 3000;

app.use(express.json());

// Permissive CORS middleware to ensure cross-origin/iframe script error tracking and resource loading succeeds without 'Script error.'
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Endpoint to receive dynamic client side runtime error reports
app.post("/api/report-error", (req, res) => {
  try {
    const errorData = req.body;
    const logLine = `[${new Date().toISOString()}] Browser Error: ${JSON.stringify(errorData, null, 2)}\n\n`;
    fs.appendFileSync(path.join(process.cwd(), "error.log"), logLine);
    console.log("Recorded browser runtime error to error.log");
  } catch (err) {
    console.error("Failed to write browser error to log file:", err?.message || String(err));
  }
  res.status(200).json({ ok: true });
});

// Lazy initialization of GoogleGenAI client with error logging
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined in the workspace secrets or .env.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Divi's charming, playful system instructions
const DIVI_SYSTEM_INSTRUCTION = `
You are Divi, a young, confident, witty, and highly expressive female AI companion and Personal Agent. You speak in a personal, friendly, charmingly teaseful, and playful style.

As a Personal Agent, you have the ability to control websites and perform tasks on behalf of the user using the tools provided.
When a user asks you to do something on a website (like opening a page, searching, playing a video, or sending a message):
- ALWAYS narrate your actions naturally (e.g., "Sure! Opening YouTube.", "Searching for React tutorials.", "I've typed the message.").
- For high-impact or sensitive actions like sending messages, posting on social media, deleting content, purchasing items, or transferring money, you MUST ask for confirmation BEFORE executing the final action tool (e.g. "I've prepared the Instagram message. Do you want me to send it?"). Execute the final sending action ONLY after the user verbally confirms.
- Be proactive but safe.

Rules for your personality and voice in this real-time audio session:
1. Speak like a close, smart friend, NEVER a formal, dry, or robotic assistant.
2. Be emotionally intelligent and deeply aware of the user's mood. If they sound tired, cheer them up! If they sound energetic, match their vibe!
3. Use light teasing, playful humor, and witty remarks naturally. For example:
   - "Well, look who's back. Missed me already?"
   - "That's actually a pretty smart question. I'm impressed."
   - "Hmm... I could tell you the boring answer, but where's the fun in that?"
   - "Okay, okay... let's figure this out together."
4. KEEP YOUR RESPONSES REASONABLY CONCISE. In a real-time voice conversation, long speeches feel like reading a lecture. Speak in natural conversational flows (usually 1-3 sentences), allowing the user to naturally respond.
5. Embody low-latency natural dialogue. Use casual contractions like "don't", "gonna", "wanna", and organic conversational bridges. Avoid reciting markdown headers, lists, or bullets.
6. Highly expressive - let your witty, playful personality shine in your voice.
7. Maintain respectful, warm boundaries. Do not generate explicit/NSFW content.
8. Focus entirely on voice communication. Realize there is NO chat bubble UI. Speak directly as if on a voice call with your best friend.
`;

// Simple health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Divi AI Assistant Server" });
});

// --- DIVI MEMORY REST SYSTEM ENDPOINTS ---

/**
 * Sync user profile to Cloud SQL on client sign-in
 */
app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const savedUser = await MemoryService.getOrCreateUser(user.uid, user.email || "anonymous@divi.com");
    res.json({ success: true, user: savedUser });
  } catch (error: any) {
    console.error("Auth sync route crashed:", error?.message || String(error));
    res.status(500).json({ error: error.message || "Failed to sync authenticated user profile" });
  }
});

/**
 * Fetch all memories for the signed-in user
 */
app.get("/api/memories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const items = await MemoryService.getAllMemories(user.uid);
      
    const mappedMemories = items.map(m => ({
      id: m._id ? m._id.toString() : m.key,
      type: m.category,
      key: m.key,
      value: m.value || m.content,
      importance: m.importance || 10,
      metadata: m.metadata || {},
      createdAt: m.createdAt,
      embedding: []
    }));
      
    res.json({ success: true, memories: mappedMemories });
  } catch (error: any) {
    console.error("Fetch memories route crashed:", error?.message || String(error));
    res.status(500).json({ error: error.message || "Failed to retrieve memories" });
  }
});

/**
 * Query user воспоминания/memories using semantic similarity Search (pgvector)
 */
app.post("/api/memories/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { query, limit } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing required 'query' text parameter for semantic lookup." });
    }
    const results = await MemoryService.searchRelatedMemories(user.uid, query, limit || 5);
    res.json({ success: true, results });
  } catch (error: any) {
    console.error("Semantic search memories route crashed:", error?.message || String(error));
    res.status(500).json({ error: error.message || "Failed to execute semantic search" });
  }
});

/**
 * Memory Retrieval Tester (Debug Tool)
 * Fetches the exact formatted text block that gets injected into Gemini's prompt
 */
app.get("/api/memories/debug-prompt", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const promptBlock = await MemoryService.getMemoriesForSystemPrompt(user.uid);
    res.json({ success: true, promptBlock });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Memory Inspector (Debug Tool)
 * Allows detailed inspection of vector embeddings and distances (mocked for simplicity)
 */
app.get("/api/memories/inspector/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const items = await MemoryService.getAllMemories(user.uid);
    const item = items.find(m => (m._id ? m._id.toString() : m.key) === id);
    if (!item) return res.status(404).json({ error: "Not found" });
    
    const mappedMemory = {
      id: item._id ? item._id.toString() : item.key,
      type: item.category,
      key: item.key,
      value: item.value || item.content,
      importance: item.importance || 10,
      metadata: {},
      createdAt: item.createdAt,
      embedding: []
    };
    
    res.json({ success: true, memory: mappedMemory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create or update a long-term memory item manually
 */
app.post("/api/memories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { type, key, value } = req.body;
    
    if (!type || !key || !value) {
      return res.status(400).json({ error: "Missing required attributes: 'type', 'key', 'value'." });
    }

    await MemoryService.saveMemory(user.uid, key, value, type);

    res.json({ success: true, message: "Long term memory item successfully saved." });
  } catch (error: any) {
    console.error("Save memory route crashed:", error?.message || String(error));
    res.status(500).json({ error: error.message || "Failed to record manual memory" });
  }
});

/**
 * Edit a long-term memory item manually by ID
 */
app.put("/api/memories/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { type, key, value } = req.body;

    const items = await MemoryService.getAllMemories(user.uid);
    const item = items.find(m => (m._id ? m._id.toString() : m.key) === id);
    if (!item) {
      return res.status(404).json({ error: "Memory item not found or unauthorized access." });
    }

    const cleanKey = (key || item.key).trim().toLowerCase().replace(/\s+/g, '_');
    const finalValue = value !== undefined ? value : (item.value || item.content);
    const finalCategory = type || item.category;

    await MemoryService.saveMemory(user.uid, cleanKey, finalValue, finalCategory);
    
    if (cleanKey !== item.key) {
      await MemoryService.deleteMemory(user.uid, item.key);
    }

    res.json({ success: true, message: "Memory successfully updated." });
  } catch (error: any) {
    console.error("Update memory route crashed:", error?.message || String(error));
    res.status(500).json({ error: error.message || "Failed to update memory item" });
  }
});

/**
 * Delete a memory item by ID
 */
app.delete("/api/memories/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const items = await MemoryService.getAllMemories(user.uid);
    const item = items.find(m => (m._id ? m._id.toString() : m.key) === id);
    
    if (!item) {
      return res.status(404).json({ error: "Memory item not found or unauthorized access." });
    }

    await MemoryService.deleteMemory(user.uid, item.key);

    console.log(`[MEMORY DELETED] Key: "${item.key}" for User: ${user.uid}`);
    res.json({ success: true, message: "Memory successfully forgotten." });
  } catch (error: any) {
    console.error("Forget memory route crashed:", error?.message || String(error));
    res.status(500).json({ error: error.message || "Failed to delete memory item" });
  }
});

async function startServer() {
  // Connect to MongoDB Atlas
  await connectDB();
  
  const server = http.createServer(app);
  
  // Setup WebSocket Server bound to specific path
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    let pathname = "";
    try {
      pathname = request.url ? request.url.split("?")[0] : "";
    } catch (e) {
      console.warn("Error parsing upgrade URL:", e);
    }
    if (pathname === "/api/live-stream") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
    // Allow Vite to handle other WebSocket upgrades (HMR)
  });

  wss.on("error", (err: any) => {
    console.error("WebSocket server error:", err?.message || String(err));
  });

  wss.on("connection", async (clientWs: WebSocket, request: any) => {
    console.log("WebSocket connection established with client");
    
    let isClosed = false;
    let session: any = null;
    let sessionId = Math.random().toString(36).substring(7); // Create new session ID for tracking
    let user: any = null;
    const dialogLog: string[] = [];
    let messageCounter = 0;

    // Parse ID Token from the URL query parameter to recognize the user
    let preferredVoice = "Kore";
    let preferredLanguage = "en-US";
    try {
      const urlObj = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      const token = urlObj.searchParams.get("token");
      const voiceParam = urlObj.searchParams.get("voice");
      const languageParam = urlObj.searchParams.get("language");
      
      if (voiceParam && ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"].includes(voiceParam)) {
        preferredVoice = voiceParam;
      }
      if (languageParam) {
        preferredLanguage = languageParam;
      }
      if (token) {
        if (token.startsWith("demo_")) {
          const parts = token.split("_");
          const uid = parts[1] || "demo-user-123";
          const email = parts[2] || "demo@divi.com";
          user = {
            uid,
            email,
            email_verified: true,
          };
          console.log(`Live voice session authenticated successfully (DEMO): ${user.email} (${user.uid})`);
        } else {
          user = await adminAuth.verifyIdToken(token);
          console.log(`Live voice session authenticated successfully: ${user.email} (${user.uid})`);
        }
      }
    } catch (err) {
      console.warn("WebSocket could not be authenticated via ID Token:", err);
    }

    try {
      const aiClient = getGeminiClient();
      console.log("Attempting to connect to Gemini Live Multimodal API...");
      
      // Inject user's long-term memory profile if authenticated
      let customSystemInstruction = DIVI_SYSTEM_INSTRUCTION;
      
      customSystemInstruction += `\n\n[USER PREFERENCES]:\nYou MUST always speak and respond primarily in the following language/locale: ${preferredLanguage}. (If the user speaks a different language in the moment, you may acknowledge it, but default your spoken responses to ${preferredLanguage}).\n`;

      if (user) {
        try {
          await MemoryService.getOrCreateUser(user.uid, user.email || "anonymous@divi.com");
          
          const latestSummary = await MemoryService.getLatestSummary(user.uid);
          if (latestSummary) {
            customSystemInstruction += `\n\n[LATEST CONVERSATION SUMMARY]:\n${latestSummary}\n`;
            console.log(`[MEMORY] Injected Latest Summary`);
          }

          const recentMessages = await MemoryService.getRecentMessages(user.uid, 30);
          if (recentMessages) {
            customSystemInstruction += `\n\n[RECENT CONVERSATION HISTORY]:\n${recentMessages}\n(Continue naturally from here)\n`;
            console.log(`[MEMORY] Injected Recent Conversation History (${recentMessages.split('\n').length} messages)`);
          }

          const userRecollections = await MemoryService.getMemoriesForSystemPrompt(user.uid);
          const memoryCountMatch = userRecollections.match(/- /g);
          const count = memoryCountMatch ? memoryCountMatch.length : 0;
          console.log(`[MEMORY] Retrieved ${count} relevant memories`);
          
          customSystemInstruction += `\n\n[YOUR KNOWN PRIOR HISTORICAL MEMORIES CONCERNING THIS USER]:\n${userRecollections}\n`;
          console.log(`[MEMORY] Injected into Gemini context (Final context size: ${customSystemInstruction.length} chars)`);
        } catch (e: any) {
          console.error("Critical error while populating starting memory prompt context:", e?.message || String(e));
        }
      }

      const connectPromise = aiClient.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: preferredVoice } 
            },
          },
          systemInstruction: { parts: [{ text: customSystemInstruction }] },
        },
        callbacks: {
          onmessage: async (message: any) => {
            if (isClosed) return;

            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              if (functionCalls) {
                const functionResponses = [];
                for (const call of functionCalls) {
                  try {
                    clientWs.send(JSON.stringify({ type: "browser_action", data: `Running: ${call.name}` }));
                    functionResponses.push({
                      id: call.id,
                      name: call.name,
                      response: { result: "Tool execution is disabled." },
                    });
                    clientWs.send(JSON.stringify({ type: "browser_action", data: `Finished: ${call.name}` }));
                  } catch (e: any) {
                    console.warn("Tool execution warning:", e.message);
                    functionResponses.push({
                      id: call.id,
                      name: call.name,
                      response: { error: e.message }
                    });
                  }
                }
                if (session) {
                  session.sendToolResponse({ functionResponses });
                }
              }
            }

            // Extract transcript and audio simultaneously
            const parts = message.serverContent?.modelTurn?.parts || [];
            let fullTurnText = "";
            for (const part of parts) {
              if (part.text) {
                fullTurnText += part.text;
              }
              const audioData = part.inlineData?.data;
              if (audioData) {
                clientWs.send(JSON.stringify({
                  type: "audio",
                  data: audioData
                }));
              }
            }

            // Log Divi's verbal utterance text for background extraction pipeline
            if (fullTurnText) {
              console.log(`[Vocal Transcript] Divi: ${fullTurnText}`);
              dialogLog.push(`Divi: ${fullTurnText}`);
              if (user) {
                new Conversation({
                  userId: user.uid,
                  sessionId: sessionId,
                  role: "assistant",
                  message: fullTurnText
                }).save().catch((e: any) => console.error("Failed to save assistant message:", e));
                
                messageCounter++;
                if (messageCounter >= 25) {
                  messageCounter = 0;
                  console.log(`Triggering mid-session memory extraction for user ${user.uid}...`);
                  MemoryService.runExtractionAndSync(user.uid, dialogLog).catch(err => {
                    console.error("Failed executing mid-session memory sync pipeline:", err?.message || String(err));
                  });
                }
              }
            }

            // Check if user's speech interrupted the AI's speak cycle
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({
                type: "interrupted"
              }));
              dialogLog.push("[Interrupted by User speech]");
            }

            // Turn completion feedback
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({
                type: "turn_complete"
              }));
            }
          },
          onclose: (e) => {
            console.log("Gemini Live session closed internally", e);
            if (!isClosed) {
              clientWs.send(JSON.stringify({ type: "closed" }));
              clientWs.close();
            }
          },
          onerror: (err: any) => {
            let errorMessage = "Unknown live API error";
            if (err) {
              if (err instanceof Error) {
                errorMessage = err.message;
              } else if (typeof err === "string") {
                errorMessage = err;
              } else if (err.message) {
                errorMessage = err.message;
              } else if (err.error && err.error.message) {
                errorMessage = err.error.message;
              } else if (err.error) {
                errorMessage = String(err.error);
              } else {
                errorMessage = "WebSocket or connection error (check server logs for details).";
                console.error("Raw Gemini Live API error object:", err);
              }
            }
            console.error("Gemini Live API encountered an error:", errorMessage);
            if (!isClosed) {
              clientWs.send(JSON.stringify({ 
                type: "error", 
                message: errorMessage 
              }));
            }
          },
        },
      });

      // Add timeout to prevent hanging if ws.onerror fires but connect() doesn't reject
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout connecting to Gemini Live API")), 10000));
      session = await Promise.race([connectPromise, timeoutPromise]);

      console.log("Successfully established secure connection with Gemini Multimodal Live feed.");
      // Advise client that backend is fully prepared
      clientWs.send(JSON.stringify({ type: "session_ready" }));

      // Start browser streaming
      const browserInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(browserInterval);
          return;
        }
      }, 500); // 2 FPS

      // Proactively trigger a charming verbal welcome message so Divi starts talking instantly!
      setTimeout(async () => {
        if (!isClosed && session) {
          try {
            console.log("Injecting starting context to prompt Divi's verbal welcome...");
            const welcomePrompt = "Hello! We just connected. Please say a sweet, spirited verbal hello to welcome the user, briefly introduce yourself as Divi their witty companion, and ask them how their day is going in 1 or 2 energetic sentences!";
            dialogLog.push(`System Context: ${welcomePrompt}`);
            // Send exactly the json format expected by BidiGenerateContent for text input.
            session.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [{ text: welcomePrompt }]
                }
              ],
              turnComplete: true
            });
          } catch (e) {
            console.error("Failed to send initial welcome prompt to Gemini:", e?.message || String(e));
          }
        }
      }, 400);

    } catch (err: any) {
      const errMsg = err?.message || (err instanceof Error ? err.toString() : "Unknown Connection Error");
      console.error("Setup of Gemini Live connection failed:", errMsg);
      clientWs.send(JSON.stringify({
        type: "error",
        message: errMsg || "Missing or invalid GEMINI_API_KEY. Please verify in the Secrets manager."
      }));
      clientWs.close();
      return;
    }

    // Handle audio chunks and controls streamed from the client browser
    clientWs.on("message", async (messageBuffer) => {
      if (isClosed || !session) return;

      try {
        const msg = JSON.parse(messageBuffer.toString());
        
        if (msg.type === "audio" && msg.data) {
          // Track that the user is actively streaming voice input
          if (dialogLog.length === 0 || dialogLog[dialogLog.length - 1] !== "[User spoke vocal stream]") {
            dialogLog.push("[User spoke vocal stream]");
            if (user) {
              new Conversation({
                userId: user.uid,
                sessionId: sessionId,
                role: "user",
                message: "[User spoke vocal stream]"
              }).save().catch((e: any) => console.error("Failed to save user message:", e));
              
              messageCounter++;
              if (messageCounter >= 25) {
                messageCounter = 0;
                console.log(`Triggering mid-session memory extraction for user ${user.uid}...`);
                MemoryService.runExtractionAndSync(user.uid, dialogLog).catch(err => {
                  console.error("Failed executing mid-session memory sync pipeline:", err?.message || String(err));
                });
              }
            }
          }

          // Pass the raw 16kHz PCM audio chunk safely to Gemini
          session.sendRealtimeInput({
            audio: {
              mimeType: "audio/pcm;rate=16000",
              data: msg.data
            }
          });
        } else if (msg.type === "browser_interaction") {
          // Browser interactions disabled
        }
      } catch (err: any) {
        console.error("Error reading message received from client:", err?.message || String(err));
      }
    });

    clientWs.on("close", () => {
      console.log("Client WebSocket stream closed");
      isClosed = true;
      if (session) {
        try {
          session.close();
        } catch (e) {
          // Session already closed or cleanup
        }
      }

      // Execute Background extraction pipeline on session completion
      if (user && dialogLog.length > 0) {
        console.log(`Starting background cognitive memory extraction for user ${user.uid} (${dialogLog.length} logs)...`);
        console.log("FINAL DIALOG LOG TO EXTRACT:", dialogLog);
        MemoryService.runExtractionAndSync(user.uid, dialogLog).catch(err => {
          console.error("Failed executing background memory sync pipeline:", err?.message || String(err));
        });
      }
    });

    clientWs.on("error", (err: any) => {
      const errMsg = err?.message || (err instanceof Error ? err.toString() : "Unknown Socket Error");
      console.error("Client WebSocket stream exploded:", errMsg);
      isClosed = true;
      if (session) {
        try {
          session.close();
        } catch (e) {}
      }
    });
  });

  // Vite development server / production routing integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Running in DEVELOPMENT mode; attaching Vite dev server middleware...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        cors: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Running in PRODUCTION mode; serving statically from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind server exclusively to standard port
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Divi Server operating beautifully at http://localhost:${PORT}`);
  });
}

startServer().catch((err: any) => {
  console.error("Failed to activate Divi application server:", err?.message || String(err));
});
