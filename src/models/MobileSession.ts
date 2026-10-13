import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IMobileSession {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MobileSessionSchema = new Schema<IMobileSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// MongoDB removes expired records asynchronously; every lookup also checks the
// expiry value, so the TTL monitor is only storage cleanup, never auth logic.
MobileSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MobileSession: Model<IMobileSession> =
  models.MobileSession ?? model<IMobileSession>("MobileSession", MobileSessionSchema);
