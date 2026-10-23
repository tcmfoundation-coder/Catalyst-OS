import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { isRunningInExpoGo } from "expo";
import * as Speech from "expo-speech";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactilePressable } from "@/components/ui/TactilePressable";
import { useAuth } from "@/lib/auth-context";
import { askTutor, getMobileAISettings, type MobileAIPreferences } from "@/lib/api";
import { colors, radius, space } from "@/theme/tokens";

type Message = { id: string; role: "user" | "assistant"; content: string; sources?: number; retrievalStatus?: string };
type SpeechRecognitionModule = typeof import("expo-speech-recognition")["ExpoSpeechRecognitionModule"];

export default function AssistantScreen() {
  const { state } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aiPreferences, setAIPreferences] = useState<MobileAIPreferences | null>(null);
  const [speechInputState, setSpeechInputState] = useState<"loading" | "ready" | "unavailable">(
    () => isRunningInExpoGo() ? "unavailable" : "loading",
  );
  const scrollRef = useRef<ScrollView>(null);
  const sendingVoiceRef = useRef(false);
  const speechModuleRef = useRef<SpeechRecognitionModule | null>(null);
  const sendQuestionRef = useRef<(value: string, speakReply: boolean) => Promise<void>>(async () => {});
  const announceErrorRef = useRef<(message: string) => void>(() => {});
  const token = state.status === "authenticated" ? state.token : "";

  useFocusEffect(useCallback(() => {
    if (!token) return;
    let active = true;
    void getMobileAISettings(token)
      .then((settings) => { if (active) setAIPreferences(settings.preferences); })
      .catch((cause: unknown) => console.error("Could not load Catalyst voice preferences", cause));
    return () => { active = false; };
  }, [token]));

  useFocusEffect(useCallback(() => {
    return () => { speechModuleRef.current?.abort(); void Speech.stop(); };
  }, []));

  useEffect(() => {
    if (isRunningInExpoGo()) return;

    let active = true;
    let subscriptions: { remove: () => void }[] = [];

    void import("expo-speech-recognition").then(({ ExpoSpeechRecognitionModule }) => {
      if (!active) return;

      speechModuleRef.current = ExpoSpeechRecognitionModule;
      subscriptions = [
        ExpoSpeechRecognitionModule.addListener("start", () => {
          setListening(true);
          setSpeaking(false);
          setError(null);
        }),
        ExpoSpeechRecognitionModule.addListener("result", (event) => {
          const recognized = event.results[0]?.transcript?.trim() ?? "";
          setTranscript(recognized);
          if (event.isFinal && recognized && !sendingVoiceRef.current) {
            sendingVoiceRef.current = true;
            const question = recognized.replace(/^\s*(?:(?:hey|okay|ok)\s+catalysts?\b|catalysts?[,.])\s*/i, "").trim();
            setListening(false);
            setTranscript("");
            if (question) void sendQuestionRef.current(question, true);
            else {
              announceErrorRef.current("I’m listening. Ask me what you’d like to study.");
              sendingVoiceRef.current = false;
            }
          }
        }),
        ExpoSpeechRecognitionModule.addListener("volumechange", (event) => {
          setAudioLevel(Math.max(0, Math.min(1, (event.value + 2) / 12)));
        }),
        ExpoSpeechRecognitionModule.addListener("end", () => {
          setListening(false);
          setAudioLevel(0);
        }),
        ExpoSpeechRecognitionModule.addListener("error", (event) => {
          setListening(false);
          setAudioLevel(0);
          if (event.error !== "aborted") {
            announceErrorRef.current(
              event.error === "not-allowed"
                ? "Microphone permission is needed to talk to Catalyst."
                : event.error === "no-speech"
                  ? "I didn’t catch that. Tap the Core and try again."
                  : "Voice recognition is unavailable right now. You can still type your question.",
            );
          }
        }),
      ];
      setSpeechInputState("ready");
    }).catch((cause: unknown) => {
      if (!active) return;
      console.error("Could not load the native speech-recognition module.", cause);
      setSpeechInputState("unavailable");
    });

    return () => {
      active = false;
      speechModuleRef.current?.abort();
      speechModuleRef.current = null;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  async function sendQuestion(value = question, speakReply = false) {
    const trimmed = value.trim();
    if (!trimmed || asking) return;
    setQuestion("");
    setError(null);
    setMessages((current) => [...current, { id: `${Date.now()}-u`, role: "user", content: trimmed }]);
    setAsking(true);
    try {
      const result = await askTutor(token, { question: trimmed, conversationId, ...(speakReply ? { includeAcademicContext: true, includeUpcomingTasks: true } : {}) });
      if (result.conversationId) setConversationId(result.conversationId);
      if (!result.ok) {
        announceError(result.error ?? "The tutor could not answer right now.");
        return;
      }
      setMessages((current) => [...current, {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: result.answer ?? "",
        sources: result.sources.length,
        retrievalStatus: result.retrievalStatus,
      }]);
      if ((speakReply || aiPreferences?.autoSpeak) && result.answer) speakAnswer(result.answer);
    } catch (cause) {
      announceError(cause instanceof Error ? cause.message : "Could not reach Catalysts Tutor.");
    } finally {
      setAsking(false);
      sendingVoiceRef.current = false;
    }
  }

  function speakAnswer(answer: string) {
    const maxChunk = Math.min(650, Math.max(120, Speech.maxSpeechInputLength - 40));
    const chunks: string[] = [];
    let remaining = answer.trim();
    while (remaining.length > maxChunk) {
      let cut = Math.max(remaining.lastIndexOf(". ", maxChunk), remaining.lastIndexOf("? ", maxChunk), remaining.lastIndexOf("! ", maxChunk));
      if (cut < maxChunk * 0.55) cut = remaining.lastIndexOf(" ", maxChunk);
      if (cut <= 0) cut = maxChunk;
      chunks.push(remaining.slice(0, cut + (remaining[cut] === " " ? 0 : 1)).trim());
      remaining = remaining.slice(cut + 1).trim();
    }
    if (remaining) chunks.push(remaining);
    setSpeaking(true);
    const play = (index: number) => {
      if (index >= chunks.length) { setSpeaking(false); return; }
      try {
        Speech.speak(chunks[index], {
          language: "en-US",
          ...(aiPreferences?.voiceName ? { voice: aiPreferences.voiceName } : {}),
          rate: aiPreferences?.voiceRate ?? 0.96,
          pitch: aiPreferences?.voicePitch ?? 1,
          onDone: () => play(index + 1),
          onStopped: () => setSpeaking(false),
          onError: () => setSpeaking(false),
        });
      } catch {
        setSpeaking(false);
      }
    };
    play(0);
  }

  function announceError(message: string) {
    setError(message);
    speakAnswer(message);
  }

  sendQuestionRef.current = sendQuestion;
  announceErrorRef.current = announceError;

  async function toggleVoice() {
    if (asking) return;
    if (isRunningInExpoGo()) {
      setError("Voice input requires a development build. You can still type your question.");
      return;
    }
    const speechModule = speechModuleRef.current;
    if (!speechModule) {
      setError(
        speechInputState === "loading"
          ? "Voice input is still initializing. Try again in a moment."
          : "Voice input is unavailable in this build. You can still type your question.",
      );
      return;
    }
    if (listening) { speechModule.stop(); return; }
    if (speaking) { await Speech.stop(); setSpeaking(false); return; }
    setError(null);
    setTranscript("");
    sendingVoiceRef.current = false;
    try {
      await Speech.stop();
      const permission = await speechModule.requestPermissionsAsync();
      if (!permission.granted) { announceError("Allow microphone access to talk to Catalyst. You can still type below."); return; }
      if (!speechModule.isRecognitionAvailable()) { announceError("Speech recognition isn’t available on this device. You can still type below."); return; }
      speechModule.start({ lang: "en-US", interimResults: true, continuous: false, addsPunctuation: true, contextualStrings: ["Catalysts", "Catalyst", "study", "semester", "course", "assignment", "exam"], volumeChangeEventOptions: { enabled: true, intervalMillis: 120 } });
    } catch {
      announceError("Couldn’t start voice input. Check microphone access, or type your question below.");
    }
  }

  if (state.status !== "authenticated") return null;
  const orbState = listening ? "listening" : asking ? "thinking" : speaking ? "speaking" : "idle";
  const voiceLabel = isRunningInExpoGo()
    ? "VOICE INPUT NEEDS A DEVELOPMENT BUILD"
    : speechInputState === "loading"
      ? "VOICE INPUT INITIALIZING"
      : listening
        ? "LISTENING · SPEAK NOW"
        : asking
          ? "THINKING · CHECKING YOUR STUDY PLAN"
          : speaking
            ? "RESPONDING · TAP TO STOP"
            : "TAP THE CORE TO SPEAK";

  function startNewThread() {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    setQuestion("");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <View><Text style={styles.eyebrow}>CATALYST CORE <Text style={styles.dim}>/ TUTOR</Text></Text><Text style={styles.title}>Your assistant</Text></View>
            {messages.length > 0 ? <Pressable onPress={startNewThread} style={styles.newChat}><Text style={styles.newChatText}>New thread +</Text></Pressable> : null}
          </View>

          {messages.length === 0 ? (
            <View style={styles.welcome}>
              <TactilePressable accessibilityRole="button" accessibilityLabel={listening ? "Stop listening to Catalyst" : "Tap to speak to Catalyst"} onPress={() => void toggleVoice()} disabled={asking} style={styles.orbButton}>
                <CatalystOrb state={orbState} audioLevel={audioLevel} size={190} />
              </TactilePressable>
              <Text style={[styles.voiceLabel, listening && styles.voiceActive]}>{voiceLabel}</Text>
              <Text style={styles.welcomeTitle}>What are you working through?</Text>
              <Text style={styles.welcomeCopy}>{isRunningInExpoGo()
                ? "Type a question below and I’ll check your Catalysts workspace. Voice input is available in a development build."
                : "Tap the Core and ask, “Hey Catalyst, what do I have to study today?” I’ll check your Catalysts workspace and speak my answer."}</Text>
              <View style={styles.promptList}>
                <Prompt text="Help me understand a difficult topic" onPress={() => { setQuestion("Help me understand a difficult topic"); }} />
                <Prompt text="Help me plan my next study session" onPress={() => { setQuestion("Help me plan my next study session"); }} />
              </View>
            </View>
          ) : (
            <>
            <TactilePressable accessibilityRole="button" accessibilityLabel={listening ? "Stop listening to Catalyst" : speaking ? "Stop Catalyst speaking" : "Tap to speak to Catalyst"} disabled={asking} onPress={() => void toggleVoice()} style={[styles.voiceControl, asking && styles.disabled]}>
              <CatalystOrb state={orbState} audioLevel={audioLevel} size={58} />
              <View style={styles.voiceCopy}><Text style={[styles.voiceLabel, listening && styles.voiceActive]}>{voiceLabel}</Text><Text numberOfLines={2} style={styles.transcript}>{transcript || (listening ? "Listening for your question…" : "Tap the Core to ask another question")}</Text></View>
              <Text style={styles.voiceChevron}>{speaking ? "Ⅱ" : listening ? "■" : "↗"}</Text>
            </TactilePressable>
            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
              {asking ? <View style={styles.thinking}><CatalystOrb state="thinking" size={66} /><Text style={styles.thinkingText}>Working through your question…</Text></View> : null}
            </ScrollView>
            </>
          )}

          {error ? <HudPanel style={styles.errorPanel}><Text style={styles.error}>{error}</Text></HudPanel> : null}

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Ask the Catalysts Tutor"
              value={question}
              onChangeText={setQuestion}
              onSubmitEditing={() => void sendQuestion()}
              placeholder="Ask a question…"
              placeholderTextColor={colors.subtle}
              multiline
              maxLength={2000}
              editable={!asking}
              returnKeyType="send"
              style={styles.input}
            />
            <TactilePressable accessibilityRole="button" disabled={!question.trim() || asking} onPress={() => void sendQuestion()} style={[styles.send, (!question.trim() || asking) && styles.disabled]}>
              {asking ? <ActivityIndicator color={colors.black} size="small" /> : <Text style={styles.sendText}>↑</Text>}
            </TactilePressable>
          </View>
          <Text style={styles.disclaimer}>Answers use Catalysts Tutor and may cite your indexed materials.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Prompt({ text, onPress }: { text: string; onPress: () => void }) {
  return <TactilePressable onPress={onPress} style={styles.prompt}><Text style={styles.promptText}>{text} <Text style={styles.promptArrow}>↗</Text></Text></TactilePressable>;
}

function MessageBubble({ message }: { message: Message }) {
  const user = message.role === "user";
  return (
    <View style={[styles.messageRow, user && styles.userRow]}>
      {!user ? <View style={styles.messageAvatar}><Text style={styles.avatarGlyph}>✳</Text></View> : null}
      <View style={[styles.bubble, user ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.bubbleText, user && styles.userText]}>{message.content}</Text>
        {!user && message.sources !== undefined ? <Text style={styles.sourceText}>{message.sources ? `${message.sources} source${message.sources === 1 ? "" : "s"} · ` : ""}{message.retrievalStatus === "no_relevant_sources" ? "No matching material found" : "Catalysts Tutor"}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  screen: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: 92, gap: space.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 },
  eyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  dim: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 26, fontWeight: "800", letterSpacing: -0.4, marginTop: 3 },
  newChat: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 8 },
  newChatText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: space.sm },
  orbButton: { alignItems: "center", justifyContent: "center", borderRadius: 999, shadowColor: colors.cyan, shadowOpacity: 0.2, shadowRadius: 20 },
  voiceLabel: { color: colors.subtle, fontSize: 8, fontWeight: "800", letterSpacing: 1.15, textAlign: "center" },
  voiceActive: { color: colors.cyan },
  voiceControl: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.panel, borderWidth: 1, borderColor: `${colors.cyan}35`, backgroundColor: colors.surface },
  voiceCopy: { flex: 1, gap: 4 },
  transcript: { color: colors.foreground, fontSize: 10, lineHeight: 14 },
  voiceChevron: { color: colors.lime, fontSize: 17, fontWeight: "800", width: 22, textAlign: "center" },
  welcomeTitle: { color: colors.foreground, fontSize: 19, fontWeight: "800", textAlign: "center", marginTop: 2 },
  welcomeCopy: { maxWidth: 320, color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" },
  promptList: { width: "100%", gap: 8, marginTop: 12 },
  prompt: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 12 },
  promptText: { color: colors.foreground, fontSize: 11, fontWeight: "600" },
  promptArrow: { color: colors.cyan, fontWeight: "800" },
  messages: { flex: 1 },
  messageList: { gap: 12, paddingVertical: 12 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 7, maxWidth: "95%" },
  userRow: { alignSelf: "flex-end" },
  messageAvatar: { width: 24, height: 24, borderRadius: 9, backgroundColor: `${colors.cyan}1C`, alignItems: "center", justifyContent: "center" },
  avatarGlyph: { color: colors.cyan, fontSize: 12 },
  bubble: { borderRadius: 15, padding: 12, gap: 7 },
  userBubble: { backgroundColor: colors.surfaceRaised, borderBottomRightRadius: 4 },
  assistantBubble: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.foreground, fontSize: 12, lineHeight: 18 },
  userText: { color: colors.foreground },
  sourceText: { color: colors.subtle, fontSize: 8, fontWeight: "700", letterSpacing: 0.35 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  thinkingText: { color: colors.cyan, fontSize: 10, fontWeight: "700" },
  errorPanel: { padding: 10 },
  error: { color: colors.danger, fontSize: 10, lineHeight: 15 },
  composer: { minHeight: 52, flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 6, borderWidth: 1, borderColor: `${colors.cyan}44`, borderRadius: 18, backgroundColor: colors.surface },
  input: { flex: 1, maxHeight: 104, color: colors.foreground, fontSize: 12, lineHeight: 17, paddingHorizontal: 9, paddingTop: 9, paddingBottom: 8 },
  send: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" },
  sendText: { color: colors.black, fontSize: 21, fontWeight: "900", marginTop: -3 },
  disabled: { opacity: 0.48 },
  disclaimer: { color: colors.subtle, fontSize: 8, textAlign: "center", paddingBottom: 3 },
  pressed: { opacity: 0.72 },
});
