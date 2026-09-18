import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { TutorConversation } from "@/models/TutorConversation";
import { TutorMessage } from "@/models/TutorMessage";
import { User } from "@/models/User";
import {
  deleteConversation,
  findOwnedConversation,
  getConversation,
  listConversations,
  renameConversation,
} from "./conversations";

/**
 * Real MongoDB — no mocks. Verifies the CRUD + lifecycle operations and,
 * critically, that ownership is enforced at the database layer: a
 * conversationId or messageId alone, however it arrived, is never enough
 * to read or change another user's data.
 */
describe("tutor/conversations — real Mongo CRUD + ownership", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    await connectToDatabase();
    const stamp = Date.now();
    const userA = await User.create({ name: "Conv Test A", email: `conv-a-${stamp}@example.com`, passwordHash: "x" });
    const userB = await User.create({ name: "Conv Test B", email: `conv-b-${stamp}@example.com`, passwordHash: "x" });
    userAId = userA._id.toString();
    userBId = userB._id.toString();
  });

  afterAll(async () => {
    await TutorMessage.deleteMany({ userId: { $in: [userAId, userBId] } });
    await TutorConversation.deleteMany({ userId: { $in: [userAId, userBId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  });

  it("creates a conversation and lists it for its owner", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "What is RAM" });
    const list = await listConversations(userAId);
    expect(list.some((c) => c.id === conversation._id.toString())).toBe(true);
    await conversation.deleteOne();
  });

  it("lists only the authenticated user's conversations, most recently updated first", async () => {
    const a1 = await TutorConversation.create({ userId: userAId, title: "A1" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const a2 = await TutorConversation.create({ userId: userAId, title: "A2" });
    const b1 = await TutorConversation.create({ userId: userBId, title: "B1" });

    const listA = await listConversations(userAId);
    expect(listA.map((c) => c.id)).toContain(a1._id.toString());
    expect(listA.map((c) => c.id)).toContain(a2._id.toString());
    expect(listA.map((c) => c.id)).not.toContain(b1._id.toString());
    // Most recently updated first.
    expect(listA.findIndex((c) => c.id === a2._id.toString())).toBeLessThan(
      listA.findIndex((c) => c.id === a1._id.toString()),
    );

    await TutorConversation.deleteMany({ _id: { $in: [a1._id, a2._id, b1._id] } });
  });

  it("saves and retrieves messages in chronological order", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "RAM vs ROM" });
    await TutorMessage.create({ conversationId: conversation._id, userId: userAId, role: "user", content: "What is RAM?" });
    await TutorMessage.create({
      conversationId: conversation._id,
      userId: userAId,
      role: "assistant",
      content: "RAM is volatile memory.",
      sources: [{ chunkId: "chunk1", materialId: "mat1", courseId: null, page: 3, slide: null, heading: "Memory", score: 0.9 }],
      retrievalStatus: "ok",
    });

    const detail = await getConversation(userAId, conversation._id.toString());
    expect(detail).not.toBeNull();
    expect(detail?.messages).toHaveLength(2);
    expect(detail?.messages[0].role).toBe("user");
    expect(detail?.messages[1].role).toBe("assistant");
    expect(detail?.messages[1].sources[0].chunkId).toBe("chunk1");
    expect(detail?.messages[1].retrievalStatus).toBe("ok");

    await TutorMessage.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();
  });

  it("deletes a conversation and cascades its messages", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "To delete" });
    await TutorMessage.create({ conversationId: conversation._id, userId: userAId, role: "user", content: "Hello" });

    const deleted = await deleteConversation(userAId, conversation._id.toString());
    expect(deleted).toBe(true);

    const stillExists = await TutorConversation.findById(conversation._id);
    expect(stillExists).toBeNull();
    const orphanMessages = await TutorMessage.find({ conversationId: conversation._id });
    expect(orphanMessages).toHaveLength(0);
  });

  it("renames a conversation", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "Old title" });
    const renamed = await renameConversation(userAId, conversation._id.toString(), "New title");
    expect(renamed).toBe(true);
    const reloaded = await TutorConversation.findById(conversation._id);
    expect(reloaded?.title).toBe("New title");
    await conversation.deleteOne();
  });

  it("rejects a rename to an empty/whitespace-only title without touching the stored title", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "Keep me" });
    const renamed = await renameConversation(userAId, conversation._id.toString(), "   ");
    expect(renamed).toBe(false);
    const reloaded = await TutorConversation.findById(conversation._id);
    expect(reloaded?.title).toBe("Keep me");
    await conversation.deleteOne();
  });

  // --- Ownership enforcement ---

  it("SECURITY: a user cannot retrieve another user's conversation by ID", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "User A's private conversation" });
    await TutorMessage.create({ conversationId: conversation._id, userId: userAId, role: "user", content: "secret question" });

    const asOwner = await getConversation(userAId, conversation._id.toString());
    expect(asOwner).not.toBeNull();

    const asIntruder = await getConversation(userBId, conversation._id.toString());
    expect(asIntruder).toBeNull();

    const foundByIntruder = await findOwnedConversation(userBId, conversation._id.toString());
    expect(foundByIntruder).toBeNull();

    await TutorMessage.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();
  });

  it("SECURITY: a user cannot delete another user's conversation", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "User A's conversation" });

    const deletedByIntruder = await deleteConversation(userBId, conversation._id.toString());
    expect(deletedByIntruder).toBe(false);

    const stillExists = await TutorConversation.findById(conversation._id);
    expect(stillExists).not.toBeNull();

    await conversation.deleteOne();
  });

  it("SECURITY: a user cannot rename another user's conversation", async () => {
    const conversation = await TutorConversation.create({ userId: userAId, title: "Original" });

    const renamedByIntruder = await renameConversation(userBId, conversation._id.toString(), "Hijacked title");
    expect(renamedByIntruder).toBe(false);

    const reloaded = await TutorConversation.findById(conversation._id);
    expect(reloaded?.title).toBe("Original");

    await conversation.deleteOne();
  });

  it("SECURITY: a nonexistent conversationId returns null/false identically to a foreign one, preventing enumeration", async () => {
    const randomId = new Types.ObjectId().toString();
    expect(await findOwnedConversation(userAId, randomId)).toBeNull();
    expect(await getConversation(userAId, randomId)).toBeNull();
    expect(await deleteConversation(userAId, randomId)).toBe(false);
    expect(await renameConversation(userAId, randomId, "x")).toBe(false);
  });

  it("SECURITY: a malformed conversationId is rejected without throwing a database cast error", async () => {
    await expect(findOwnedConversation(userAId, "not-a-valid-object-id")).resolves.toBeNull();
    await expect(getConversation(userAId, "not-a-valid-object-id")).resolves.toBeNull();
    await expect(deleteConversation(userAId, "not-a-valid-object-id")).resolves.toBe(false);
  });

  it("SECURITY: a message belonging to another user's conversation is never returned even if the conversationId leaks", async () => {
    // Simulates a corrupted/foreign message row: same conversationId as
    // user A's conversation, but a different userId on the message itself.
    // getConversation must filter messages by BOTH conversationId AND
    // userId, so this message must never surface for either user.
    const conversation = await TutorConversation.create({ userId: userAId, title: "Conversation" });
    await TutorMessage.create({ conversationId: conversation._id, userId: userAId, role: "user", content: "real message" });
    await TutorMessage.create({ conversationId: conversation._id, userId: userBId, role: "user", content: "foreign message" });

    const detail = await getConversation(userAId, conversation._id.toString());
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0].content).toBe("real message");

    await TutorMessage.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();
  });
});
