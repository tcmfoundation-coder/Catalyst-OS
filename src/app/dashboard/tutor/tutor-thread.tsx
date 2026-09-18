"use client";

import { useState, type FormEvent } from "react";
import type { ConversationMessageView } from "@/lib/tutor/conversations";

interface Option {
  id: string;
  label: string;
}

export interface AskParams {
  question: string;
  materialId?: string;
  courseId?: string;
}

interface TutorThreadProps {
  messages: ConversationMessageView[];
  materials: Option[];
  courses: Option[];
  isNewConversation: boolean;
  asking: boolean;
  error: string | null;
  followUpQuestion: string | null;
  onAsk: (params: AskParams) => void;
}

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

function sourceLocation(source: ConversationMessageView["sources"][number]): string | null {
  const parts = [
    source.page !== null ? `Page ${source.page}` : null,
    source.slide !== null ? `Slide ${source.slide}` : null,
    source.heading ? `"${source.heading}"` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(", ") : null;
}

function materialLabel(materials: Option[], id: string): string {
  return materials.find((material) => material.id === id)?.label ?? "your uploaded material";
}

/**
 * Purely presentational: all conversation state lives in tutor-shell.tsx.
 * The material/course pickers only appear for a brand-new conversation's
 * first message — a follow-up has no selectors of its own and inherits
 * the conversation's original scope server-side (see service.ts).
 */
export function TutorThread({
  messages,
  materials,
  courses,
  isNewConversation,
  asking,
  error,
  followUpQuestion,
  onAsk,
}: TutorThreadProps) {
  const [question, setQuestion] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [courseId, setCourseId] = useState("");

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || asking) return;
    onAsk({ question: trimmed, materialId: materialId || undefined, courseId: courseId || undefined });
    setQuestion("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit(question);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !asking && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
            {isNewConversation ? "Ask a question below to start this conversation." : "Select a conversation."}
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                message.role === "user" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              {message.role === "assistant" && message.retrievalStatus === "no_relevant_sources" && (
                <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  No relevant material was found for this question — this answer is from general
                  knowledge, not your uploaded notes.
                </p>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.role === "assistant" && message.sources.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</p>
                  <ul className="space-y-1">
                    {message.sources.map((source) => {
                      const location = sourceLocation(source);
                      return (
                        <li key={source.chunkId} className="text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{materialLabel(materials, source.materialId)}</span>
                          {location && <span> — {location}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {asking && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
        {isNewConversation && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="materialId" className="block text-xs font-medium text-slate-600">
                Material <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select
                id="materialId"
                value={materialId}
                onChange={(event) => setMaterialId(event.target.value)}
                disabled={asking}
                className={inputClassName}
              >
                <option value="">All my materials</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="courseId" className="block text-xs font-medium text-slate-600">
                Course <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select
                id="courseId"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={asking}
                className={inputClassName}
              >
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!asking && followUpQuestion && (
          <button
            type="button"
            onClick={() => submit(followUpQuestion)}
            className="mb-2 block w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-sm text-indigo-700 transition hover:bg-indigo-100"
          >
            <span className="font-medium">Check your understanding:</span> {followUpQuestion}
          </button>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={asking}
            required
            maxLength={2000}
            rows={2}
            placeholder={isNewConversation ? "e.g. What is RAM?" : "Ask a follow-up..."}
            className={`${inputClassName} mt-0 flex-1`}
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {asking ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}
