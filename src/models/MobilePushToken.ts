import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IMobilePushToken {
  userId: Types.ObjectId;
  token: string;
  platform: "android" | "ios";
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MobilePushTokenSchema = new Schema<IMobilePushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

MobilePushTokenSchema.index({ userId: 1, platform: 1 });

export const MobilePushToken: Model<IMobilePushToken> =
  models.MobilePushToken ?? model<IMobilePushToken>("MobilePushToken", MobilePushTokenSchema);
