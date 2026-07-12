const fs = require('fs');
let code = fs.readFileSync('src/agent/ToolRegistry.ts', 'utf8');

const newTools = `
  {
    type: "function",
    name: "saveMemory",
    description: "Save a fact, preference, or detail about the user to memory for long-term retention.",
    parameters: {
      type: "OBJECT",
      properties: {
        key: {
          type: "STRING",
          description: "A short, snake_case key representing the topic (e.g. favorite_food, pet_name, project_idea)"
        },
        value: {
          type: "STRING",
          description: "The fact or detail to remember (e.g. 'loves pizza', 'has a dog named Rex')"
        },
        type: {
          type: "STRING",
          description: "Category of memory item (e.g., identity, preference, relationship, project, goal, habit, event, conversation, fact)"
        }
      },
      required: ["key", "value"]
    }
  },
  {
    type: "function",
    name: "getMemories",
    description: "Retrieve all prior known facts and memories about this user.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
`;

code = code.replace(`export const toolDeclarations = [`, `export const toolDeclarations = [\n` + newTools);

fs.writeFileSync('src/agent/ToolRegistry.ts', code);
