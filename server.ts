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
import { Memory } from "./src/db/models.ts";
import { toolDeclarations } from "./src/agent/ToolRegistry.ts";
import { ToolExecutor } from "./src/agent/ToolExecutor.ts";

dotenv.config();

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
    console.error("Failed to write browser error to log file:", err);
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
    console.error("Auth sync route crashed:", error);
    res.status(500).json({ error: error.message || "Failed to sync authenticated user profile" });
  }
});

/**
 * Fetch all memories for the signed-in user
 */
app.get("/api/memories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const items = await Memory.find({ userId: user.uid })
      .sort({ importance: -1, createdAt: -1 });
      
    const mappedMemories = items.map(m => ({
      id: m._id.toString(),
      type: m.category,
      key: m.key,
      value: m.content,
      importance: m.importance,
      metadata: m.metadata || {},
      createdAt: m.createdAt,
      embedding: []
    }));
      
    res.json({ success: true, memories: mappedMemories });
  } catch (error: any) {
    console.error("Fetch memories route crashed:", error);
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
    console.error("Semantic search memories route crashed:", error);
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
    const item = await Memory.findOne({ _id: id, userId: user.uid });
    if (!item) return res.status(404).json({ error: "Not found" });
    
    const mappedMemory = {
      id: item._id.toString(),
      type: item.category,
      key: item.key,
      value: item.content,
      importance: item.importance,
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
    console.error("Save memory route crashed:", error);
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

    const memory = await Memory.findOne({ _id: id, userId: user.uid });
    if (!memory) {
      return res.status(404).json({ error: "Memory item not found or unauthorized access." });
    }

    const cleanKey = (key || memory.key).trim().toLowerCase().replace(/\s+/g, '_');
    const finalValue = value !== undefined ? value : memory.value;
    const finalCategory = type || memory.category;

    memory.key = cleanKey;
    memory.value = finalValue;
    memory.content = finalValue;
    memory.category = finalCategory;
    await memory.save();

    console.log(`[MEMORY UPDATED] Key: "${cleanKey}", Value: "${finalValue}" for User: ${user.uid}`);
    res.json({ success: true, message: "Memory successfully updated." });
  } catch (error: any) {
    console.error("Update memory route crashed:", error);
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
    
    // Verify ownership before deletion to isolate users
    const match = await Memory.findOneAndDelete({ _id: id, userId: user.uid });

    if (!match) {
      return res.status(404).json({ error: "Memory item not found or unauthorized access." });
    }

    console.log(`[MEMORY DELETED] Key: "${match.key}" for User: ${user.uid}`);
    res.json({ success: true, message: "Memory successfully forgotten." });
  } catch (error: any) {
    console.error("Forget memory route crashed:", error);
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

  wss.on("connection", async (clientWs: WebSocket, request: any) => {
    console.log("WebSocket connection established with client");
    
    let isClosed = false;
    let session: any = null;
    let user: any = null;
    const dialogLog: string[] = [];

    // Parse ID Token from the URL query parameter to recognize the user
    try {
      const urlObj = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      const token = urlObj.searchParams.get("token");
      if (token) {
        user = await adminAuth.verifyIdToken(token);
        console.log(`Live voice session authenticated successfully: ${user.email} (${user.uid})`);
      }
    } catch (err) {
      console.warn("WebSocket could not be authenticated via ID Token:", err);
    }

    try {
      const aiClient = getGeminiClient();
      console.log("Attempting to connect to Gemini Live Multimodal API...");
      
      // Inject user's long-term memory profile if authenticated
      let customSystemInstruction = DIVI_SYSTEM_INSTRUCTION;
      if (user) {
        try {
          await MemoryService.getOrCreateUser(user.uid, user.email || "anonymous@divi.com");
          const userRecollections = await MemoryService.getMemoriesForSystemPrompt(user.uid);
          const memoryCountMatch = userRecollections.match(/- /g);
          const count = memoryCountMatch ? memoryCountMatch.length : 0;
          console.log(`[MEMORY] Retrieved ${count} relevant memories`);
          
          customSystemInstruction += `\n\n[YOUR KNOWN PRIOR HISTORICAL MEMORIES CONCERNING THIS USER]:\n${userRecollections}\n`;
          console.log(`[MEMORY] Injected into Gemini context`);
        } catch (e) {
          console.error("Critical error while populating starting memory prompt context:", e);
        }
      }

      session = await aiClient.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: "Kore" } 
            },
          },
          systemInstruction: customSystemInstruction,
          tools: toolDeclarations as any[],
        },
        callbacks: {
          onmessage: async (message: any) => {
            if (isClosed) return;

            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              if (functionCalls) {
                const functionResponses = [];
                for (const call of functionCalls) {
                  const result = await ToolExecutor.execute(call.name, call.args || call.arguments);
                  functionResponses.push({
                    id: call.id,
                    name: call.name,
                    response: result,
                  });
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
          onclose: () => {
            console.log("Gemini Live session closed internally");
            if (!isClosed) {
              clientWs.send(JSON.stringify({ type: "closed" }));
              clientWs.close();
            }
          },
          onerror: (err: any) => {
            console.error("Gemini Live API encountered an error:", err);
            if (!isClosed) {
              clientWs.send(JSON.stringify({ 
                type: "error", 
                message: err?.message || "Internal live api communication error" 
              }));
            }
          },
        },
      });

      console.log("Successfully established secure connection with Gemini Multimodal Live feed.");
      // Advise client that backend is fully prepared
      clientWs.send(JSON.stringify({ type: "session_ready" }));

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
            console.error("Failed to send initial welcome prompt to Gemini:", e);
          }
        }
      }, 400);

    } catch (err: any) {
      console.error("Setup of Gemini Live connection failed:", err);
      clientWs.send(JSON.stringify({
        type: "error",
        message: err?.message || "Missing or invalid GEMINI_API_KEY. Please verify in the Secrets manager."
      }));
      clientWs.close();
      return;
    }

    // Handle audio chunks and controls streamed from the client browser
    clientWs.on("message", (messageBuffer) => {
      if (isClosed || !session) return;

      try {
        const msg = JSON.parse(messageBuffer.toString());
        
        if (msg.type === "audio" && msg.data) {
          // Track that the user is actively streaming voice input
          if (dialogLog.length === 0 || dialogLog[dialogLog.length - 1] !== "[User spoke vocal stream]") {
            dialogLog.push("[User spoke vocal stream]");
          }

          // Pass the raw 16kHz PCM audio chunk safely to Gemini
          session.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: "audio/pcm;rate=16000"
            }
          });
        }
      } catch (err) {
        console.error("Error reading message received from client:", err);
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
          console.error("Failed executing background memory sync pipeline:", err);
        });
      }
    });

    clientWs.on("error", (err) => {
      console.error("Client WebSocket stream exploded:", err);
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
        hmr: { server },
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

startServer().catch((err) => {
  console.error("Failed to activate Divi application server:", err);
});
