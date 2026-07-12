const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `const result = await ToolExecutor.execute(call.name, call.args || call.arguments);`,
  `const result = await ToolExecutor.execute(call.name, call.args || call.arguments, user?.uid);`
);

fs.writeFileSync('server.ts', code);
