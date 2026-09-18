"use client";

import { useEffect, useState } from "react";
import { askTutorAction, deleteConversationAction, getConversationAction, listConversationsAction } from "@/lib/actions/tutor";
import type { ConversationMessageView, ConversationSummary } from "@/lib/tutor/conversations";
import { ConversationList } from "./conversation-list";
import { TutorThread, type AskParams } from "./tutor-thread";

interface Option {
  id: string;
  label: string;
}

interface TutorShellProps {
  materials: Option[];
  courses: Option[];
  initialConversations: ConversationSummary[];
}

function localMessageId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const GENERIC_ERROR = "Sorry, something went wrong generating a response. Please try again.";

export function TutorShell({ materials, courses, initialConversations }: TutorShellProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<ConversationMessageView[]>([]);
  // Starts true when there's an initial selection to load, so the mount
  // effect below never needs to set it synchronously itself — it only
  // ever flips it back to false, from inside the fetch's own callback.
  const [loadingConversation, setLoadingConversation] = useState(initialConversations.length > 0);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("thread");

  async function fetchConversation(id: string) {
    try {
      const detail = await getConversationAction(id);
      if (!detail) {
        setError("This conversation could not be found.");
        setActiveConversationId(null);
        setMessages([]);
        return;
      }
      setMessages(detail.messages);
    } catch {
      setError("Failed to load this conversation.");
    } finally {
      setLoadingConversation(false);
    }
  }

  useEffect(() => {
    // Only the initial, server-provided selection needs an explicit load —
    // every later selection goes through selectConversation() below, which
    // sets its own loading state before calling fetchConversation(). The
    // lint rule below flags this as "setState in an effect" because
    // fetchConversation's body contains setState calls, but every one of
    // them runs inside its await'd callback, after the network response —
    // never synchronously during this effect — so there's no cascading
    // render, just the standard fetch-on-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeConversationId) void fetchConversation(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshConversations() {
    try {
      setConversations(await listConversationsAction());
    } catch {
      // A stale sidebar for one cycle isn't worth a hard error — the next
      // successful ask or delete will resync it.
    }
  }

  function selectConversation(id: string) {
    setActiveConversationId(id);
    setFollowUpQuestion(null);
    setError(null);
    setMobileView("thread");
    setLoadingConversation(true);
    void fetchConversation(id);
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setFollowUpQuestion(null);
    setError(null);
    setMobileView("thread");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    const result = await deleteConversationAction(id);
    if (!result.ok) {
      setError("Failed to delete this conversation.");
      return;
    }
    setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
    if (id === activeConversationId) {
      setActiveConversationId(null);
      setMessages([]);
      setFollowUpQuestion(null);
      setMobileView("list");
    }
  }

  async function handleAsk({ question, materialId, courseId }: AskParams) {
    setAsking(true);
    setError(null);
    setFollowUpQuestion(null);
    setMessages((prev) => [
      ...prev,
      { id: localMessageId(), role: "user", content: question, sources: [], retrievalStatus: null, createdAt: new Date().toISOString() },
    ]);

    try {
      const result = await askTutorAction({
        question,
        materialId,
        courseId,
        conversationId: activeConversationId ?? undefined,
      });

      if (result.conversationId) {
        if (result.conversationId !== activeConversationId) setActiveConversationId(result.conversationId);
        void refreshConversations();
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: localMessageId(),
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          retrievalStatus: result.retrievalStatus,
          createdAt: new Date().toISOString(),
        },
      ]);
      setFollowUpQuestion(result.followUpQuestion);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="grid flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[280px_1fr]">
      <div className={`${mobileView === "list" ? "flex" : "hidden"} min-h-0 flex-col lg:flex lg:border-r lg:border-slate-200`}>
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={selectConversation}
          onNew={startNewConversation}
          onDelete={handleDelete}
        />
      </div>
      <div className={`${mobileView === "thread" ? "flex" : "hidden"} min-h-0 flex-col lg:flex`}>
        <div className="flex items-center gap-2 border-b border-slate-200 p-3 lg:hidden">
          <button type="button" onClick={() => setMobileView("list")} className="text-sm font-medium text-indigo-600">
            ← Conversations
          </button>
        </div>
        {loadingConversation ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Loading conversation…</div>
        ) : (
          <TutorThread
            messages={messages}
            materials={materials}
            courses={courses}
            isNewConversation={activeConversationId === null}
            asking={asking}
            error={error}
            followUpQuestion={followUpQuestion}
            onAsk={handleAsk}
          />
        )}
      </div>
    </div>
  );
}
