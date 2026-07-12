import { GoogleGenAI, Type, Schema } from '@google/genai';
import mongoose from 'mongoose';
import { User, Memory, Conversation, ConversationSummary } from '../db/models.ts';

const EXTRACTION_MODEL = "gemini-2.5-flash"; // Valid free-tier model

export interface MemoryItem {
  type: string;        // 'identity', 'preference', 'project', 'relationship', 'goal', 'fact'
  key?: string;       // e.g., 'name', 'favorite_anime', etc.
  value: string;      // e.g., 'Abishek', 'Solo Leveling'
  importance?: number; // 1-10 (1-3 Temporary, 4-7 Useful, 8-10 Permanent)
  metadata?: any;     // e.g., { status: 'active' }
}

export class MemoryService {
  private static aiClient: GoogleGenAI | null = null;
  
  // In-memory fallback stores for environments with no MongoDB connection
  private static inMemoryUsers = new Map<string, any>();
  private static inMemoryMemories = new Map<string, any[]>();
  private static inMemoryConversations = new Map<string, any[]>();

  private static isDbConnected(): boolean {
    return typeof mongoose !== 'undefined' && mongoose.connection && mongoose.connection.readyState === 1;
  }

  private static getAI(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required for MemoryService.');
      }
      this.aiClient = new GoogleGenAI({ apiKey });
    }
    return this.aiClient;
  }

  /**
   * Helper utility executing asynchronous tasks with a retry and exponential backoff.
   */
  private static async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3, baseDelayMs: number = 2000): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isQuotaExceeded = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
        
        attempt++;
        if (attempt >= maxRetries || isQuotaExceeded) {
          throw err;
        }
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`[Cognition Retry] Temporary Gemini load or rate limit (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delay)}ms... Error:`, errMsg);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Safe user synchronization.
   */
  public static async getOrCreateUser(uid: string, email: string) {
    if (!this.isDbConnected()) {
      let user = this.inMemoryUsers.get(uid);
      if (!user) {
        user = { userId: uid, email, displayName: email.split('@')[0], createdAt: new Date() };
        this.inMemoryUsers.set(uid, user);
      }
      return user;
    }
    try {
      let user = await User.findOne({ userId: uid });
      if (user) {
        return user;
      }

      user = new User({ userId: uid, email });
      await user.save();
      return user;
    } catch (error) {
      console.error("Failed to register/get user in database:", error?.message || String(error));
      throw new Error("Durable database user integration failed.", { cause: error });
    }
  }

  /**
   * Saves a memory to the database (and supports older signature as well).
   */
  /**
   * Saves a memory to the database (and supports older signature as well).
   */
  public static async saveMemory(userId: string, keyOrItem: string | MemoryItem, value?: string, category: string = "fact"): Promise<void> {
    let finalKey = "";
    let finalValue = "";
    let finalCategory = category;

    if (typeof keyOrItem === "object") {
      finalKey = (keyOrItem.key || "").trim();
      finalValue = (keyOrItem.value || "").trim();
      finalCategory = keyOrItem.type || "fact";
    } else {
      finalKey = keyOrItem.trim();
      finalValue = (value || "").trim();
    }

    if (!finalKey) {
      throw new Error("Memory key is required");
    }

    const cleanKey = finalKey.toLowerCase().replace(/\s+/g, '_');

    if (!this.isDbConnected()) {
      let userMemories = this.inMemoryMemories.get(userId);
      if (!userMemories) {
        userMemories = [];
        this.inMemoryMemories.set(userId, userMemories);
      }
      const existingIdx = userMemories.findIndex(m => m.key === cleanKey);
      if (existingIdx !== -1) {
        userMemories[existingIdx].value = finalValue;
        userMemories[existingIdx].category = finalCategory;
        userMemories[existingIdx].updatedAt = new Date();
        console.log(`[IN-MEMORY UPDATE] Key: "${cleanKey}", Value: "${finalValue}" for User: ${userId}`);
      } else {
        userMemories.push({
          userId,
          key: cleanKey,
          value: finalValue,
          content: finalValue,
          category: finalCategory,
          importance: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`[IN-MEMORY SAVE] Key: "${cleanKey}", Value: "${finalValue}" for User: ${userId}`);
      }
      return;
    }

    try {
      // Check for exact key duplication for this user
      const existing = await Memory.findOne({ userId, key: cleanKey });

      if (existing) {
        existing.value = finalValue;
        existing.content = finalValue; // Backwards-compatible fallback
        existing.category = finalCategory;
        await existing.save();
        console.log(`[MEMORY UPDATED] Key: "${cleanKey}", Value: "${finalValue}" for User: ${userId}`);
      } else {
        const newMemory = new Memory({
          userId,
          key: cleanKey,
          value: finalValue,
          content: finalValue, // Backwards-compatible fallback
          category: finalCategory,
          importance: 10, // Default to high/permanent
        });
        await newMemory.save();
        console.log(`[MEMORY SAVED] Key: "${cleanKey}", Value: "${finalValue}" for User: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to store memory item for user ${userId}:`, error?.message || String(error));
      throw new Error("Durable database memory storage failed.", { cause: error });
    }
  }

  /**
   * Retrieves a specific memory by key.
   */
  public static async getMemory(userId: string, key: string): Promise<string | null> {
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
    if (!this.isDbConnected()) {
      const userMemories = this.inMemoryMemories.get(userId) || [];
      const item = userMemories.find(m => m.key === cleanKey);
      if (item) {
        console.log(`[IN-MEMORY LOADED] Key: "${cleanKey}", Value: "${item.value}" for User: ${userId}`);
        return item.value;
      }
      return null;
    }

    try {
      const item = await Memory.findOne({ userId, key: cleanKey });
      if (item) {
        console.log(`[MEMORY LOADED] Key: "${cleanKey}", Value: "${item.value}" for User: ${userId}`);
        return item.value;
      }
      return null;
    } catch (error) {
      console.error(`Failed to getMemory for user ${userId}:`, error?.message || String(error));
      return null;
    }
  }

  /**
   * Retrieves all memories for a user.
   */
  public static async getAllMemories(userId: string): Promise<any[]> {
    if (!this.isDbConnected()) {
      const memories = this.inMemoryMemories.get(userId) || [];
      console.log(`[IN-MEMORY LOADED] Loaded ${memories.length} memories for User: ${userId}`);
      return [...memories].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    try {
      const items = await Memory.find({ userId }).sort({ createdAt: -1 });
      console.log(`[MEMORY LOADED] Loaded ${items.length} memories for User: ${userId}`);
      return items;
    } catch (error) {
      console.error(`Failed to getAllMemories for user ${userId}:`, error?.message || String(error));
      return [];
    }
  }

  /**
   * Updates a specific memory key.
   */
  public static async updateMemory(userId: string, key: string, value: string): Promise<void> {
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
    if (!this.isDbConnected()) {
      await this.saveMemory(userId, cleanKey, value);
      return;
    }

    try {
      const existing = await Memory.findOne({ userId, key: cleanKey });
      if (existing) {
        existing.value = value;
        existing.content = value;
        await existing.save();
        console.log(`[MEMORY UPDATED] Key: "${cleanKey}", Value: "${value}" for User: ${userId}`);
      } else {
        await this.saveMemory(userId, cleanKey, value);
      }
    } catch (error) {
      console.error(`Failed to updateMemory for user ${userId}:`, error?.message || String(error));
    }
  }

  /**
   * Deletes a specific memory key.
   */
  public static async deleteMemory(userId: string, key: string): Promise<void> {
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
    if (!this.isDbConnected()) {
      const userMemories = this.inMemoryMemories.get(userId) || [];
      const index = userMemories.findIndex(m => m.key === cleanKey);
      if (index !== -1) {
        userMemories.splice(index, 1);
        console.log(`[IN-MEMORY DELETED] Key: "${cleanKey}" for User: ${userId}`);
      }
      return;
    }

    try {
      const match = await Memory.findOneAndDelete({ userId, key: cleanKey });
      if (match) {
        console.log(`[MEMORY DELETED] Key: "${cleanKey}" for User: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to deleteMemory for user ${userId}:`, error?.message || String(error));
    }
  }

  /**
   * Simple standard database search (fallback or exact matching) to support UI.
   */
  public static async searchRelatedMemories(userId: string, query: string, limit: number = 5): Promise<any[]> {
    const cleanQuery = query.toLowerCase().trim();
    if (!this.isDbConnected()) {
      const userMemories = this.inMemoryMemories.get(userId) || [];
      const matched = userMemories.filter(m => 
        m.key.toLowerCase().includes(cleanQuery) ||
        m.value.toLowerCase().includes(cleanQuery) ||
        m.category.toLowerCase().includes(cleanQuery)
      ).slice(0, limit);

      return matched.map(m => ({
        id: m.key,
        type: m.category,
        key: m.key,
        value: m.value,
        importance: m.importance || 10,
        createdAt: m.createdAt,
        distance: 0
      }));
    }

    try {
      console.log(`[MEMORY LOADED] Searching memories containing "${query}" for User: ${userId}`);
      
      const matched = await Memory.find({
        userId,
        $or: [
          { key: { $regex: cleanQuery, $options: "i" } },
          { value: { $regex: cleanQuery, $options: "i" } },
          { category: { $regex: cleanQuery, $options: "i" } }
        ]
      }).limit(limit);

      return matched.map(m => ({
        id: m._id.toString(),
        type: m.category,
        key: m.key,
        value: m.value,
        importance: m.importance || 10,
        createdAt: m.createdAt,
        distance: 0 // Mock distance for compatibility
      }));
    } catch (error) {
      console.error("Failed to query memories:", error?.message || String(error));
      return [];
    }
  }

  /**
   * Formats all active memories of a user into a custom prompt block.
   */
  public static async getMemoriesForSystemPrompt(userId: string): Promise<string> {
    try {
      const memories = await this.getAllMemories(userId);
      if (memories.length === 0) {
        return "";
      }

      const formatLabel = (k: string) => {
        return k
          .split(/[-_]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      };

      const blockParts = [
        "SYSTEM CONTEXT:",
        "",
        "User Memory:"
      ];

      for (const m of memories) {
        const label = formatLabel(m.key);
        blockParts.push(`${label}: ${m.value}`);
      }

      return blockParts.join("\n");
    } catch (error) {
      console.error(`Failed to construct memory context block for user ${userId}:`, error?.message || String(error));
      return "";
    }
  }

  /**
   * Analyzes a completed session dialogue, extracts high-level facts,
   * and saves/updates them automatically.
   */
  public static async runExtractionAndSync(userId: string, textDialogLog: string[]): Promise<void> {
    if (textDialogLog.length < 2) {
      console.log("Conversation dialogue is too brief to run memory extraction pipeline.");
      return;
    }

    const ai = this.getAI();
    const dialogueConcat = textDialogLog.slice(-50).join("\n");

    try {
      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "A 1-2 sentence high-level narrative summary of what was discussed or decided in this session."
          },
          recollectedFacts: {
            type: Type.ARRAY,
            description: "Extracted or updated facts, preferences, goals, or milestones discussed in this log.",
            items: {
              type: Type.OBJECT,
              properties: {
                action: {
                  type: Type.STRING,
                  enum: ["create", "update", "delete", "none"],
                  description: "Whether to create a new memory, update an existing one, delete a false memory, or none."
                },
                type: {
                  type: Type.STRING,
                  enum: ["identity", "preference", "relationship", "project", "goal", "habit", "event", "conversation", "fact"],
                  description: "Category of memory item."
                },
                key: {
                  type: Type.STRING,
                  description: "Standard lowercase short key if identity or preference (e.g. 'name', 'birthday', 'favorite_anime', 'project')."
                },
                value: {
                  type: Type.STRING,
                  description: "The concise description or fact value (e.g. 'Abishek', 'Solo Leveling', 'EduFlow')."
                }
              },
              required: ["action", "type", "key", "value"]
            }
          }
        },
        required: ["summary", "recollectedFacts"]
      };

      console.log("Triggering advanced structured semantic fact extraction on completed dialogue log...");

      const prompt = `
You are Divi's background cognitive processor. Your goal is to review a voice conversation dialogue log between the user and Divi, extract key long-term facts, update prior knowledge, and summarize the conversation session.

### INPUTS:
Active conversation log:
"""
${dialogueConcat}
"""

### TASKS:
1. Generate a high-level summary of this convo containing: Current topics being discussed, Key decisions or facts, and the Current emotional state of the user.
2. Review the dialogue for new identity parameters (age, name, birthday, location), preferences/likes (favorite foods, favorite anime, movies, colors), projects/work (project names like EduFlow), family/relationships, or goals.
3. IMPORTANT CONTEXT: The log only contains Divi's verbal responses and placeholders '[User spoke vocal stream]' for the user's speech. You MUST INFER what the user said based on Divi's responses! (e.g. if Divi says "Oh wow, Solo Leveling is a cool anime to have as a favorite!", you infer the key "favorite_anime" = "Solo Leveling").
4. Always extract specific keys for standard details:
   - "My name is Abishek" -> key: "name", value: "Abishek", type: "identity"
   - "My favorite anime is Solo Leveling" -> key: "favorite_anime", value: "Solo Leveling", type: "preference"
   - "My current project is EduFlow" -> key: "project", value: "EduFlow", type: "project"
`;

      const analysis = await this.retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: EXTRACTION_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2
          }
        });
      });

      const resultText = analysis.text;
      if (!resultText) {
        throw new Error("No structured output returned from extraction engine");
      }

      const payload = JSON.parse(resultText);
      console.log("Extracted structured response payload:", JSON.stringify(payload, null, 2));

      // Persist the Session Summary
      if (payload.summary) {
        if (!this.isDbConnected()) {
          let userConvos = this.inMemoryConversations.get(userId);
          if (!userConvos) {
            userConvos = [];
            this.inMemoryConversations.set(userId, userConvos);
          }
          userConvos.push({
            sessionId: Math.random().toString(36).substring(7),
            userId,
            summary: payload.summary,
            createdAt: new Date()
          });
          console.log(`Stored in-memory session summary: "${payload.summary}"`);
        } else {
          const convo = new ConversationSummary({
            sessionId: Math.random().toString(36).substring(7),
            userId,
            summary: payload.summary,
          });
          await convo.save();
          console.log(`Stored session summary: "${payload.summary}"`);
        }
      }

      // Process Recollected Facts
      if (Array.isArray(payload.recollectedFacts)) {
        for (const fact of payload.recollectedFacts) {
          if (fact.action === 'create' || fact.action === 'update') {
            await this.saveMemory(userId, fact.key, fact.value, fact.type);
          } else if (fact.action === 'delete') {
            await this.deleteMemory(userId, fact.key);
          }
        }
      }

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) {
        console.warn("[Memory Extraction] Background cognitive extraction pipeline paused due to Gemini API free-tier quota limitations. We will sync this session's recollections on the next user action.");
      } else {
        console.error("Failed to execute background Memory Extraction pipeline:", errMsg);
      }
    }
  }

  public static async getRecentMessages(userId: string, limit: number = 30): Promise<string> {
    if (!this.isDbConnected()) return "";
    try {
      const messages = await Conversation.find({ userId }).sort({ timestamp: -1 }).limit(limit);
      if (messages.length === 0) return "";
      return messages.reverse().map(m => `${m.role === 'user' ? 'User' : 'Divi'}: ${m.message}`).join("\n");
    } catch (e) {
      console.error("Failed to load recent messages:", e);
      return "";
    }
  }

  public static async getLatestSummary(userId: string): Promise<string> {
    if (!this.isDbConnected()) return "";
    try {
      const summary = await ConversationSummary.findOne({ userId }).sort({ createdAt: -1 });
      return summary ? summary.summary : "";
    } catch (e) {
      console.error("Failed to load latest summary:", e);
      return "";
    }
  }
}