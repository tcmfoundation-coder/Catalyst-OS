"use client";

import { useState, useTransition } from "react";
import { resetAIProviderAction, setAIProviderAction } from "@/lib/actions/ai-settings";
import type { LLMProviderName } from "@/lib/ai/provider-factory";

interface Props {
  initialSelected: LLMProviderName;
  available: LLMProviderName[];
  defaultProvider: LLMProviderName;
  labels: Record<LLMProviderName, string>;
}

export function AIProviderSettings({ initialSelected, available, defaultProvider, labels }: Props) {
  const [selected, setSelected] = useState(initialSelected);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function choose(provider: LLMProviderName) {
    const previous = selected;
    setSelected(provider);
    setMessage("");
    startTransition(async () => {
      const result = await setAIProviderAction(provider);
      if (!result.ok) {
        setMessage(result.error);
        setSelected(previous);
        return;
      }
      setMessage(`${labels[provider]} is now your active provider.`);
    });
  }

  function reset() {
    setMessage("");
    startTransition(async () => {
      await resetAIProviderAction();
      setSelected(defaultProvider);
      setMessage(`${labels[defaultProvider]} is selected by the system default.`);
    });
  }

  return (
    <fieldset disabled={pending}>
      <legend className="text-sm font-medium text-foreground">Available providers</legend>
      <p className="mt-1 text-sm text-muted">Only providers configured by your administrator appear here.</p>
      <div className="mt-4 space-y-2">
        {available.map((provider) => (
          <label key={provider} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 transition-colors ${selected === provider ? "border-accent/60 bg-accent/10" : "border-line hover:bg-surface-raised"}`}>
            <input
              type="radio"
              name="ai-provider"
              value={provider}
              checked={selected === provider}
              onChange={() => choose(provider)}
              className="accent-[var(--color-accent)]"
            />
            <span className="flex-1 text-sm font-medium text-foreground">{labels[provider]}</span>
            {selected === provider && <span className="font-mono text-[10px] tracking-wider text-accent uppercase">Active</span>}
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground">
          Use system default
        </button>
        {pending && <span className="text-sm text-muted">Saving…</span>}
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-muted">{message}</p>
    </fieldset>
  );
}
