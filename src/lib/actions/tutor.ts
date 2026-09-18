"use server";

import { requireUserId } from "@/lib/dal";
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
  type ConversationDetail,
  type ConversationSummary,
} from "@/lib/tutor/conversations";
import { askTutor } from "@/lib/tutor/service";
import type { TutorResult } from "@/lib/tutor/types";

export type AskTutorInput = {
  question: string;
  materialId?: string;
  courseId?: string;
  conversationId?: string;
};

/**
 * The one server boundary the Tutor UI calls to ask a question. The
 * authenticated user is established here, from the session — never from
 * anything the client sends — and threaded into askTutor(), which
 * verifies conversationId ownership and threads userId through
 * RetrievalService/AcademicContextProvider so a request can only ever
 * touch this user's own conversations and materials.
 */
export async function askTutorAction(input: AskTutorInput): Promise<TutorResult> {
  const userId = await requireUserId();
  return askTutor(userId, input);
}

export async function listConversationsAction(): Promise<ConversationSummary[]> {
  const userId = await requireUserId();
  return listConversations(userId);
}

/**
 * Returns null both when conversationId doesn't exist and when it belongs
 * to another user — the UI treats both as "conversation not found" and
 * never learns which case it was (see findOwnedConversation's comment).
 */
export async function getConversationAction(conversationId: string): Promise<ConversationDetail | null> {
  const userId = await requireUserId();
  return getConversation(userId, conversationId);
}

export async function deleteConversationAction(conversationId: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const ok = await deleteConversation(userId, conversationId);
  return { ok };
}

export async function renameConversationAction(conversationId: string, title: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const ok = await renameConversation(userId, conversationId, title);
  return { ok };
}
