import mongoose from 'mongoose';

export interface IPoll {
  betId: mongoose.Types.ObjectId;
  pollMessageId: string;
  groupId: string;
  votes: Map<string, number>; // userId -> optionNumber
  createdAt: Date;
  resolved: boolean;
  aiOption?: number; // The option suggested by AI
}

const pollSchema = new mongoose.Schema<IPoll>({
  betId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bet', required: true },
  pollMessageId: { type: String, required: true },
  groupId: { type: String, required: true },
  votes: { type: Map, of: Number, default: new Map() },
  createdAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  aiOption: { type: Number }
});

const Poll = mongoose.model<IPoll>('Poll', pollSchema);
export default Poll;
