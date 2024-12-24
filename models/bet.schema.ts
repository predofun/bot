import mongoose, { Schema, Document } from 'mongoose'

interface IBet extends Document {
  betId: string;
  title: string;
  options: string[];
  minAmount: number;
  groupId: string;
  endTime: Date;
  participants: string[];
  votes: Record<string, number>;

  resolved: boolean;
}

const BetSchema: Schema = new Schema({
  betId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  options: { type: [String], required: true },
  minAmount: { type: Number, required: true },
  groupId: { type: String, required: true },
  endTime: { type: Date, required: true },
  participants: { type: [String], default: [] },
  votes: { type: Map, of: Number, default: {} },
  resolved: { type: Boolean, default: false }
});

const Bet = mongoose.model<IBet>('Bet', BetSchema);

export default Bet