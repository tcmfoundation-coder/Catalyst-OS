import { useEffect, useRef, useState } from "react";
import { isRunningInExpoGo } from "expo";
import * as Speech from "expo-speech";
import { Link } from "expo-router";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactilePressable } from "@/components/ui/TactilePressable";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/lib/auth-context";
import { useAppSettings } from "@/lib/settings-context";
import { disableServerPush, enableServerPush } from "@/lib/push-notifications";
import { getMobileAISettings, updateMobileAISettings, type MobileAIPreferences, type MobileAIProvider, type MobileAISettings } from "@/lib/api";
import { colors, radius, space } from "@/theme/tokens";

type ReminderKey = "studyReminder" | "taskReminder";
const GOAL_OPTIONS = [3, 5, 7, 10];

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function toTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function SettingsScreen() {
  const { state } = useAuth();
  const { showToast } = useToast();
  const { settings, loading: settingsLoading, error: settingsError, retryLoad, resetSettings, updateSettings } = useAppSettings();
  const [saving, setSaving] = useState(false);
  const [pickerFor, setPickerFor] = useState<ReminderKey | null>(null);
  const [pickerDraft, setPickerDraft] = useState(new Date());
  const runningInExpoGo = isRunningInExpoGo();

  if (state.status !== "authenticated") return null;

  async function saveSettings(
    patch: Parameters<typeof updateSettings>[0],
    successMessage: string,
  ) {
    setSaving(true);
    try {
      await updateSettings(patch);
      showToast(successMessage);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleServerPush(enabled: boolean) {
    if (state.status !== "authenticated") return;
    setSaving(true);
    try {
      if (enabled) {
        await enableServerPush(state.token);
        try {
          await updateSettings({ notifications: { serverPush: { enabled: true } } });
        } catch (cause) {
          await disableServerPush(state.token).catch((cleanupError: unknown) => {
            console.error("Could not undo push registration after the setting failed to save", cleanupError);
          });
          throw cause;
        }
      } else {
        await disableServerPush(state.token);
        await updateSettings({ notifications: { serverPush: { enabled: false } } });
      }
      showToast(enabled ? "Cross-device notifications enabled" : "Cross-device notifications disabled");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not update push notifications.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetSettings() {
    setSaving(true);
    try {
      await resetSettings();
      showToast("Settings reset to defaults");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not reset settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  function openTimePicker(key: ReminderKey) {
    const [hour, minute] = settings.notifications[key].time.split(":").map(Number);
    setPickerDraft(new Date(2000, 0, 1, hour, minute));
    setPickerFor(key);
  }

  async function commitReminderTime(date: Date) {
    if (!pickerFor) return;
    const key = pickerFor;
    setPickerFor(null);
    await saveSettings({ notifications: { [key]: { ...settings.notifications[key], time: toTimeValue(date) } } }, "Reminder time saved");
  }

  const settingsReady = !settingsLoading && !settingsError;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Link href="./profile" asChild>
          <TactilePressable accessibilityRole="button" style={styles.backButton}>
            <Text style={styles.backLabel}>‹</Text><Text style={styles.backText}>PROFILE</Text>
          </TactilePressable>
        </Link>
        <Text style={styles.eyebrow}>PREFERENCES <Text style={styles.dim}>/ CONTROL CENTER</Text></Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.settingHint}>Tune reminders, study goals, and how Catalysts moves on this device.</Text>

        <SectionHeading eyebrow="INTELLIGENCE" title="AI control panel" />
        <AISettingsPanel token={state.token} />

        <SectionHeading eyebrow="DEVICE CONTROLS" title="Notifications" />
        <HudPanel style={styles.settingsPanel}>
          {!settingsReady ? (
            <SettingsStatus loading={settingsLoading} error={settingsError} onRetry={retryLoad} onReset={() => void handleResetSettings()} />
          ) : (
            <>
              <View style={styles.reminderRow}>
                <View style={styles.reminderCopy}>
                  <Text style={styles.settingTitle}>Study reminder</Text>
                  <Text style={styles.settingHint}>A daily nudge to make progress on your study goal.</Text>
                  <ReminderTime time={settings.notifications.studyReminder.time} disabled={saving} onPress={() => openTimePicker("studyReminder")} />
                </View>
                <Switch
                  accessibilityLabel="Daily study reminder"
                  value={settings.notifications.studyReminder.enabled}
                  disabled={saving || runningInExpoGo}
                  onValueChange={(enabled) => void saveSettings({ notifications: { studyReminder: { ...settings.notifications.studyReminder, enabled } } }, enabled ? "Study reminder enabled" : "Study reminder disabled")}
                  trackColor={{ false: "#34434C", true: `${colors.lime}88` }}
                  thumbColor={settings.notifications.studyReminder.enabled ? colors.lime : "#A8B4BA"}
                />
              </View>
              <View style={styles.separator} />
              <View style={styles.reminderRow}>
                <View style={styles.reminderCopy}>
                  <Text style={styles.settingTitle}>Task check-in</Text>
                  <Text style={styles.settingHint}>A daily task check-in and local alerts for upcoming due dates.</Text>
                  <ReminderTime time={settings.notifications.taskReminder.time} disabled={saving} onPress={() => openTimePicker("taskReminder")} />
                </View>
                <Switch
                  accessibilityLabel="Daily task check-in reminder"
                  value={settings.notifications.taskReminder.enabled}
                  disabled={saving || runningInExpoGo}
                  onValueChange={(enabled) => void saveSettings({ notifications: { taskReminder: { ...settings.notifications.taskReminder, enabled } } }, enabled ? "Task check-in enabled" : "Task check-in disabled")}
                  trackColor={{ false: "#34434C", true: `${colors.cyan}88` }}
                  thumbColor={settings.notifications.taskReminder.enabled ? colors.cyan : "#A8B4BA"}
                />
              </View>
              <View style={styles.separator} />
              <View style={styles.reminderRow}>
                <View style={styles.reminderCopy}>
                  <Text style={styles.settingTitle}>Cross-device alerts</Text>
                  <Text style={styles.settingHint}>Receive task updates from your other devices while this app is closed.</Text>
                </View>
                <Switch
                  accessibilityLabel="Cross-device push notifications"
                  value={settings.notifications.serverPush.enabled}
                  disabled={saving || runningInExpoGo || Platform.OS === "web"}
                  onValueChange={(enabled) => void toggleServerPush(enabled)}
                  trackColor={{ false: "#34434C", true: `${colors.cyan}88` }}
                  thumbColor={settings.notifications.serverPush.enabled ? colors.cyan : "#A8B4BA"}
                />
              </View>
              <Text style={runningInExpoGo ? styles.reminderNotice : styles.footnote}>
                {runningInExpoGo
                  ? "Local and remote notifications need a Catalyst development or production build. The rest of the app works in Expo Go."
                  : "Daily reminders and task due alerts are scheduled on this device. Cross-device alerts use Expo Push and require an internet connection."}
              </Text>
            </>
          )}
        </HudPanel>

        <SectionHeading eyebrow="PERSONAL TARGET" title="Weekly study goal" />
        <HudPanel style={styles.settingsPanel}>
          <Text style={styles.settingTitle}>Choose your weekly focus</Text>
          <Text style={styles.settingHint}>Your dashboard will track study time against this target.</Text>
          {!settingsReady ? (
            <SettingsStatus loading={settingsLoading} error={settingsError} onRetry={retryLoad} onReset={() => void handleResetSettings()} />
          ) : (
            <View style={styles.goalOptions}>
              {GOAL_OPTIONS.map((hours) => {
                const selected = settings.weeklyStudyGoalHours === hours;
                return (
                  <TactilePressable
                    key={hours}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    disabled={saving}
                    onPress={() => void saveSettings({ weeklyStudyGoalHours: hours }, `Weekly goal set to ${hours} hours`)}
                    style={[styles.goalOption, selected && styles.goalOptionSelected]}
                  >
                    <Text style={[styles.goalValue, selected && styles.goalValueSelected]}>{hours}</Text>
                    <Text style={[styles.goalUnit, selected && styles.goalValueSelected]}>HRS</Text>
                  </TactilePressable>
                );
              })}
            </View>
          )}
        </HudPanel>

        <SectionHeading eyebrow="DISPLAY" title="Motion & appearance" />
        <HudPanel style={styles.settingsPanel}>
          {!settingsReady ? (
            <SettingsStatus loading={settingsLoading} error={settingsError} onRetry={retryLoad} onReset={() => void handleResetSettings()} />
          ) : (
            <View style={styles.reminderRow}>
              <View style={styles.reminderCopy}>
                <Text style={styles.settingTitle}>Reduce motion</Text>
                <Text style={styles.settingHint}>Calm the animated waves, core, and press feedback.</Text>
              </View>
              <Switch
                accessibilityLabel="Reduce interface motion"
                value={settings.reduceMotion}
                disabled={saving}
                onValueChange={(reduceMotion) => void saveSettings({ reduceMotion }, reduceMotion ? "Reduced motion enabled" : "Reduced motion disabled")}
                trackColor={{ false: "#34434C", true: `${colors.lime}88` }}
                thumbColor={settings.reduceMotion ? colors.lime : "#A8B4BA"}
              />
            </View>
          )}
          <View style={styles.appearanceRow}>
            <Text style={styles.settingTitle}>Catalyst appearance</Text>
            <Text style={styles.appearanceValue}>DARK · ACTIVE</Text>
          </View>
          <Text style={styles.footnote}>The dark Catalyst theme is used throughout this app.</Text>
        </HudPanel>

        <Text style={styles.footnote}>These preferences apply to this device. Cross-device task alerts also require a network connection.</Text>
      </ScrollView>

      <Modal visible={Platform.OS === "ios" && pickerFor !== null} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setPickerFor(null)}><Text style={styles.pickerAction}>Cancel</Text></Pressable>
              <Text style={styles.pickerTitle}>Reminder time</Text>
              <Pressable onPress={() => void commitReminderTime(pickerDraft)}><Text style={styles.pickerAction}>Save</Text></Pressable>
            </View>
            {pickerFor ? (
              <DateTimePicker
                value={pickerDraft}
                mode="time"
                display="spinner"
                themeVariant="dark"
                accentColor={colors.lime}
                onValueChange={(_event, value) => { if (value) setPickerDraft(value); }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
      {Platform.OS === "android" && pickerFor ? (
        <DateTimePicker
          value={pickerDraft}
          mode="time"
          presentation="dialog"
          accentColor={colors.lime}
          onValueChange={(_event, value) => { if (value) void commitReminderTime(value); else setPickerFor(null); }}
          onDismiss={() => setPickerFor(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const PROVIDER_LABELS: Record<MobileAIProvider, string> = {
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
  openai: "OpenAI",
};

function AISettingsPanel({ token }: { token: string }) {
  const [data, setData] = useState<MobileAISettings | null>(null);
  const [voices, setVoices] = useState<Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void getMobileAISettings(token)
      .then((settings) => { if (active) { setData(settings); setError(null); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load AI settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    let active = true;
    void Speech.getAvailableVoicesAsync()
      .then((available) => { if (active) setVoices(available); })
      .catch(() => { if (active) setVoices([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  async function saveProvider(provider: MobileAIProvider | "default") {
    if (!data) return;
    const previous = data;
    const nextProvider = provider === "default" ? data.defaultProvider : provider;
    setData({ ...data, provider: nextProvider });
    setSaving(true);
    setMessage("Saving provider…");
    setError(null);
    try {
      await updateMobileAISettings(token, provider === "default"
        ? { action: "resetProvider" }
        : { action: "provider", provider });
      setMessage(`${PROVIDER_LABELS[nextProvider]} is now active.`);
    } catch (cause) {
      setData(previous);
      setError(cause instanceof Error ? cause.message : "Could not change the AI provider.");
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  function updatePreference<K extends keyof MobileAIPreferences>(key: K, nextValue: MobileAIPreferences[K]) {
    if (!data) return;
    const nextPreferences = { ...data.preferences, [key]: nextValue };
    setData({ ...data, preferences: nextPreferences });
    setMessage("Saving AI preferences…");
    setError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void updateMobileAISettings(token, { action: "preferences", preferences: nextPreferences })
        .then(() => setMessage("AI preferences saved."))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Could not save AI preferences.");
          setMessage("");
        });
    }, 400);
  }

  function stepPreference(key: "voiceRate" | "voicePitch", delta: number) {
    if (!data) return;
    const nextValue = Math.max(0.75, Math.min(1.25, Math.round((data.preferences[key] + delta) * 100) / 100));
    updatePreference(key, nextValue);
  }

  function previewVoice() {
    if (!data) return;
    const voice = voices.find((item) => item.identifier === data.preferences.voiceName);
    void Speech.stop();
    Speech.speak("Hello, I’m Catalyst. Your AI voice settings are ready.", {
      language: voice?.language ?? "en-US",
      voice: data.preferences.voiceName || undefined,
      rate: data.preferences.voiceRate,
      pitch: data.preferences.voicePitch,
      onStart: () => setMessage("Playing voice preview…"),
      onDone: () => setMessage("Voice preview finished."),
      onError: () => setError("Could not play this voice on the device."),
    });
  }

  if (loading) {
    return <HudPanel style={styles.settingsPanel}><View style={styles.status}><ActivityIndicator size="small" color={colors.cyan} /><Text style={styles.settingHint}>Loading your AI settings…</Text></View></HudPanel>;
  }
  if (error && !data) {
    return (
      <HudPanel style={styles.settingsPanel}>
        <Text style={styles.errorText}>{error}</Text>
        <TactilePressable accessibilityRole="button" onPress={() => {
          setError(null);
          setLoading(true);
          void getMobileAISettings(token)
            .then((settings) => setData(settings))
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load AI settings."))
            .finally(() => setLoading(false));
        }} style={styles.retryButton}>
          <Text style={styles.retryText}>Reload AI settings</Text>
        </TactilePressable>
      </HudPanel>
    );
  }
  if (!data) return null;

  const selectedVoice = voices.find((voice) => voice.identifier === data.preferences.voiceName);
  return (
    <>
      <HudPanel style={styles.settingsPanel}>
        <Text style={styles.settingTitle}>AI provider</Text>
        <Text style={styles.settingHint}>Choose from providers configured for your account. Keys stay on the server.</Text>
        {data.availableProviders.length ? data.availableProviders.map((provider) => {
          const selected = provider === data.provider;
          return (
            <TactilePressable key={provider} accessibilityRole="radio" accessibilityState={{ selected }} disabled={saving} onPress={() => void saveProvider(provider)} style={[styles.providerOption, selected && styles.providerOptionSelected]}>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>{selected ? <View style={styles.radioInner} /> : null}</View>
              <Text style={styles.providerName}>{PROVIDER_LABELS[provider]}</Text>
              {selected ? <Text style={styles.activeLabel}>ACTIVE</Text> : null}
            </TactilePressable>
          );
        }) : <Text style={styles.reminderNotice}>No AI provider is configured on the server yet.</Text>}
        {data.availableProviders.length > 0 && data.provider !== data.defaultProvider ? (
          <TactilePressable accessibilityRole="button" disabled={saving} onPress={() => void saveProvider("default")} style={styles.resetProviderButton}>
            <Text style={styles.retryText}>Use system default · {PROVIDER_LABELS[data.defaultProvider]}</Text>
          </TactilePressable>
        ) : null}

        <View style={styles.aiDivider} />
        <Text style={styles.settingTitle}>Response style</Text>
        <Text style={styles.settingHint}>Set the default answer length and tutoring approach.</Text>
        <Text style={styles.controlLabel}>Answer length</Text>
        <ChoiceRow
          values={["concise", "balanced", "detailed"]}
          labels={["Concise", "Balanced", "Detailed"]}
          selected={data.preferences.responseLength}
          disabled={saving}
          onSelect={(value) => updatePreference("responseLength", value as MobileAIPreferences["responseLength"])}
        />
        <Text style={styles.controlLabel}>Tutor style</Text>
        <ChoiceRow
          values={["supportive", "direct", "socratic"]}
          labels={["Supportive", "Direct", "Socratic"]}
          selected={data.preferences.tutorTone}
          disabled={saving}
          onSelect={(value) => updatePreference("tutorTone", value as MobileAIPreferences["tutorTone"])}
        />

        <View style={styles.aiDivider} />
        <Text style={styles.settingTitle}>Assistant voice</Text>
        <Text style={styles.settingHint}>Voice choices come from your device. They are not uploaded to Catalysts.</Text>
        <TactilePressable accessibilityRole="button" onPress={() => setVoicePickerOpen(true)} style={styles.voiceSelect}>
          <View style={styles.voiceSelectCopy}>
            <Text style={styles.voiceSelectLabel}>VOICE</Text>
            <Text numberOfLines={1} style={styles.voiceSelectName}>{selectedVoice ? `${selectedVoice.name} · ${selectedVoice.language}` : data.preferences.voiceName ? "Saved voice unavailable on this device" : "System default"}</Text>
          </View>
          <Text style={styles.chevron}>⌄</Text>
        </TactilePressable>
        <PreferenceStepper label="Speaking speed" value={data.preferences.voiceRate} suffix="×" onDecrease={() => stepPreference("voiceRate", -0.05)} onIncrease={() => stepPreference("voiceRate", 0.05)} />
        <PreferenceStepper label="Voice pitch" value={data.preferences.voicePitch} suffix="" onDecrease={() => stepPreference("voicePitch", -0.05)} onIncrease={() => stepPreference("voicePitch", 0.05)} />
        <View style={styles.reminderRow}>
          <View style={styles.reminderCopy}>
            <Text style={styles.settingTitle}>Speak replies automatically</Text>
            <Text style={styles.settingHint}>Read new tutor answers aloud in the assistant.</Text>
          </View>
          <Switch accessibilityLabel="Automatically speak new AI replies" value={data.preferences.autoSpeak} disabled={saving} onValueChange={(enabled) => updatePreference("autoSpeak", enabled)} trackColor={{ false: "#34434C", true: `${colors.lime}88` }} thumbColor={data.preferences.autoSpeak ? colors.lime : "#A8B4BA"} />
        </View>
        <TactilePressable accessibilityRole="button" onPress={previewVoice} style={styles.previewVoiceButton}>
          <Text style={styles.previewVoiceText}>▶  Preview voice</Text>
        </TactilePressable>
        {message ? <Text accessibilityLiveRegion="polite" style={styles.footnote}>{message}</Text> : null}
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{error}</Text> : null}
      </HudPanel>

      <Modal visible={voicePickerOpen} transparent animationType="fade" onRequestClose={() => setVoicePickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose assistant voice</Text>
              <Pressable accessibilityRole="button" onPress={() => setVoicePickerOpen(false)}><Text style={styles.pickerAction}>Done</Text></Pressable>
            </View>
            <ScrollView style={styles.voiceList}>
              <VoiceOption label="System default" selected={!data.preferences.voiceName} onPress={() => { setVoicePickerOpen(false); updatePreference("voiceName", ""); }} />
              {voices.map((voice) => (
                <VoiceOption key={voice.identifier} label={`${voice.name} · ${voice.language}`} selected={voice.identifier === data.preferences.voiceName} onPress={() => { setVoicePickerOpen(false); updatePreference("voiceName", voice.identifier); }} />
              ))}
              {voices.length === 0 ? <Text style={styles.settingHint}>No device voices were reported. System default remains available.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ChoiceRow({ values, labels, selected, disabled, onSelect }: { values: string[]; labels: string[]; selected: string; disabled: boolean; onSelect: (value: string) => void }) {
  return (
    <View style={styles.choiceRow}>
      {values.map((value, index) => (
        <TactilePressable key={value} accessibilityRole="radio" accessibilityState={{ selected: selected === value }} disabled={disabled} onPress={() => onSelect(value)} style={[styles.choiceButton, selected === value && styles.choiceButtonSelected]}>
          <Text style={[styles.choiceText, selected === value && styles.choiceTextSelected]}>{labels[index]}</Text>
        </TactilePressable>
      ))}
    </View>
  );
}

function PreferenceStepper({ label, value, suffix, onDecrease, onIncrease }: { label: string; value: number; suffix: string; onDecrease: () => void; onIncrease: () => void }) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TactilePressable accessibilityRole="button" accessibilityLabel={`Decrease ${label.toLowerCase()}`} onPress={onDecrease} disabled={value <= 0.75} style={styles.stepButton}><Text style={styles.stepText}>−</Text></TactilePressable>
        <Text style={styles.stepValue}>{value.toFixed(2)}{suffix}</Text>
        <TactilePressable accessibilityRole="button" accessibilityLabel={`Increase ${label.toLowerCase()}`} onPress={onIncrease} disabled={value >= 1.25} style={styles.stepButton}><Text style={styles.stepText}>+</Text></TactilePressable>
      </View>
    </View>
  );
}

function VoiceOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TactilePressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={styles.voiceOption}>
      <Text numberOfLines={2} style={styles.voiceOptionText}>{label}</Text>
      {selected ? <Text style={styles.activeLabel}>SELECTED</Text> : null}
    </TactilePressable>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text></View>;
}

function ReminderTime({ time, disabled, onPress }: { time: string; disabled: boolean; onPress: () => void }) {
  return (
    <TactilePressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.timeButton}>
      <Text style={styles.timeIcon}>◷</Text><Text style={styles.timeText}>{formatTime(time)}</Text><Text style={styles.timeEdit}>CHANGE</Text>
    </TactilePressable>
  );
}

function SettingsStatus({ loading, error, onRetry, onReset }: { loading: boolean; error: string | null; onRetry: () => void; onReset: () => void }) {
  if (loading) return <View style={styles.status}><ActivityIndicator size="small" color={colors.cyan} /><Text style={styles.settingHint}>Loading your saved settings…</Text></View>;
  if (!error) return null;
  return (
    <View style={styles.status}>
      <Text style={styles.errorText}>{error}</Text>
      <View style={styles.statusActions}>
        <TactilePressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Reload settings</Text></TactilePressable>
        <TactilePressable accessibilityRole="button" onPress={onReset} style={styles.resetButton}><Text style={styles.resetText}>Reset</Text></TactilePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: space.xl, paddingTop: space.lg, paddingBottom: 120, gap: space.md },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.35 },
  dim: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 27, fontWeight: "800", letterSpacing: -0.6, marginTop: -7 },
  backButton: { minHeight: 34, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7, marginLeft: -7 },
  backLabel: { color: colors.cyan, fontSize: 22, lineHeight: 24 },
  backText: { color: colors.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  sectionHeading: { gap: 3, marginTop: space.xs },
  sectionEyebrow: { color: colors.cyan, fontSize: 8, fontWeight: "800", letterSpacing: 1.3 },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "800" },
  settingsPanel: { gap: 12, padding: 15 },
  reminderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  reminderCopy: { flex: 1, gap: 5 },
  settingTitle: { color: colors.foreground, fontSize: 12, fontWeight: "800" },
  settingHint: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  timeButton: { minHeight: 31, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3, paddingHorizontal: 9, borderRadius: radius.control, borderColor: "#33464D", backgroundColor: "#0A1117" },
  timeIcon: { color: colors.cyan, fontSize: 13 },
  timeText: { color: colors.foreground, fontSize: 10, fontWeight: "800" },
  timeEdit: { color: colors.subtle, fontSize: 7, fontWeight: "900", letterSpacing: 0.6, marginLeft: 3 },
  separator: { height: 1, backgroundColor: colors.line },
  footnote: { color: colors.subtle, fontSize: 9, lineHeight: 14 },
  reminderNotice: { color: colors.amber, fontSize: 9, lineHeight: 14 },
  goalOptions: { flexDirection: "row", gap: 8, marginTop: 5 },
  goalOption: { flex: 1, minHeight: 55, alignItems: "center", justifyContent: "center", borderRadius: radius.control, borderWidth: 1, borderColor: "#293943", backgroundColor: "#0A1117", gap: 2 },
  goalOptionSelected: { borderColor: `${colors.lime}90`, backgroundColor: "#172218" },
  goalValue: { color: colors.muted, fontSize: 17, fontWeight: "900" },
  goalValueSelected: { color: colors.lime },
  goalUnit: { color: colors.subtle, fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  appearanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  appearanceValue: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  status: { alignItems: "flex-start", gap: 10 },
  statusActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { color: colors.danger, fontSize: 10, lineHeight: 15 },
  retryButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.control, borderColor: `${colors.cyan}65`, backgroundColor: "#0E1D24" },
  retryText: { color: colors.cyan, fontSize: 10, fontWeight: "800" },
  resetButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.control, borderColor: "#39474D", backgroundColor: "#11191E" },
  resetText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  providerOption: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, borderRadius: radius.control, borderWidth: 1, borderColor: "#293943", backgroundColor: "#0A1117" },
  providerOptionSelected: { borderColor: `${colors.lime}80`, backgroundColor: "#152019" },
  radioOuter: { width: 17, height: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.subtle, borderRadius: 9 },
  radioOuterSelected: { borderColor: colors.lime },
  radioInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  providerName: { flex: 1, color: colors.foreground, fontSize: 11, fontWeight: "700" },
  activeLabel: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 0.85 },
  resetProviderButton: { minHeight: 38, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 10, borderRadius: radius.control, borderWidth: 1, borderColor: "#39474D", backgroundColor: "#11191E" },
  aiDivider: { height: 1, backgroundColor: colors.line, marginVertical: 3 },
  controlLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", marginTop: 3 },
  choiceRow: { flexDirection: "row", gap: 6 },
  choiceButton: { flex: 1, minHeight: 39, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderRadius: radius.control, borderWidth: 1, borderColor: "#293943", backgroundColor: "#0A1117" },
  choiceButtonSelected: { borderColor: `${colors.cyan}80`, backgroundColor: "#10212A" },
  choiceText: { color: colors.muted, fontSize: 8, fontWeight: "700", textAlign: "center" },
  choiceTextSelected: { color: colors.cyan },
  voiceSelect: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, borderRadius: radius.control, borderWidth: 1, borderColor: "#33464D", backgroundColor: "#0A1117" },
  voiceSelectCopy: { flex: 1, gap: 3 },
  voiceSelectLabel: { color: colors.cyan, fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  voiceSelectName: { color: colors.foreground, fontSize: 10, fontWeight: "700" },
  chevron: { color: colors.cyan, fontSize: 21, fontWeight: "300" },
  stepperRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: radius.control, borderWidth: 1, borderColor: "#33464D", backgroundColor: "#101920" },
  stepText: { color: colors.cyan, fontSize: 17, fontWeight: "600", lineHeight: 20 },
  stepValue: { minWidth: 42, color: colors.foreground, fontSize: 10, fontWeight: "800", textAlign: "center" },
  previewVoiceButton: { minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.control, borderWidth: 1, borderColor: `${colors.lime}55`, backgroundColor: "#162019" },
  previewVoiceText: { color: colors.lime, fontSize: 10, fontWeight: "800" },
  voiceList: { maxHeight: 420 },
  voiceOption: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  voiceOptionText: { flex: 1, color: colors.foreground, fontSize: 10, lineHeight: 15 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#000000A8", padding: space.md },
  pickerSheet: { borderRadius: radius.hero, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: space.md },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xs, paddingBottom: space.sm },
  pickerAction: { color: colors.lime, fontSize: 12, fontWeight: "800" },
  pickerTitle: { color: colors.foreground, fontSize: 12, fontWeight: "800" },
});
