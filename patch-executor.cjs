const fs = require('fs');
let code = fs.readFileSync('src/agent/ToolExecutor.ts', 'utf8');

code = code.replace(
  `static async execute(name: string, args: any): Promise<any> {`,
  `import { MemoryService } from "../services/MemoryService.js";\n\n  static async execute(name: string, args: any, userId?: string): Promise<any> {`
);

const newCases = `
        case 'saveMemory':
          if (!userId) {
            return { success: false, error: "No user authenticated to save memory" };
          }
          await MemoryService.saveMemory(userId, args.key, args.value, args.type || "fact");
          return { success: true, message: "Memory saved successfully." };
          
        case 'getMemories':
          if (!userId) {
            return { success: false, error: "No user authenticated to get memory" };
          }
          const memories = await MemoryService.getMemoriesForSystemPrompt(userId);
          return { success: true, memories };
`;

code = code.replace(
  `switch (name) {`,
  `switch (name) {` + newCases
);

fs.writeFileSync('src/agent/ToolExecutor.ts', code);
