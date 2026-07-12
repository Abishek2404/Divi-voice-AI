import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:3000/api/live-stream');
ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'start', idToken: 'test' }));
});
ws.on('message', (msg) => {
  console.log('Message:', msg.toString());
});
ws.on('error', (err) => {
  console.error('Error:', err);
});
