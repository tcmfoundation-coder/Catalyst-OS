"use client";

import { useState, type FormEvent } from "react";
import { askTutorAction } from "@/lib/actions/tutor";
import type { AIContextSource } from "@/lib/ai/types";
import type { TutorResult } from "@/lib/tutor/types";

interface Option {
  id: string;
  label: string;
}

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

function sourceLocation(source: AIContextSource): string | null {
  const parts = [
    source.page !== null ? `Page ${source.page}` : null,
    source.slide !== null ? `Slide ${source.slide}` : null,
    source.heading ? `"${source.heading}"` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function TutorChat({ materials, courses }: { materials: Option[]; courses: Option[] }) {
  const [question, setQuestion] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<TutorResult | null>(null);

  function materialLabel(id: string): string {
    return materials.find((material) => material.id === id)?.label ?? "your uploaded material";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || asking) return;

    setAsking(true);
    setResult(null);
    try {
      const response = await askTutorAction({
        question,
        materialId: materialId || undefined,
        courseId: courseId || undefined,
      });
      setResult(response);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="question" className="block text-sm font-medium text-slate-700">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={asking}
            required
            maxLength={2000}
            rows={3}
            placeholder="e.g. What is RAM?"
            className={inputClassName}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="materialId" className="block text-sm font-medium text-slate-700">
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
            <label htmlFor="courseId" className="block text-sm font-medium text-slate-700">
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

        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {asking ? "Thinking..." : "Ask"}
        </button>
      </form>

      {asking && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Finding relevant material and preparing an answer...
        </div>
      )}

      {!asking && result?.ok && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          {result.retrievalStatus === "no_relevant_sources" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No relevant material was found in your uploaded documents for this question — the
              answer below is from general knowledge, not your own notes.
            </p>
          )}

          <p className="whitespace-pre-wrap text-sm text-slate-800">{result.answer}</p>

          {result.followUpQuestion && (
            <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Check your understanding:</span>{" "}
              {result.followUpQuestion}
            </p>
          )}

          {result.sources.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</h2>
              <ul className="space-y-2">
                {result.sources.map((source) => {
                  const location = sourceLocation(source);
                  return (
                    <li key={source.chunkId} className="text-sm text-slate-600">
                      <span className="font-medium text-slate-800">{materialLabel(source.materialId)}</span>
                      {location && <span className="text-slate-400"> — {location}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {!asking && result && !result.ok && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </p>
      )}
    </div>
  );
}
