"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  resetAIProviderAction,
  saveAIPreferencesAction,
  setAIProviderAction,
  type AIPreferences,
} from "@/lib/actions/ai-settings";
import type { LLMProviderName } from "@/lib/ai/provider-factory";

interface Props {
  initialSelected: LLMProviderName;
  available: LLMProviderName[];
  defaultProvider: LLMProviderName;
  labels: Record<LLMProviderName, string>;
  initialPreferences: AIPreferences;
}

interface SpeechVoice {
  voiceURI: string;
  name: string;
  lang: string;
}

export function AIProviderSettings({ initialSelected, available, defaultProvider, labels, initialPreferences }: Props) {
  const [selected, setSelected] = useState(initialSelected);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState(initialPreferences);
  const [voices, setVoices] = useState<SpeechVoice[]>([]);
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synthesis = window.speechSynthesis;
    const updateVoices = () => setVoices(synthesis.getVoices().map(({ voiceURI, name, lang }) => ({ voiceURI, name, lang })));
    updateVoices();
    synthesis.addEventListener("voiceschanged", updateVoices);
    return () => synthesis.removeEventListener("voiceschanged", updateVoices);
  }, []);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

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

  function updatePreference<K extends keyof AIPreferences>(key: K, value: AIPreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setPreferenceMessage("Saving preferences…");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await saveAIPreferencesAction(next);
        setPreferenceMessage(result.ok ? "AI preferences saved." : result.error);
      });
    }, 350);
  }

  function previewVoice() {
    if (!("speechSynthesis" in window)) {
      setPreferenceMessage("Speech playback is not supported by this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello, I’m Catalyst. Your AI voice settings are ready.");
    utterance.rate = preferences.voiceRate;
    utterance.pitch = preferences.voicePitch;
    const voice = window.speechSynthesis.getVoices().find((item) => item.voiceURI === preferences.voiceName);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="space-y-8">
      <fieldset disabled={pending}>
        <legend className="text-sm font-medium text-foreground">AI provider</legend>
        <p className="mt-1 text-sm text-muted">Only providers configured by your administrator appear here.</p>
        <div className="mt-4 space-y-2">
          {available.map((provider) => (
            <label key={provider} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 transition-colors ${selected === provider ? "border-accent/60 bg-accent/10" : "border-line hover:bg-surface-raised"}`}>
              <input type="radio" name="ai-provider" value={provider} checked={selected === provider} onChange={() => choose(provider)} className="accent-[var(--color-accent)]" />
              <span className="flex-1 text-sm font-medium text-foreground">{labels[provider]}</span>
              {selected === provider && <span className="font-mono text-[10px] tracking-wider text-accent uppercase">Active</span>}
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={reset} className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground">Use system default</button>
          {pending && <span className="text-sm text-muted">Saving…</span>}
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-muted">{message}</p>
      </fieldset>

      <fieldset disabled={pending} className="border-t border-line pt-6">
        <legend className="text-sm font-medium text-foreground">Response settings</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">Answer length
            <select value={preferences.responseLength} onChange={(event) => updatePreference("responseLength", event.target.value as AIPreferences["responseLength"])} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-foreground">
              <option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option>
            </select>
          </label>
          <label className="text-sm text-muted">Tutor style
            <select value={preferences.tutorTone} onChange={(event) => updatePreference("tutorTone", event.target.value as AIPreferences["tutorTone"])} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-foreground">
              <option value="supportive">Supportive guide</option><option value="direct">Direct and focused</option><option value="socratic">Ask me questions</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset disabled={pending} className="border-t border-line pt-6">
        <legend className="text-sm font-medium text-foreground">Assistant voice</legend>
        <p className="mt-1 text-sm text-muted">Voices come from your browser or device. They aren’t uploaded to Catalysts.</p>
        <label className="mt-4 block text-sm text-muted">Voice
          <select value={preferences.voiceName} onChange={(event) => updatePreference("voiceName", event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-foreground">
            <option value="">System default</option>
            {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
          </select>
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">Speaking speed · {preferences.voiceRate.toFixed(2)}×
            <input type="range" min="0.75" max="1.25" step="0.05" value={preferences.voiceRate} onChange={(event) => updatePreference("voiceRate", Number(event.target.value))} className="mt-3 block w-full accent-[var(--color-accent)]" />
          </label>
          <label className="text-sm text-muted">Voice pitch · {preferences.voicePitch.toFixed(2)}
            <input type="range" min="0.75" max="1.25" step="0.05" value={preferences.voicePitch} onChange={(event) => updatePreference("voicePitch", Number(event.target.value))} className="mt-3 block w-full accent-[var(--color-accent)]" />
          </label>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-foreground">
          <input type="checkbox" checked={preferences.autoSpeak} onChange={(event) => updatePreference("autoSpeak", event.target.checked)} className="accent-[var(--color-accent)]" />
          Automatically speak new AI replies in the AI Hub
        </label>
        <button type="button" onClick={previewVoice} className="mt-4 min-h-11 rounded-lg border border-line px-4 text-sm text-foreground hover:bg-surface-raised">Preview voice</button>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-muted">{preferenceMessage}</p>
      </fieldset>
    </div>
  );
}
