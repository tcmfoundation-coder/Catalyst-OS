import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactileIconTile, TactilePressable } from "@/components/ui/TactilePressable";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { createHabit, createMemory, createStudySession, createTask, getTasks, updateTask } from "@/lib/api";
import { colors, radius, space } from "@/theme/tokens";

type CreateKind = "task" | "study" | "habit" | "memory";
const createOptions: { id: CreateKind; title: string; detail: string; icon: string }[] = [
  { id: "task", title: "Task", detail: "Track work and deadlines", icon: "✓" },
  { id: "study", title: "Study log", detail: "Record a completed session", icon: "◷" },
  { id: "habit", title: "Habit", detail: "Add a daily practice", icon: "↗" },
  { id: "memory", title: "Learning memory", detail: "Save an insight or reminder", icon: "✳" },
];
const taskTypes = ["assignment", "exam", "project", "reading", "other"];
const priorities = ["low", "medium", "high"];
const memoryCategories = ["insight", "difficulty", "preference", "reminder", "general"];

function formatDateTime(value: Date | null) {
  if (!value) return "Choose date and time";
  return value.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function combineDateAndTime(current: Date | null, selected: Date, mode: "date" | "time") {
  if (!current) return selected;
  const value = new Date(current);
  if (mode === "date") {
    value.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
  } else {
    value.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
  }
  return value;
}

export default function CreateScreen() {
  const { state } = useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const [kind, setKind] = useState<CreateKind>("task");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [courseId, setCourseId] = useState("");
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [pickerDraft, setPickerDraft] = useState<Date | null>(null);
  const [duration, setDuration] = useState("25");
  const [taskType, setTaskType] = useState("assignment");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("insight");
  const [busy, setBusy] = useState(false);
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || state.status !== "authenticated") return;

    let active = true;
    getTasks(state.token)
      .then((tasks) => {
        if (!active) return;
        const task = tasks.find((item) => item.id === taskId);
        if (!task) {
          setError("This task could not be found. It may have been deleted.");
          return;
        }
        setTitle(task.title);
        setDetails(task.description ?? "");
        setCourseId(task.courseId ?? "");
        setTaskType(task.type);
        setPriority(task.priority);
        setDateTime(task.dueDate ? new Date(task.dueDate) : null);
        setSaved(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load this task.");
      })
      .finally(() => {
        if (active) setLoadedTaskId(taskId);
      });

    return () => {
      active = false;
    };
  }, [state, taskId]);

  const loadingTask = Boolean(taskId && loadedTaskId !== taskId);
  if (state.status !== "authenticated") return null;
  const token = state.token;

  function selectKind(value: CreateKind) {
    if (taskId) return;
    setKind(value);
    setDateTime(value === "study" ? new Date() : null);
    setError(null);
    setSaved(null);
  }

  function openPicker(mode: "date" | "time") {
    setPickerDraft(dateTime ?? new Date());
    setPickerMode(mode);
  }

  function onPickerChange(selected: Date) {
    if (!pickerMode) return;
    const updated = combineDateAndTime(dateTime ?? new Date(), selected, pickerMode);
    setDateTime(updated);
    if (Platform.OS === "android") setPickerMode(null);
    else setPickerDraft(updated);
  }

  async function save() {
    if (busy || loadingTask) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      if (kind === "task") {
        const input = {
          title,
          description: details,
          type: taskType,
          priority,
          dueDate: dateTime?.toISOString() ?? "",
          courseId,
        };
        const result = taskId
          ? await updateTask(token, taskId, input)
          : await createTask(token, input);
        const message = taskId ? "Task updated" : "Task added";
        showToast(`${message}: ${result.title}`);
        if (taskId) {
          router.replace("/command");
          return;
        }
        setSaved(`${message}: ${result.title}`);
        setTitle(""); setDetails(""); setDateTime(null);
      } else if (kind === "study") {
        const result = await createStudySession(token, { date: (dateTime ?? new Date()).toISOString(), durationMinutes: duration, courseId: "", notes: details });
        setSaved(`Study session logged: ${result.durationMinutes} minutes`);
        showToast(`Study session logged: ${result.durationMinutes} minutes`);
        setDetails(""); setDuration("25"); setDateTime(new Date());
      } else if (kind === "habit") {
        const result = await createHabit(token, { name: title, description: details });
        setSaved(`Habit added: ${result.name}`);
        showToast(`Habit added: ${result.name}`);
        setTitle(""); setDetails("");
      } else {
        const result = await createMemory(token, { content: details || title, category, courseId: "" });
        setSaved(`${result.category} memory saved to your account`);
        showToast(`${result.category} memory saved`);
        setTitle(""); setDetails("");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save this item.";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  const valid = kind === "task" || kind === "habit"
    ? title.trim().length >= 2
    : kind === "study"
      ? Number(duration) > 0 && Number(duration) <= 1440
      : (details || title).trim().length >= 2;
  const selected = createOptions.find((option) => option.id === kind)!;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>ACADEMIC SYSTEM <Text style={styles.dim}>/ CREATE</Text></Text>
        <Text style={styles.title}>{taskId ? "Edit your task" : "Add to your system"}</Text>
        <Text style={styles.subtitle}>{taskId ? "Update the details and deadline for this task." : "Saved items are attached to your Catalysts account."}</Text>

        {!taskId ? <View style={styles.optionGrid}>
          {createOptions.map((option) => <TactilePressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: kind === option.id }} onPress={() => selectKind(option.id)} style={[styles.option, kind === option.id && styles.optionActive]}>
            <TactileIconTile color={kind === option.id ? colors.lime : colors.cyan} size={37} style={styles.optionIconTile}>
              <Text style={[styles.optionIcon, kind === option.id && styles.optionIconActive]}>{option.icon}</Text>
            </TactileIconTile>
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionDetail}>{option.detail}</Text>
          </TactilePressable>)}
        </View> : null}

        <HudPanel style={styles.form}>
          <View style={styles.formHeading}><Text style={styles.formEyebrow}>{taskId ? "UPDATE TASK" : `NEW ${selected.title.toUpperCase()}`}</Text><Text style={styles.formTitle}>{taskId ? "Task details" : selected.title}</Text></View>

          {loadingTask ? <View style={styles.loading}><ActivityIndicator color={colors.lime} /><Text style={styles.loadingText}>Loading task details…</Text></View> : null}

          {!loadingTask && kind === "task" ? <>
            <Field label="TASK TITLE" value={title} onChangeText={setTitle} placeholder="e.g. Submit problem set 3" />
            <Field label="DETAILS · OPTIONAL" value={details} onChangeText={setDetails} placeholder="Add context or a short note" multiline />
            <Text style={styles.label}>TASK TYPE</Text><ChoiceRow values={taskTypes} selected={taskType} onSelect={setTaskType} />
            <Text style={styles.label}>PRIORITY</Text><ChoiceRow values={priorities} selected={priority} onSelect={setPriority} />
            <DateTimeField label="DUE DATE · OPTIONAL" value={dateTime} onPick={openPicker} onClear={() => setDateTime(null)} />
          </> : null}

          {!loadingTask && kind === "study" ? <>
            <DateTimeField label="SESSION DATE & TIME" value={dateTime ?? new Date()} onPick={openPicker} />
            <Field label="DURATION · MINUTES" value={duration} onChangeText={setDuration} placeholder="25" keyboardType="number-pad" />
            <Field label="SESSION NOTES · OPTIONAL" value={details} onChangeText={setDetails} placeholder="What did you study?" multiline />
          </> : null}

          {!loadingTask && kind === "habit" ? <>
            <Field label="HABIT NAME" value={title} onChangeText={setTitle} placeholder="e.g. Review lecture notes" />
            <Field label="DETAILS · OPTIONAL" value={details} onChangeText={setDetails} placeholder="When or how you plan to do it" multiline />
          </> : null}

          {!loadingTask && kind === "memory" ? <>
            <Field label="WHAT DO YOU WANT TO REMEMBER?" value={details} onChangeText={setDetails} placeholder="Write an insight, difficulty, preference, or reminder" multiline />
            <Text style={styles.label}>CATEGORY</Text><ChoiceRow values={memoryCategories} selected={category} onSelect={setCategory} />
          </> : null}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {saved ? (
            <View style={styles.saved}>
              <Text style={styles.savedIcon}>✓</Text>
              <Text style={styles.savedText}>{saved}</Text>
              {kind === "task" ? <Link href="/command" asChild><Pressable><Text style={styles.savedLink}>Open command center →</Text></Pressable></Link> : null}
            </View>
          ) : null}

          <TactilePressable accessibilityRole="button" disabled={!valid || busy || loadingTask} onPress={() => void save()} style={[styles.submit, (!valid || busy || loadingTask) && styles.submitDisabled]}>
            {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.submitText}>{taskId ? "Save task changes" : `Save ${selected.title.toLowerCase()}`} <Text style={styles.submitArrow}>→</Text></Text>}
          </TactilePressable>
        </HudPanel>
        <Text style={styles.footer}>Data is validated and saved through Catalysts Core.</Text>
      </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        transparent
        animationType="slide"
        visible={Platform.OS === "ios" && pickerMode !== null}
        onRequestClose={() => setPickerMode(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setPickerMode(null)}><Text style={styles.pickerAction}>Cancel</Text></Pressable>
              <Text style={styles.pickerTitle}>Choose {pickerMode === "time" ? "time" : "date"}</Text>
              <Pressable onPress={() => { if (pickerDraft) setDateTime(pickerDraft); setPickerMode(null); }}><Text style={styles.pickerAction}>Done</Text></Pressable>
            </View>
            {pickerMode && pickerDraft ? (
              <DateTimePicker
                value={pickerDraft}
                mode={pickerMode}
                display="spinner"
                themeVariant="dark"
                accentColor={colors.lime}
                maximumDate={kind === "study" && pickerMode === "date" ? new Date() : undefined}
                onValueChange={(_event, value) => setPickerDraft(combineDateAndTime(pickerDraft, value, pickerMode))}
              />
            ) : null}
          </View>
        </View>
      </Modal>
      {Platform.OS === "android" && pickerMode ? (
        <DateTimePicker
          value={dateTime ?? new Date()}
          mode={pickerMode}
          presentation="dialog"
          accentColor={colors.lime}
          maximumDate={kind === "study" && pickerMode === "date" ? new Date() : undefined}
          onValueChange={(_event, value) => onPickerChange(value)}
          onDismiss={() => setPickerMode(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function DateTimeField({ label, value, onPick, onClear }: { label: string; value: Date | null; onPick: (mode: "date" | "time") => void; onClear?: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateActions}>
        <TactilePressable accessibilityRole="button" onPress={() => onPick("date")} style={styles.dateButton}>
          <Text style={styles.dateIcon}>▦</Text><Text style={styles.dateText}>{value ? value.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Choose date"}</Text>
        </TactilePressable>
        <TactilePressable accessibilityRole="button" onPress={() => onPick("time")} style={styles.dateButton}>
          <Text style={styles.dateIcon}>◷</Text><Text style={styles.dateText}>{value ? value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Choose time"}</Text>
        </TactilePressable>
      </View>
      {onClear ? (
        <View style={styles.dateFooter}>
          <Text style={styles.dateHint}>{value ? formatDateTime(value) : "No deadline set"}</Text>
          {value ? <Pressable accessibilityRole="button" onPress={onClear}><Text style={styles.clearDate}>Clear</Text></Pressable> : null}
        </View>
      ) : <Text style={styles.dateHint}>{value ? formatDateTime(value) : "Defaults to now"}</Text>}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; keyboardType?: "default" | "number-pad" | "numbers-and-punctuation" }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle} multiline={multiline} keyboardType={keyboardType} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function ChoiceRow({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={styles.choices}>{values.map((value) => <Pressable key={value} onPress={() => onSelect(value)} style={[styles.choice, selected === value && styles.choiceActive]}><Text style={[styles.choiceText, selected === value && styles.choiceTextActive]}>{value.replaceAll("_", " ")}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: space.xl, paddingTop: space.lg, paddingBottom: 112, gap: space.md },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.35 },
  dim: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 27, fontWeight: "800", letterSpacing: -0.5, marginTop: -7 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: -8 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { width: "48%", minHeight: 112, borderRadius: radius.panel, backgroundColor: colors.surfaceRaised, padding: 11, gap: 4, justifyContent: "center" },
  optionActive: { borderColor: `${colors.lime}8A`, backgroundColor: "#17231A" },
  optionIconTile: { marginBottom: 2 },
  optionIcon: { color: colors.cyan, fontSize: 17, fontWeight: "800", textShadowColor: colors.cyan, textShadowRadius: 6 },
  optionIconActive: { color: colors.lime, textShadowColor: colors.lime },
  optionTitle: { color: colors.foreground, fontSize: 12, fontWeight: "800" },
  optionDetail: { color: colors.muted, fontSize: 8, lineHeight: 12 },
  form: { gap: 13, padding: 15 },
  formHeading: { gap: 3, marginBottom: 2 },
  formEyebrow: { color: colors.cyan, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  formTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
  loading: { minHeight: 90, alignItems: "center", justifyContent: "center", gap: 9 },
  loadingText: { color: colors.muted, fontSize: 11 },
  field: { gap: 7 },
  label: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },
  input: { minHeight: 46, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, color: colors.foreground, paddingHorizontal: 12, fontSize: 12 },
  multiline: { minHeight: 74, paddingTop: 11, textAlignVertical: "top" },
  dateActions: { flexDirection: "row", gap: 8 },
  dateButton: { minHeight: 44, flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.control, backgroundColor: colors.surface, paddingHorizontal: 10 },
  dateIcon: { color: colors.cyan, fontSize: 15 },
  dateText: { color: colors.foreground, flexShrink: 1, fontSize: 10, fontWeight: "600" },
  dateFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateHint: { color: colors.subtle, fontSize: 9 },
  clearDate: { color: colors.cyan, fontSize: 9, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000099" },
  pickerSheet: { borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingBottom: space.xl },
  pickerHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, borderBottomWidth: 1, borderBottomColor: colors.line },
  pickerTitle: { color: colors.foreground, fontSize: 12, fontWeight: "700" },
  pickerAction: { color: colors.lime, fontSize: 12, fontWeight: "800" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -7 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: colors.background },
  choiceActive: { borderColor: `${colors.cyan}88`, backgroundColor: `${colors.cyan}16` },
  choiceText: { color: colors.muted, fontSize: 9, textTransform: "capitalize" },
  choiceTextActive: { color: colors.cyan, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  saved: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, padding: 10, borderRadius: radius.control, backgroundColor: `${colors.lime}10`, borderWidth: 1, borderColor: `${colors.lime}35` },
  savedIcon: { color: colors.lime, fontSize: 12, fontWeight: "900" },
  savedText: { flex: 1, color: colors.foreground, fontSize: 10, fontWeight: "700" },
  savedLink: { color: colors.lime, fontSize: 9, fontWeight: "800" },
  submit: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.control, backgroundColor: colors.lime, marginTop: 3, borderColor: "#D4FF9A", borderBottomColor: "#79A83C" },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: colors.black, fontSize: 12, fontWeight: "900" },
  submitArrow: { fontSize: 15 },
  footer: { color: colors.subtle, fontSize: 8, textAlign: "center" },
});
