import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/divi";

mongoose.set('bufferCommands', false);

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    if (!process.env.MONGODB_URI) {
      console.warn("MONGODB_URI is missing, using local default. This will fail in production.");
    }
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}
