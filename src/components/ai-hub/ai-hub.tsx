"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { askTutorAction } from "@/lib/actions/tutor";
import { getAIPreferencesAction, type AIPreferences } from "@/lib/actions/ai-settings";
import type { ConversationMessageView } from "@/lib/tutor/conversations";
import type { TutorResult } from "@/lib/tutor/types";

function CompanionAvatar({ className = "" }: { className?: string }) {
  const gradientId = `ai-hub-avatar-gradient-${useId().replaceAll(":", "")}`;

  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={`ai-hub-avatar ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ebf3da" />
          <stop offset="50%" stopColor="#b8d7a5" />
          <stop offset="100%" stopColor="#7fa55a" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="58" r="26" fill={`url(#${gradientId})`} opacity="0.95" />
      <path
        d="M32 50c5-22 18-32 28-32 18 0 30 18 30 34 0 9-5 17-12 22-8 6-12 8-18 8-9 0-19-5-28-15"
        fill="#1a2018"
        opacity="0.82"
      />
      <circle cx="49" cy="58" r="3" fill="#101612" />
      <circle cx="71" cy="58" r="3" fill="#101612" />
      <path
        d="M49 72c4 6 18 6 22 0"
        stroke="#101612"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M28 98c8-10 22-17 32-17s23 7 32 17" fill="#9dbd7b" opacity="0.7" />
    </svg>
  );
}

export function AIHub() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessageView[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voicePreferences, setVoicePreferences] = useState<AIPreferences>({
    voiceName: "", voiceRate: 1, voicePitch: 1, autoSpeak: false,
    responseLength: "balanced", tutorTone: "supportive",
  });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);

  const localMessageId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    let active = true;
    void getAIPreferencesAction().then((preferences) => {
      if (active) setVoicePreferences(preferences);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setError("Speech playback is not supported by this browser. You can still read the reply here.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voicePreferences.voiceRate;
    utterance.pitch = voicePreferences.voicePitch;
    const selectedVoice = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === voicePreferences.voiceName);
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (isOpen) {
      messageInputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages, asking, error, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        launcherRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const closePanel = () => {
    setIsOpen(false);
    launcherRef.current?.focus();
  };

  const startNewConversation = () => {
    if (requestInFlightRef.current) return;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setInput("");
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setAsking(true);
    setError(null);
    setMessages((current) => [
      ...current,
      {
        id: localMessageId(),
        role: "user",
        content: question,
        sources: [],
        retrievalStatus: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const request = askTutorAction({
        question,
        conversationId: conversationId ?? undefined,
      });
      setInput("");

      const result: TutorResult = await request;
      if (result.conversationId) setConversationId(result.conversationId);

      if (!result.ok) {
        setError(result.error);
        if (voicePreferences.autoSpeak) speak(result.error);
        setInput((current) => current || question);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: localMessageId(),
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          retrievalStatus: result.retrievalStatus,
          createdAt: new Date().toISOString(),
        },
      ]);
      if (voicePreferences.autoSpeak) speak(result.answer);
    } catch {
      const message = "Sorry, something went wrong generating a response. Please try again.";
      setError(message);
      if (voicePreferences.autoSpeak) speak(message);
      setInput((current) => current || question);
    } finally {
      requestInFlightRef.current = false;
      setAsking(false);
    }
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex max-w-5xl justify-end px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8 lg:pb-6">
          <button
            ref={launcherRef}
            type="button"
            aria-label={isOpen ? "Close AI Hub" : "Open AI Hub"}
            aria-expanded={isOpen}
            aria-controls="catalysts-ai-hub-panel"
            onClick={() => setIsOpen((open) => !open)}
            className="ai-hub-launcher pointer-events-auto group relative flex h-14 w-14 items-center justify-center rounded-full border border-[#a8b89c]/40 bg-[#121711]/90 text-foreground shadow-[0_0_0_1px_rgba(168,184,156,0.15),0_18px_50px_rgba(13,18,13,0.8)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-16 sm:w-16"
          >
            <span className="ai-hub-avatar-ring absolute inset-0 rounded-full" aria-hidden="true" />
            <span className="ai-hub-avatar-sheen absolute inset-1 rounded-full" aria-hidden="true" />
            <CompanionAvatar className="relative h-9 w-9 drop-shadow-[0_8px_18px_rgba(184,214,157,0.35)] sm:h-10 sm:w-10" />
            <span
              className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-[#111a11] bg-accent shadow-[0_0_10px_rgba(125,159,94,0.45)]"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <section
          id="catalysts-ai-hub-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ai-hub-title"
          className="ai-hub-panel fixed inset-x-2 bottom-[calc(9rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-h-[calc(100dvh-10rem-env(safe-area-inset-bottom,0px))] w-auto max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-[#b6c59f]/20 bg-[#121711]/95 shadow-[0_20px_60px_rgba(7,10,7,0.7)] backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-[calc(9rem+env(safe-area-inset-bottom,0px))] sm:w-[min(24rem,calc(100vw-3rem))] lg:bottom-24"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#b8c7a7]/10 bg-[linear-gradient(180deg,rgba(159,186,125,0.12),rgba(18,23,17,0.2))] px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d7e5c8]/15 bg-[#1b2518]">
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(183,219,145,0.45),transparent_45%)]"
                  aria-hidden="true"
                />
                <CompanionAvatar className="relative h-8 w-8" />
              </div>
              <div className="min-w-0">
                <h2
                  id="ai-hub-title"
                  className="truncate text-sm font-semibold text-foreground"
                >
                  Catalysts AI
                </h2>
                <p className="flex items-center gap-1.5 text-[10px] tracking-wide text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#99a884]" aria-hidden="true" />
                  AI VOICE OUTPUT
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={startNewConversation}
              disabled={asking}
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-[#b7c5a8]/15 bg-[#1c241c]/80 px-2.5 text-[11px] font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              New chat
            </button>

            <button
              type="button"
              onClick={closePanel}
              aria-label="Close AI Hub panel"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#b7c5a8]/15 bg-[#1c241c]/80 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div
            ref={conversationRef}
            className="min-h-24 flex-1 space-y-3 overflow-y-auto px-4 py-4"
            aria-label="Conversation"
            aria-live="polite"
          >
            {messages.length === 0 && !asking && (
              <p className="py-6 text-center text-xs leading-relaxed text-muted">
                Send a message to start a conversation with your tutor.
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#b7c5a8]/15 bg-[#1b2518]">
                    <CompanionAvatar className="h-6 w-6" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                    message.role === "user"
                      ? "rounded-tr-sm bg-accent text-[#101510]"
                      : "rounded-tl-sm border border-[#b7c5a8]/10 bg-[#1a2018]/90 text-[#d5dacd]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === "assistant" && (
                    <button type="button" onClick={() => speak(message.content)} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#b7c5a8]/15 px-2 text-[10px] text-muted hover:text-foreground" aria-label="Speak this reply">
                      <span aria-hidden="true">◖))</span> Speak
                    </button>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex items-start gap-2.5" role="status">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#b7c5a8]/15 bg-[#1b2518]">
                  <CompanionAvatar className="h-6 w-6" />
                </div>
                <p className="rounded-2xl rounded-tl-sm border border-[#b7c5a8]/10 bg-[#1a2018]/90 px-3 py-2.5 text-xs text-muted">
                  Thinking…
                </p>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-[#b56a58]/25 bg-[#b56a58]/[0.08] px-3 py-2 text-xs leading-relaxed text-[#e6b7ad]"
              >
                {error} Your message is still in the composer so you can retry.
              </p>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="shrink-0 space-y-2 border-t border-[#b7c5a8]/10 bg-[#111711]/95 p-3"
          >
            <label htmlFor="ai-hub-text-input" className="sr-only">
              Message to the AI Hub
            </label>
            <textarea
              ref={messageInputRef}
              id="ai-hub-text-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={asking}
              rows={2}
              placeholder="Type a message..."
              className="w-full resize-none rounded-xl border border-[#b7c5a8]/15 bg-[#101512] px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                aria-label="Voice capture unavailable"
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#b7c5a8]/15 bg-[#1b221b] px-3 text-xs font-medium text-muted opacity-60"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                  <rect x="7" y="2.5" width="6" height="10" rx="3" fill="currentColor" />
                  <path
                    d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5m-3 0h6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Voice
              </button>
              <button
                type="submit"
                disabled={asking || !input.trim()}
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-accent px-3 text-sm font-medium text-[#0f130d] transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {asking ? "Thinking…" : "Send"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
