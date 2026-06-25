import { GoogleGenAI, Modality } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
aiClient.live.connect({
  model: "gemini-3.1-flash-live-preview",
  config: { responseModalities: [Modality.AUDIO] },
  callbacks: {
    onmessage: (m) => { console.log('msg!'); },
    onclose: (e) => { console.log('close', e.code, e.reason); process.exit(0); },
    onerror: (e) => { console.log('error', e); process.exit(0); }
  }
}).then(session => {
  console.log("Connected");
  session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Hello" }] }], turnComplete: true });
}).catch(console.error);
