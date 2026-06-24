import { GoogleGenAI, Type, Schema } from '@google/genai';
import { User, Memory, Conversation } from '../db/models.ts';

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
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`[Cognition Retry] Temporary Gemini load or rate limit (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delay)}ms... Error:`, err?.message || err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Safe user synchronization.
   */
  public static async getOrCreateUser(uid: string, email: string) {
    try {
      let user = await User.findOne({ userId: uid });
      if (user) {
        return user;
      }

      user = new User({ userId: uid, email });
      await user.save();
      return user;
    } catch (error) {
      console.error("Failed to register/get user in database:", error);
      throw new Error("Durable database user integration failed.", { cause: error });
    }
  }

  /**
   * Saves a memory to the database (and supports older signature as well).
   */
  public static async saveMemory(userId: string, keyOrItem: string | MemoryItem, value?: string, category: string = "fact"): Promise<void> {
    try {
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

      // Normalize key (lowercase, snake_case)
      const cleanKey = finalKey.toLowerCase().replace(/\s+/g, '_');

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
      console.error(`Failed to store memory item for user ${userId}:`, error);
      throw new Error("Durable database memory storage failed.", { cause: error });
    }
  }

  /**
   * Retrieves a specific memory by key.
   */
  public static async getMemory(userId: string, key: string): Promise<string | null> {
    try {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      const item = await Memory.findOne({ userId, key: cleanKey });
      if (item) {
        console.log(`[MEMORY LOADED] Key: "${cleanKey}", Value: "${item.value}" for User: ${userId}`);
        return item.value;
      }
      return null;
    } catch (error) {
      console.error(`Failed to getMemory for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Retrieves all memories for a user.
   */
  public static async getAllMemories(userId: string): Promise<any[]> {
    try {
      const items = await Memory.find({ userId }).sort({ createdAt: -1 });
      console.log(`[MEMORY LOADED] Loaded ${items.length} memories for User: ${userId}`);
      return items;
    } catch (error) {
      console.error(`Failed to getAllMemories for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Updates a specific memory key.
   */
  public static async updateMemory(userId: string, key: string, value: string): Promise<void> {
    try {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
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
      console.error(`Failed to updateMemory for user ${userId}:`, error);
    }
  }

  /**
   * Deletes a specific memory key.
   */
  public static async deleteMemory(userId: string, key: string): Promise<void> {
    try {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      const match = await Memory.findOneAndDelete({ userId, key: cleanKey });
      if (match) {
        console.log(`[MEMORY DELETED] Key: "${cleanKey}" for User: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to deleteMemory for user ${userId}:`, error);
    }
  }

  /**
   * Simple standard database search (fallback or exact matching) to support UI.
   */
  public static async searchRelatedMemories(userId: string, query: string, limit: number = 5): Promise<any[]> {
    try {
      console.log(`[MEMORY LOADED] Searching memories containing "${query}" for User: ${userId}`);
      const cleanQuery = query.toLowerCase().trim();
      
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
      console.error("Failed to query memories:", error);
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
      console.error(`Failed to construct memory context block for user ${userId}:`, error);
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
    const dialogueConcat = textDialogLog.join("\n");

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
1. Generate a beautiful, high-level summary of this convo.
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
        const convo = new Conversation({
          sessionId: Math.random().toString(36).substring(7),
          userId,
          summary: payload.summary,
          timestamp: new Date()
        });
        await convo.save();
        console.log(`Stored session summary: "${payload.summary}"`);
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

    } catch (err) {
      console.error("Failed to execute background Memory Extraction pipeline:", err);
    }
  }
}
