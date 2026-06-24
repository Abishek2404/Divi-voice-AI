# Divi AI Assistant

Divi is a full-stack, real-time voice-to-voice AI companion with a charming personality, witty humor, and powerful long-term memory capabilities. It leverages the Gemini Live API for low-latency voice interactions and a background cognitive processor to seamlessly extract and persist user facts and preferences over time.

## Key Features

- **Real-Time Voice Interactions:** Connects via WebSocket to the Gemini Live API for fluid, two-way audio streaming.
- **Durable Long-Term Memory:** 
  - **Auto-Extraction:** A background cognitive processor automatically summarizes sessions and extracts identity facts, preferences, and goals from dialogue logs.
  - **Memory Vault UI:** An integrated dashboard to visualize, search, manually add, edit, and delete memories.
- **Secure Full-Stack Architecture:** 
  - Client-side React interface tailored with Tailwind CSS.
  - Server-side Express backend to securely route API calls, manage database interactions, and protect the Gemini API key.
- **User Authentication:** Firebase Auth integration ensures personalized and secure memory isolation.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Lucide React, Recharts
- **Backend:** Node.js, Express, TypeScript (`tsx` for local dev, `esbuild` for production)
- **Database:** MongoDB (via Mongoose)
- **AI Capabilities:** Google GenAI SDK (`@google/genai`)

## Getting Started

### Prerequisites

You will need the following accounts and tools:
- [Node.js](https://nodejs.org/)
- A [MongoDB](https://www.mongodb.com/) cluster or local instance
- A [Google Gemini API Key](https://aistudio.google.com/)
- A [Firebase](https://firebase.google.com/) Project (for Authentication)

### 1. Environment Setup

Create a `.env` file in the root directory based on the provided `.env.example` and fill in your secure credentials:

```env
# Gemini API Key (Required for Live interactions and Memory Extraction)
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Connection String (Required for Durable Memory Storage)
MONGODB_URI=your_mongodb_connection_string
```

### 2. Firebase Configuration

Ensure you have a `firebase-applet-config.json` file in the root directory with your Firebase project details for Authentication. It should look like this:

```json
{
  "projectId": "your-project-id",
  "appId": "your-app-id",
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com"
}
```

### 3. Install Dependencies

Run the following command to install the required packages:

```bash
npm install
```

### 4. Run the Development Server

Start both the Vite frontend and the Express backend concurrently:

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### 5. Build for Production

To create a bundled production build:

```bash
npm run build
```

This command will output the frontend assets to the `dist` directory and compile the server entry point to `dist/server.cjs`. You can then start the production server with:

```bash
npm run start
```

## Memory System Architecture

Divi's memory works in two stages:
1. **Live Session:** The `AudioStreamer` captures both user and AI dialogue throughout the session.
2. **Extraction:** Once a session ends, `MemoryService`'s `runExtractionAndSync` is triggered. It uses Gemini to analyze the transcript, detect new facts or preferences, and store them securely in the MongoDB `UserMemories` collection. This context is then injected into future system prompts so Divi never forgets your key details.

## Deployment

Because Divi uses the **Gemini Live API via WebSockets** and requires a running Node.js server, we have separated the frontend and backend setup so you can host the UI on Vercel and the backend on a WebSocket-compatible host like Railway or Render.

### Step 1: Deploy the Backend (Railway / Render / Fly.io)

1. Push your repository to GitHub.
2. Log into [Railway](https://railway.app/) or [Render](https://render.com/).
3. Create a new Web Service from your repository.
4. Set the build command: `npm run build`
5. Set the start command: `npm run start`
6. Add your environment variables (`GEMINI_API_KEY` and `MONGODB_URI`).
7. Once deployed, copy your backend URL (e.g., `https://divi-backend.up.railway.app`).

### Step 2: Deploy the Frontend to Vercel

The project has been configured to dynamically point to an external backend using `import.meta.env.VITE_BACKEND_URL`. A `vercel.json` file is already included for SPA routing.

1. Log into [Vercel](https://vercel.com/) and create a new project from your repository.
2. In the **Environment Variables** settings before deploying, add:
   - `VITE_BACKEND_URL`: Set this to your backend URL from Step 1 (e.g., `https://divi-backend.up.railway.app`).
3. Click **Deploy**.

Vercel will build the Vite frontend (`dist` folder) and host it securely. The frontend will automatically route its REST API and WebSocket connections to your dedicated backend!
