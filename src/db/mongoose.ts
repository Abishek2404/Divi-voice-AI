import mongoose from 'mongoose';

// Disable buffering so operations fail immediately instead of hanging and timing out
mongoose.set('bufferCommands', false);

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI environment variable is missing.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Fail fast if IP is not whitelisted
    });
    console.log('Successfully connected to MongoDB Atlas');
  } catch (error: any) {
    console.error('Failed to connect to MongoDB Atlas. Ensure IP is whitelisted (0.0.0.0/0). Error:', error.message);
  }
}
