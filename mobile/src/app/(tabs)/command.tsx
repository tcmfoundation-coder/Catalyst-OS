import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, deleteTask, getTasks, updateTaskStatus, type MobileTask } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactileIconTile, TactilePressable } from "@/components/ui/TactilePressable";
import { useToast } from "@/components/ui/ToastProvider";
import { colors, radius, space } from "@/theme/tokens";

export default function CommandCenterScreen() {
  const { state, signOut } = useAuth();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);

  const loadTasks = useCallback(async (refresh = false) => {
    if (state.status !== "authenticated") return;
    setError(null);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setTasks(await getTasks(state.token));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await signOut();
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not load your tasks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut, state]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    let active = true;
    getTasks(state.token)
      .then((result) => { if (active) setTasks(result); })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          void signOut();
          return;
        }
        setError(cause instanceof Error ? cause.message : "Could not load your tasks.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signOut, state]);

  async function toggleTask(task: MobileTask) {
    if (state.status !== "authenticated") return;
    setBusyTask(task.id);
    try {
      const nextStatus = task.status === "completed" ? "todo" : "completed";
      await updateTaskStatus(state.token, task.id, nextStatus);
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
      showToast(nextStatus === "completed" ? "Task completed" : "Task reopened");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not update the task.";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyTask(null);
    }
  }

  function confirmDeleteTask(task: MobileTask) {
    Alert.alert(
      "Delete this task?",
      `"${task.title}" will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete task",
          style: "destructive",
          onPress: () => void removeTask(task),
        },
      ],
    );
  }

  async function removeTask(task: MobileTask) {
    if (state.status !== "authenticated") return;
    setBusyTask(task.id);
    try {
      await deleteTask(state.token, task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      showToast("Task deleted");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not delete the task.";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyTask(null);
    }
  }

  if (state.status !== "authenticated") return null;
  const openTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadTasks(true)} tintColor={colors.lime} />}>
        <Text style={styles.eyebrow}>CATALYSTS CORE <Text style={styles.dim}>/ DAILY SYSTEM</Text></Text>
        <Text style={styles.title}>Command center</Text>
        <Text style={styles.subtitle}>Your next actions, pulled from your task list.</Text>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.eyebrow}>ACADEMIC WORKSPACE</Text><Text style={styles.sectionTitle}>Your system</Text></View>
        </View>
        <View style={styles.shortcuts}>
          <Link href="/academic" asChild><TactilePressable accessibilityRole="button" style={styles.shortcut}><TactileIconTile color={colors.lime} size={38}><Text style={[styles.shortcutIcon, styles.lime]}>◈</Text></TactileIconTile><Text style={styles.shortcutTitle}>Academic setup</Text><Text style={styles.shortcutMeta}>Years · courses · grades</Text></TactilePressable></Link>
          <Link href="/materials" asChild><TactilePressable accessibilityRole="button" style={styles.shortcut}><TactileIconTile color={colors.cyan} size={38}><Text style={[styles.shortcutIcon, styles.cyan]}>▧</Text></TactileIconTile><Text style={styles.shortcutTitle}>Study materials</Text><Text style={styles.shortcutMeta}>Upload · processing status</Text></TactilePressable></Link>
          <Link href="/study-notes" asChild><TactilePressable accessibilityRole="button" style={styles.shortcut}><TactileIconTile color={colors.amber} size={38}><Text style={[styles.shortcutIcon, styles.amber]}>≋</Text></TactileIconTile><Text style={styles.shortcutTitle}>Study notes</Text><Text style={styles.shortcutMeta}>Generate · read · manage</Text></TactilePressable></Link>
        </View>

        <View style={styles.metrics}>
          <HudPanel style={styles.metric}><Text style={styles.metricValue}>{openTasks.length}</Text><Text style={styles.metricLabel}>OPEN TASKS</Text></HudPanel>
          <HudPanel style={styles.metric}><Text style={[styles.metricValue, styles.cyan]}>{completedTasks.length}</Text><Text style={styles.metricLabel}>COMPLETED</Text></HudPanel>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.eyebrow}>MISSION QUEUE</Text><Text style={styles.sectionTitle}>Tasks</Text></View>
          <Link href="/create" asChild><TactilePressable accessibilityRole="button" style={styles.addButton}><Text style={styles.addText}>+ New task</Text></TactilePressable></Link>
        </View>

        {loading ? <HudPanel style={styles.statePanel}><ActivityIndicator color={colors.lime} /><Text style={styles.muted}>Loading your tasks…</Text></HudPanel> : null}
        {error ? <HudPanel style={styles.statePanel}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void loadTasks()}><Text style={styles.addText}>Try again →</Text></Pressable></HudPanel> : null}
        {!loading && !error && tasks.length === 0 ? (
          <HudPanel style={styles.empty}><Text style={styles.emptyMark}>✳</Text><Text style={styles.sectionTitle}>Queue is clear</Text><Text style={styles.muted}>Add a task when you have something to track.</Text></HudPanel>
        ) : null}

        {openTasks.map((task) => <TaskCard key={task.id} task={task} busy={busyTask === task.id} onToggle={() => void toggleTask(task)} onDelete={() => confirmDeleteTask(task)} />)}
        {completedTasks.length > 0 ? (
          <HudPanel style={styles.completedPanel}>
            <Text style={styles.eyebrow}>RECENTLY COMPLETED</Text>
            {completedTasks.slice(0, 4).map((task) => <TaskCard key={task.id} task={task} busy={busyTask === task.id} onToggle={() => void toggleTask(task)} onDelete={() => confirmDeleteTask(task)} compact />)}
          </HudPanel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskCard({ task, busy, onToggle, onDelete, compact = false }: { task: MobileTask; busy: boolean; onToggle: () => void; onDelete: () => void; compact?: boolean }) {
  const due = task.dueDate ? new Date(task.dueDate).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No due date";
  return (
    <HudPanel style={[styles.taskCard, compact ? styles.compactCard : undefined]}>
      <TactilePressable accessibilityRole="checkbox" accessibilityState={{ checked: task.status === "completed" }} disabled={busy} onPress={onToggle} style={[styles.check, task.status === "completed" && styles.checked]}>
        {busy ? <ActivityIndicator size="small" color={colors.lime} /> : task.status === "completed" ? <Text style={styles.tick}>✓</Text> : null}
      </TactilePressable>
      <View style={styles.taskCopy}>
        <Text numberOfLines={2} style={[styles.taskTitle, task.status === "completed" && styles.done]}>{task.title}</Text>
        <Text style={styles.taskMeta}>{[task.courseCode, task.type.replaceAll("_", " "), due].filter(Boolean).join(" · ")}</Text>
        <View style={styles.taskActions}>
          <Link href={{ pathname: "/create", params: { taskId: task.id } }} asChild>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.taskAction}>
              <Text style={styles.editAction}>Edit</Text>
            </Pressable>
          </Link>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${task.title}`} disabled={busy} onPress={onDelete} style={styles.taskAction}>
            {busy ? <ActivityIndicator size="small" color={colors.subtle} /> : <Text style={styles.deleteAction}>Delete</Text>}
          </Pressable>
        </View>
      </View>
      <View style={[styles.priority, task.priority === "high" && styles.highPriority]}><Text style={styles.priorityText}>{task.priority.toUpperCase()}</Text></View>
    </HudPanel>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: space.xl, paddingTop: space.lg, paddingBottom: 112, gap: space.md },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.35 },
  dim: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 29, fontWeight: "800", letterSpacing: -0.6, marginTop: -7 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: -8 },
  metrics: { flexDirection: "row", gap: space.sm, marginVertical: space.xs },
  metric: { flex: 1, gap: 4, paddingVertical: 14 },
  metricValue: { color: colors.lime, fontSize: 25, fontWeight: "800" },
  cyan: { color: colors.cyan },
  amber: { color: colors.amber },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  shortcut: { flexGrow: 1, flexBasis: "46%", minHeight: 124, borderRadius: radius.panel, backgroundColor: colors.surfaceRaised, padding: 13, justifyContent: "space-between" },
  shortcutIcon: { color: colors.lime, fontSize: 19, fontWeight: "900", textShadowColor: colors.lime, textShadowRadius: 6 },
  lime: { color: colors.lime, textShadowColor: colors.lime },
  shortcutTitle: { color: colors.foreground, fontSize: 12, fontWeight: "700" },
  shortcutMeta: { color: colors.muted, fontSize: 9 },
  metricLabel: { color: colors.subtle, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.xs },
  sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700", marginTop: 4 },
  addButton: { backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 9, borderColor: "#D4FF9A", borderBottomColor: "#79A83C" },
  addText: { color: colors.black, fontSize: 11, fontWeight: "800" },
  statePanel: { alignItems: "center", gap: 10, paddingVertical: space.xl },
  empty: { alignItems: "center", gap: 7, paddingVertical: 27 },
  emptyMark: { color: colors.cyan, fontSize: 28 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  error: { color: colors.danger, fontSize: 12, textAlign: "center" },
  taskCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13 },
  compactCard: { paddingHorizontal: 0, borderWidth: 0, backgroundColor: "transparent", borderRadius: 0, borderTopWidth: 1, borderTopColor: colors.line },
  check: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checked: { borderColor: colors.lime, backgroundColor: `${colors.lime}24` },
  tick: { color: colors.lime, fontSize: 14, fontWeight: "900" },
  taskCopy: { flex: 1, gap: 5 },
  taskActions: { flexDirection: "row", gap: 14, marginTop: 2 },
  taskAction: { minHeight: 28, justifyContent: "center" },
  editAction: { color: colors.cyan, fontSize: 10, fontWeight: "800" },
  deleteAction: { color: colors.danger, fontSize: 10, fontWeight: "800" },
  taskTitle: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
  done: { color: colors.subtle, textDecorationLine: "line-through" },
  taskMeta: { color: colors.muted, fontSize: 9, textTransform: "capitalize" },
  priority: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 7, paddingVertical: 4 },
  highPriority: { borderColor: `${colors.amber}88`, backgroundColor: `${colors.amber}12` },
  priorityText: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 0.6 },
  completedPanel: { gap: 10 },
});
