import { useState } from "react";
import { isRunningInExpoGo } from "expo";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactileIconTile, TactilePressable } from "@/components/ui/TactilePressable";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/lib/auth-context";
import { useAppSettings } from "@/lib/settings-context";
import { useOfflineSync } from "@/lib/offline-sync-context";
import { disableServerPush, enableServerPush } from "@/lib/push-notifications";
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

export default function ProfileScreen() {
  const { state, signOut } = useAuth();
  const { showToast } = useToast();
  const { online } = useOfflineSync();
  const { settings, loading: settingsLoading, error: settingsError, retryLoad, resetSettings, updateSettings } = useAppSettings();
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerFor, setPickerFor] = useState<ReminderKey | null>(null);
  const [pickerDraft, setPickerDraft] = useState(new Date());
  const runningInExpoGo = isRunningInExpoGo();

  if (state.status !== "authenticated") return null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      showToast("Signed out");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not sign out.", "error");
    } finally {
      setSigningOut(false);
    }
  }

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

  const initials = state.user.name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  const settingsReady = !settingsLoading && !settingsError;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>YOUR ACCOUNT <Text style={styles.dim}>/ CONTROL CENTER</Text></Text>
        <Text style={styles.title}>Profile & settings</Text>

        <HudPanel style={styles.identity}>
          <TactileIconTile color={colors.lime} size={54}><Text style={styles.initials}>{initials || "C"}</Text></TactileIconTile>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{state.user.name}</Text>
            <Text style={styles.email}>{state.user.email}</Text>
            <View style={styles.online}>
              <View style={[styles.dot, !online && styles.offlineDot]} />
              <Text style={[styles.onlineText, !online && styles.offlineText]}>
                {online ? "ACCOUNT CONNECTED" : "OFFLINE · LOCAL SESSION"}
              </Text>
            </View>
          </View>
          <View style={styles.orb}><CatalystOrb state="idle" size={52} /></View>
        </HudPanel>

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

        <SectionHeading eyebrow="ACCOUNT & DATA" title="Privacy and session" />
        <HudPanel style={styles.settingsPanel}>
          <DetailRow label="Account name" value={state.user.name} />
          <DetailRow label="Email" value={state.user.email} />
          <DetailRow label="Session" value="Active on this device" last />
          <View style={styles.privacyNote}>
            <Text style={styles.privacyMark}>◇</Text>
            <Text style={styles.settingHint}>Settings are stored on this device. AI focus cards make recommendations only and never change your records.</Text>
          </View>
        </HudPanel>

        <TactilePressable accessibilityRole="button" disabled={signingOut} onPress={() => void handleSignOut()} style={[styles.signOut, signingOut && styles.disabled]}>
          {signingOut ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.signOutText}>Sign out of Catalysts <Text style={styles.arrow}>→</Text></Text>}
        </TactilePressable>
        <Text style={styles.footer}>Your session token is stored using secure device storage.</Text>
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

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, last && styles.lastRow]}><Text style={styles.detailLabel}>{label}</Text><Text numberOfLines={1} style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: space.xl, paddingTop: space.lg, paddingBottom: 120, gap: space.md },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.35 },
  dim: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 27, fontWeight: "800", letterSpacing: -0.6, marginTop: -7 },
  identity: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15 },
  initials: { color: colors.lime, fontSize: 19, fontWeight: "800" },
  identityCopy: { flex: 1, gap: 4 },
  name: { color: colors.foreground, fontSize: 16, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 11 },
  online: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.lime },
  onlineText: { color: colors.lime, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  offlineDot: { backgroundColor: colors.amber },
  offlineText: { color: colors.amber },
  orb: { width: 54, height: 54, alignItems: "center", justifyContent: "center", overflow: "hidden" },
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
  detailRow: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  lastRow: { borderBottomWidth: 0 },
  detailLabel: { color: colors.muted, fontSize: 10 },
  detailValue: { maxWidth: "60%", color: colors.foreground, fontSize: 10, fontWeight: "700" },
  privacyNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11, marginTop: 2 },
  privacyMark: { color: colors.cyan, fontSize: 16, fontWeight: "900" },
  signOut: { minHeight: 48, flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: radius.control, borderColor: `${colors.danger}70`, backgroundColor: "#211417" },
  signOutText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  arrow: { fontSize: 15 },
  disabled: { opacity: 0.5 },
  footer: { color: colors.subtle, fontSize: 9, textAlign: "center" },
  status: { alignItems: "flex-start", gap: 10 },
  statusActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { color: colors.danger, fontSize: 10, lineHeight: 15 },
  retryButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.control, borderColor: `${colors.cyan}65`, backgroundColor: "#0E1D24" },
  retryText: { color: colors.cyan, fontSize: 10, fontWeight: "800" },
  resetButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.control, borderColor: "#39474D", backgroundColor: "#11191E" },
  resetText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#000000A8", padding: space.md },
  pickerSheet: { borderRadius: radius.hero, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: space.md },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xs, paddingBottom: space.sm },
  pickerAction: { color: colors.lime, fontSize: 12, fontWeight: "800" },
  pickerTitle: { color: colors.foreground, fontSize: 12, fontWeight: "800" },
});
