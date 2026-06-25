import { GoogleGenAI, Modality } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.live.connect({ 
  model: 'gemini-3.1-flash-live-preview',
  callbacks: {
    onclose: (e) => { console.log('closed!', e.code, e.reason); process.exit(0); },
    onerror: (e) => { console.log('error!', e); process.exit(0); },
    onmessage: (m) => { console.log('msg!', JSON.stringify(m)); }
  }
}).then(session => {
  console.log('Connected');
  session.conn.send(JSON.stringify({
    clientContent: {
      turns: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      turnComplete: true
    }
  }));
}).catch(console.error);
