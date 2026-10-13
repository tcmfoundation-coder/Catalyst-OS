import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getApiBaseUrl, getDashboard, type DashboardResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const colors = {
  background: "#080B10",
  surface: "#101820",
  line: "#26343E",
  foreground: "#E6EDF2",
  muted: "#8495A2",
  accent: "#A5F34B",
  caution: "#F6C75C",
};

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  return `Due ${new Date(value).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" })}`;
}

export default function DashboardScreen() {
  const { state, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (state.status !== "authenticated") return;
    setError(null);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setDashboard(await getDashboard(state.token));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await signOut();
        return;
      }
      setError(cause instanceof Error ? cause.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut, state]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    let active = true;
    getDashboard(state.token)
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          void signOut();
          return;
        }
        setError(cause instanceof Error ? cause.message : "Could not load your dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [signOut, state]);

  if (state.status !== "authenticated") return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={colors.accent} />
        }
      >
        <View style={styles.topbar}>
          <View>
            <Text style={styles.eyebrow}>CATALYSTS · PERSONAL ACADEMIC SYSTEM</Text>
            <Text style={styles.greeting}>Welcome back, {state.user.name.split(" ")[0]}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Loading your academic data…</Text>
          </View>
        ) : error ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Dashboard unavailable</Text>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={() => void loadDashboard()} style={styles.actionButton}>
              <Text style={styles.actionText}>Try again</Text>
            </Pressable>
          </View>
        ) : dashboard ? (
          <>
            {dashboard.academic ? (
              <>
                <View style={styles.hero}>
                  <Text style={styles.eyebrow}>CURRENT ACADEMIC CYCLE</Text>
                  <Text style={styles.heroTitle}>{dashboard.academic.semester ?? dashboard.academic.year}</Text>
                  <Text style={styles.muted}>Academic year {dashboard.academic.year}</Text>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>SYSTEM ONLINE</Text>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <Stat label="Cumulative GPA" value={dashboard.academic.cgpa.toFixed(2)} detail="ACADEMIC INDEX" />
                  <Stat label="Semester GPA" value={dashboard.academic.semesterGpa.toFixed(2)} detail="CURRENT CYCLE" />
                  <Stat label="Units completed" value={String(dashboard.academic.completedCreditUnits)} detail="CREDITS BANKED" />
                  <Stat label="Units remaining" value={String(dashboard.academic.remainingCreditUnits)} detail="TO COMPLETION" />
                </View>
              </>
            ) : (
              <View style={styles.panel}>
                <Text style={styles.eyebrow}>ACADEMICS</Text>
                <Text style={styles.sectionTitle}>No current academic year</Text>
                <Text style={styles.muted}>Your account has no academic year marked as current.</Text>
                {getApiBaseUrl() && (
                  <Pressable onPress={() => void Linking.openURL(`${getApiBaseUrl()}/dashboard/academic-years`)} style={styles.actionButton}>
                    <Text style={styles.actionText}>Manage academics on web</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mission queue</Text>
                <Text style={styles.eyebrow}>{dashboard.tasks.length} OPEN</Text>
              </View>
              {dashboard.tasks.length ? dashboard.tasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <View style={styles.taskMarker} />
                  <View style={styles.taskCopy}>
                    <Text numberOfLines={1} style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.mutedSmall}>{[task.courseCode, formatDueDate(task.dueDate)].filter(Boolean).join(" · ")}</Text>
                  </View>
                </View>
              )) : <Text style={styles.muted}>No open tasks right now.</Text>}
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Focus telemetry</Text>
              <View style={styles.telemetryRow}>
                <Telemetry label="Study today" value={dashboard.study.today} />
                <Telemetry label="This week" value={dashboard.study.thisWeek} />
                <Telemetry label="Habits today" value={dashboard.habits.total ? `${dashboard.habits.completedToday}/${dashboard.habits.total}` : "—"} />
              </View>
            </View>

            {dashboard.academic?.courses.length ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Current courses</Text>
                {dashboard.academic.courses.map((course) => (
                  <View key={course.id} style={styles.courseRow}>
                    <Text style={styles.courseCode}>{course.code}</Text>
                    <Text numberOfLines={1} style={styles.courseTitle}>{course.title}</Text>
                    <Text style={styles.courseGrade}>{course.grade ?? "—"}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.eyebrow}>{detail}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Telemetry({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.telemetryItem}>
      <Text style={styles.mutedSmall}>{label}</Text>
      <Text style={styles.telemetryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 20, paddingBottom: 40, gap: 14 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1.7 },
  greeting: { color: colors.foreground, fontSize: 23, fontWeight: "700", marginTop: 7 },
  signOutButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, borderColor: colors.line, borderWidth: 1 },
  signOutText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  hero: { overflow: "hidden", borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: "#111A22", padding: 20, gap: 8 },
  heroTitle: { color: colors.foreground, fontSize: 28, lineHeight: 34, fontWeight: "700" },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#A5F34B33", backgroundColor: "#A5F34B0D", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  statusText: { color: colors.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1.2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", flexGrow: 1, minHeight: 110, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 14, justifyContent: "space-between" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 13 },
  statValue: { color: colors.foreground, fontSize: 28, fontWeight: "700", marginTop: 3 },
  panel: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 17, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { color: colors.foreground, fontSize: 15, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  mutedSmall: { color: colors.muted, fontSize: 11, marginTop: 4 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  taskMarker: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.caution },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
  telemetryRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  telemetryItem: { flex: 1, gap: 7 },
  telemetryValue: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11 },
  courseCode: { width: 76, color: colors.accent, fontSize: 10, fontWeight: "700" },
  courseTitle: { flex: 1, color: colors.muted, fontSize: 12 },
  courseGrade: { color: colors.foreground, fontSize: 12, fontWeight: "700" },
  loading: { padding: 40, alignItems: "center", gap: 12 },
  actionButton: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 9, backgroundColor: colors.accent, marginTop: 2 },
  actionText: { color: colors.background, fontSize: 12, fontWeight: "700" },
});
