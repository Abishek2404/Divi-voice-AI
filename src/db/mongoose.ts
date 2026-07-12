import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/divi";

mongoose.set('bufferCommands', false);

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    if (!process.env.MONGODB_URI) {
      console.warn("MONGODB_URI is missing. Server will continue with in-memory fallbacks.");
      return;
    }
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error: any) {
    console.error("MongoDB connection failed, continuing with in-memory fallback:", error?.message || String(error));
    // Do not throw; let the server activate and run with in-memory fallbacks gracefully.
  }
}
