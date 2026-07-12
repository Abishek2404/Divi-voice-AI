const fs = require('fs');
let code = fs.readFileSync('src/agent/ToolExecutor.ts', 'utf8');

code = code.replace(
  `import { MemoryService } from "../services/MemoryService.js";

  static async execute(name: string, args: any, userId?: string): Promise<any> {`,
  `  static async execute(name: string, args: any, userId?: string): Promise<any> {`
);

code = `import { MemoryService } from "../services/MemoryService.js";\n` + code;

fs.writeFileSync('src/agent/ToolExecutor.ts', code);
