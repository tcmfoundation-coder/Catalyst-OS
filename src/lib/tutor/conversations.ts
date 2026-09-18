import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { TutorConversation, type ITutorConversation } from "@/models/TutorConversation";
import { TutorMessage, type ITutorMessage, type ITutorMessageSource } from "@/models/TutorMessage";
import type { RetrievalStatus } from "@/lib/ai/types";

/**
 * Conversation lifecycle + ownership enforcement. Every function here
 * takes `userId` as its first argument and filters by it at the database
 * layer — a conversationId alone, however it arrived, is never enough to
 * read or change a conversation. Messages additionally carry their own
 * denormalized userId (see TutorMessage's comment), so a message lookup
 * enforces ownership independently of the conversation lookup too.
 */

export interface ConversationSummary {
  id: string;
  title: string;
  courseId: string | null;
  materialId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: ITutorMessageSource[];
  retrievalStatus: RetrievalStatus | null;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessageView[];
}

function toSummary(conversation: ITutorConversation): ConversationSummary {
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    courseId: conversation.courseId ? conversation.courseId.toString() : null,
    materialId: conversation.materialId ? conversation.materialId.toString() : null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function toMessageView(message: ITutorMessage): ConversationMessageView {
  return {
    id: message._id.toString(),
    role: message.role,
    content: message.content,
    sources: message.sources,
    retrievalStatus: message.retrievalStatus,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * The one ownership check every other operation on an existing
 * conversation builds on. Returns null for "doesn't exist" and "exists
 * but belongs to someone else" identically — a caller can't distinguish
 * the two, which is what stops conversationId enumeration from leaking
 * which IDs are real.
 */
export async function findOwnedConversation(userId: string, conversationId: string): Promise<ITutorConversation | null> {
  if (!Types.ObjectId.isValid(conversationId)) return null;
  await connectToDatabase();
  return TutorConversation.findOne({ _id: conversationId, userId });
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  await connectToDatabase();
  const conversations = await TutorConversation.find({ userId }).sort({ updatedAt: -1 });
  return conversations.map(toSummary);
}

export async function getConversation(userId: string, conversationId: string): Promise<ConversationDetail | null> {
  const conversation = await findOwnedConversation(userId, conversationId);
  if (!conversation) return null;

  // Defense in depth: filtered by userId again here, independent of the
  // conversation-level check above (see TutorMessage's own comment).
  const messages = await TutorMessage.find({ conversationId: conversation._id, userId }).sort({ createdAt: 1 });

  return { ...toSummary(conversation), messages: messages.map(toMessageView) };
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const conversation = await findOwnedConversation(userId, conversationId);
  if (!conversation) return false;

  await TutorMessage.deleteMany({ conversationId: conversation._id, userId });
  await conversation.deleteOne();
  return true;
}

export interface RecentMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The last `limit` messages of a conversation, in chronological order —
 * fetched with the ownership filter applied at the query itself (not via
 * findOwnedConversation + a second round trip), since this is called on
 * every single ask and the {conversationId, createdAt} index already
 * makes "give me the tail" cheap. Feeds directly into
 * conversation-context.ts's boundConversationHistory(), which applies the
 * character-budget half of the policy on top of this message-count half.
 */
export async function listRecentMessages(userId: string, conversationId: string, limit: number): Promise<RecentMessage[]> {
  await connectToDatabase();
  const recent = await TutorMessage.find({ conversationId, userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select({ role: 1, content: 1, _id: 0 })
    .lean();
  return recent.reverse() as RecentMessage[];
}

export async function renameConversation(userId: string, conversationId: string, title: string): Promise<boolean> {
  const trimmed = title.trim();
  if (!trimmed) return false;

  const conversation = await findOwnedConversation(userId, conversationId);
  if (!conversation) return false;

  conversation.title = trimmed.slice(0, 200);
  await conversation.save();
  return true;
}
