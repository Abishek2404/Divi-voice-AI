import mongoose, { Schema, Document } from 'mongoose';

// Users
export interface IUser extends Document {
  userId: string;
  name?: string;
  age?: number;
  birthday?: string;
  location?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  userId: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  age: { type: Number },
  birthday: { type: String },
  location: { type: String },
  email: { type: String },
}, { timestamps: true });

export const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

// Memories
export interface IMemory extends Document {
  userId: string;
  category: string;
  key: string;
  value: string;
  content?: string;
  importance?: number;
  embedding?: number[];
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<IMemory>({
  userId: { type: String, required: true, index: true },
  category: { type: String, default: 'fact', index: true },
  key: { type: String, required: true, index: true },
  value: { type: String, required: true },
  content: { type: String },
  importance: { type: Number, default: 10 },
  embedding: { type: [Number], default: [] },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

export const Memory = (mongoose.models.Memory as mongoose.Model<IMemory>) || mongoose.model<IMemory>('Memory', MemorySchema);

// Conversations
export interface IConversation extends Document {
  sessionId: string;
  userId: string;
  summary: string;
  timestamp: Date;
}

const ConversationSchema = new Schema<IConversation>({
  sessionId: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  summary: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const Conversation = (mongoose.models.Conversation as mongoose.Model<IConversation>) || mongoose.model<IConversation>('Conversation', ConversationSchema);

// Relationships
export interface IRelationship extends Document {
  userId: string;
  personName: string;
  relationshipType: string;
  notes: string;
  importance: number;
}

const RelationshipSchema = new Schema<IRelationship>({
  userId: { type: String, required: true, index: true },
  personName: { type: String, required: true },
  relationshipType: { type: String, required: true },
  notes: { type: String },
  importance: { type: Number, default: 5 },
}, { timestamps: true });

export const Relationship = (mongoose.models.Relationship as mongoose.Model<IRelationship>) || mongoose.model<IRelationship>('Relationship', RelationshipSchema);

// Projects
export interface IProject extends Document {
  userId: string;
  projectName: string;
  description: string;
  status: string;
  lastMentioned: Date;
}

const ProjectSchema = new Schema<IProject>({
  userId: { type: String, required: true, index: true },
  projectName: { type: String, required: true },
  description: { type: String },
  status: { type: String },
  lastMentioned: { type: Date, default: Date.now },
}, { timestamps: true });

export const Project = (mongoose.models.Project as mongoose.Model<IProject>) || mongoose.model<IProject>('Project', ProjectSchema);
