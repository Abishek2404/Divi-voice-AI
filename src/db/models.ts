import mongoose, { Schema, Document } from 'mongoose';

// Users
export interface IUser extends Document {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

const UserSchema = new Schema<IUser>({
  userId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: { type: String },
  photoURL: { type: String },
}, { timestamps: true });

export const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

// Memories
export interface IMemory extends Document {
  userId: string;
  key: string;
  value: string;
  content: string;
  category: string;
  importance?: number;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

const MemorySchema = new Schema<IMemory>({
  userId: { type: String, required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  content: { type: String },
  category: { type: String, required: true },
  importance: { type: Number, default: 10 },
}, { timestamps: true });

export const Memory = (mongoose.models.Memory as mongoose.Model<IMemory>) || mongoose.model<IMemory>('Memory', MemorySchema);

// Conversations (Messages)
export interface IConversation extends Document {
  userId: string;
  sessionId: string;
  role: string;
  message: string;
  timestamp: Date;
  createdAt?: Date;
}

const ConversationSchema = new Schema<IConversation>({
  userId: { type: String, required: true },
  sessionId: { type: String, required: true },
  role: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

export const Conversation = (mongoose.models.Conversation as mongoose.Model<IConversation>) || mongoose.model<IConversation>('Conversation', ConversationSchema);

// Conversation Summaries
export interface IConversationSummary extends Document {
  sessionId: string;
  userId: string;
  summary: string;
  createdAt?: Date;
}

const ConversationSummarySchema = new Schema<IConversationSummary>({
  sessionId: { type: String, required: true },
  userId: { type: String, required: true },
  summary: { type: String, required: true },
}, { timestamps: true });

export const ConversationSummary = (mongoose.models.ConversationSummary as mongoose.Model<IConversationSummary>) || mongoose.model<IConversationSummary>('ConversationSummary', ConversationSummarySchema);

// Sessions
export interface ISession extends Document {
  sessionId: string;
  userId: string;
  isActive: boolean;
  createdAt?: Date;
}

const SessionSchema = new Schema<ISession>({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Session = (mongoose.models.Session as mongoose.Model<ISession>) || mongoose.model<ISession>('Session', SessionSchema);
