import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * hnswlib-node requires unique integer labels, not ObjectId strings, for
 * every vector it indexes. This is a standard MongoDB auto-increment
 * counter (a dedicated single-document-per-name collection, incremented
 * atomically via findOneAndUpdate + $inc) used to assign
 * MaterialChunk.vectorLabel values that are unique across the whole
 * vector index, not just per material.
 */
export interface ICounter extends Omit<Document, "_id"> {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter: Model<ICounter> = models.Counter ?? model<ICounter>("Counter", CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const result = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  ).lean();
  return result.seq;
}
