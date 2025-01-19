import mongoose, { Document, Schema } from 'mongoose';

export interface IPoll extends Document {
  betId: mongoose.Types.ObjectId;
  pollMessageId: string;
  groupId: string;
  votes: Map<string, number>; // userId -> optionNumber
  createdAt: Date;
  resolved: boolean;
  aiOption?: number; // The option suggested by AI
  processingStarted?: Date;
  processingLock?: string;
  isManualPoll: boolean;
}

const pollSchema = new mongoose.Schema<IPoll>({
  betId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bet', required: true },
  pollMessageId: { type: String, required: true },
  groupId: { type: String, required: true },
  votes: { type: Map, of: Number, default: new Map() },
  createdAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  aiOption: { type: Number },
  processingStarted: { type: Date },
  processingLock: { type: String },
  isManualPoll: { type: Boolean, required: true, default: false }
});

// Add index for processing lock and timeout
pollSchema.index({ processingLock: 1, processingStarted: 1 });

const Poll = mongoose.model<IPoll>('Poll', pollSchema);
export default Poll;
