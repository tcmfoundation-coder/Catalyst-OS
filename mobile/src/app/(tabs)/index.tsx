import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ApiError,
  getApiBaseUrl,
  getDailyPriority,
  getDashboard,
  type DailyPriorityResponse,
  type DashboardResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAppSettings } from "@/lib/settings-context";
import { CatalystBrand } from "@/components/brand/CatalystBrand";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactilePressable } from "@/components/ui/TactilePressable";
import { PerformanceTrendCard } from "@/components/dashboard/PerformanceTrendCard";
import { colors, radius, space } from "@/theme/tokens";

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  return `Due ${new Date(value).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" })}`;
}

function creditProgress(completed: number, remaining: number) {
  const total = completed + remaining;
  return total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : null;
}

export default function DashboardScreen() {
  const { state, signOut } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dailyPriority, setDailyPriority] = useState<DailyPriorityResponse["recommendation"] | null>(null);
  const [priorityLoading, setPriorityLoading] = useState(true);
  const [priorityError, setPriorityError] = useState<string | null>(null);
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

  const loadDailyPriority = useCallback(async () => {
    if (state.status !== "authenticated") return;
    setPriorityLoading(true);
    setPriorityError(null);
    try {
      const result = await getDailyPriority(state.token);
      setDailyPriority(result.recommendation);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await signOut();
        return;
      }
      setPriorityError(cause instanceof Error ? cause.message : "Could not load today's AI priority.");
    } finally {
      setPriorityLoading(false);
    }
  }, [signOut, state]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    let active = true;
    const load = async () => {
      try {
        const result = await getDailyPriority(state.token);
        if (active) setDailyPriority(result.recommendation);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          await signOut();
          return;
        }
        setPriorityError(cause instanceof Error ? cause.message : "Could not load today's AI priority.");
      } finally {
        if (active) setPriorityLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [signOut, state]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    let active = true;
    getDashboard(state.token)
      .then((result) => { if (active) setDashboard(result); })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) { void signOut(); return; }
        setError(cause instanceof Error ? cause.message : "Could not load your dashboard.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signOut, state]);

  if (state.status !== "authenticated") return null;
  const academic = dashboard?.academic;
  const progress = academic ? creditProgress(academic.completedCreditUnits, academic.remainingCreditUnits) : null;
  const maxCourseUnits = academic?.courses.reduce((max, course) => Math.max(max, course.creditUnits), 0) ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadDashboard(true); void loadDailyPriority(); }} tintColor={colors.lime} />}
      >
        <View style={styles.topbar}>
          <CatalystBrand compact />
          <Link href="/profile" asChild>
            <TactilePressable accessibilityRole="button" accessibilityLabel="Open your profile" style={styles.profileButton}>
              <View style={styles.profileInset}><Text style={styles.profileInitial}>{state.user.name.slice(0, 1).toUpperCase()}</Text></View>
              <View><Text style={styles.profileLabel}>PROFILE</Text><Text style={styles.profileName}>{state.user.name.split(" ")[0]}</Text></View>
              <Text style={styles.chevron}>›</Text>
            </TactilePressable>
          </Link>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.eyebrow}>PERSONAL ACADEMIC OS <Text style={styles.eyebrowDivider}>/</Text> COMMAND DECK</Text>
          <Text style={styles.greeting}>Good to see you, {state.user.name.split(" ")[0]}</Text>
          <Text style={styles.subtitle}>Your semester, signals, and next move in one place.</Text>
        </View>

        {loading ? (
          <HudPanel style={styles.statePanel}><ActivityIndicator color={colors.lime} /><Text style={styles.muted}>Calibrating your academic system…</Text></HudPanel>
        ) : error ? (
          <HudPanel style={styles.errorPanel}>
            <Text style={styles.eyebrowAmber}>SYSTEM CONNECTION <Text style={styles.eyebrowDivider}>/</Text> INTERRUPTED</Text>
            <Text style={styles.sectionTitle}>Your dashboard is unavailable</Text>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={() => void loadDashboard()} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><Text style={styles.actionText}>Reconnect</Text></Pressable>
          </HudPanel>
        ) : dashboard ? (
          <>
            <HudPanel style={styles.corePanel}>
              <View style={styles.coreHeader}>
                <View style={styles.coreCopy}>
                  <View style={styles.onlineBadge}><View style={styles.onlineDot} /><Text style={styles.onlineText}>CORE ONLINE</Text></View>
                  <Text style={styles.coreEyebrow}>CURRENT CYCLE</Text>
                  <Text numberOfLines={2} style={styles.coreTitle}>{academic?.semester ?? academic?.year ?? "Your workspace"}</Text>
                  <Text style={styles.coreSub}>{academic ? `Academic year ${academic.year}` : "Set up your academic year to begin."}</Text>
                </View>
                <Link href="/assistant" asChild>
                  <TactilePressable accessibilityRole="button" accessibilityLabel="Talk to Catalyst AI" style={styles.orbButton}>
                    <CatalystOrb state="idle" size={128} />
                  </TactilePressable>
                </Link>
              </View>
              <View style={styles.coreFooter}>
                <View style={styles.coreFooterLine} />
                <Text style={styles.coreFooterLabel}>TAP THE CORE</Text>
                <Text style={styles.coreFooterCopy}>Ask Catalyst about your study plan</Text>
                <Text style={styles.coreFooterArrow}>↗</Text>
              </View>
              {!academic ? (
                <View style={styles.setupHint}>
                  <Text style={styles.mutedSmall}>No academic year is linked yet.</Text>
                  {getApiBaseUrl() ? <Pressable onPress={() => void Linking.openURL(`${getApiBaseUrl()}/dashboard/academic-years`)}><Text style={styles.inlineLink}>Set up academics on web →</Text></Pressable> : null}
                </View>
              ) : null}
            </HudPanel>

            <DailyPriorityCard
              recommendation={dailyPriority}
              loading={priorityLoading}
              error={priorityError}
              onRetry={() => void loadDailyPriority()}
            />

            {academic ? (
              <>
                <HudPanel style={styles.progressPanel}>
                  <View style={styles.sectionHeader}>
                    <View><Text style={styles.eyebrow}>DEGREE TRAJECTORY</Text><Text style={styles.sectionTitle}>Credit path</Text></View>
                    {progress !== null ? <View style={styles.percentBadge}><Text style={styles.percentValue}>{progress}%</Text><Text style={styles.percentCaption}>EARNED</Text></View> : <Text style={styles.courseCount}>NO CREDIT DATA</Text>}
                  </View>
                  <View style={styles.progressTrackOuter}>
                    <View style={styles.progressTrackInset}><View style={[styles.progressFill, { width: `${progress ?? 0}%` }]} /></View>
                  </View>
                  <View style={styles.progressLegend}>
                    <View style={styles.legendItem}><View style={styles.legendDot} /><Text style={styles.legendLabel}>COMPLETED</Text><Text style={styles.legendValue}>{academic.completedCreditUnits}</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendDotRemaining]} /><Text style={styles.legendLabel}>REMAINING</Text><Text style={styles.legendValue}>{academic.remainingCreditUnits}</Text></View>
                  </View>
                </HudPanel>

                <View style={styles.statsGrid}>
                  <MetricCard label="Cumulative GPA" value={academic.cgpa.toFixed(2)} detail="ALL COURSES" tone="lime" />
                  <MetricCard label="Semester GPA" value={academic.semesterGpa.toFixed(2)} detail="CURRENT CYCLE" tone="cyan" />
                </View>
              </>
            ) : null}

            <HudPanel style={styles.panel}>
              <View style={styles.sectionHeader}>
                <View><Text style={styles.eyebrow}>FOCUS TELEMETRY</Text><Text style={styles.sectionTitle}>Study rhythm</Text></View>
                <View style={styles.telemetryMark}><View style={styles.telemetryLiveDot} /><Text style={styles.telemetryLiveText}>LIVE</Text></View>
              </View>
              <View style={styles.telemetryGrid}>
                <Telemetry label="TODAY" value={dashboard.study.today} />
                <Telemetry label="7-DAY TOTAL" value={dashboard.study.thisWeek} />
                <Telemetry label="HABITS" value={dashboard.habits.total ? `${dashboard.habits.completedToday}/${dashboard.habits.total}` : "—"} />
              </View>
            </HudPanel>

            {!settingsLoading ? (
              <WeeklyGoalCard minutes={dashboard.study.thisWeekMinutes} goalHours={settings.weeklyStudyGoalHours} />
            ) : null}

            <PerformanceTrendCard trend={dashboard.performance} />

            {academic?.courses.length ? (
              <HudPanel style={styles.panel}>
                <View style={styles.sectionHeader}>
                  <View><Text style={styles.eyebrow}>LIVE COURSE LOAD</Text><Text style={styles.sectionTitle}>Current courses</Text></View>
                  <Text style={styles.courseCount}>{academic.courses.length} COURSES</Text>
                </View>
                <View style={styles.courseChart}>
                  {academic.courses.map((course) => (
                    <View key={course.id} style={styles.courseChartRow}>
                      <Text numberOfLines={1} style={styles.courseCode}>{course.code}</Text>
                      <View style={styles.courseTrack}><View style={[styles.courseFill, { width: `${maxCourseUnits ? Math.max(8, (course.creditUnits / maxCourseUnits) * 100) : 0}%` }]} /></View>
                      <Text style={styles.courseUnits}>{course.creditUnits} <Text style={styles.courseUnitLabel}>CU</Text></Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.chartCaption}>Bar length shows credit units in this semester.</Text>
              </HudPanel>
            ) : null}

            <HudPanel style={styles.panel}>
              <View style={styles.sectionHeader}>
                <View><Text style={styles.eyebrow}>NEXT ACTIONS</Text><Text style={styles.sectionTitle}>Mission queue</Text></View>
                <Text style={styles.countBadge}>{dashboard.tasks.length} OPEN</Text>
              </View>
              {dashboard.tasks.length ? dashboard.tasks.map((task) => (
                <Link key={task.id} href="/command" asChild>
                  <Pressable style={({ pressed }) => [styles.taskRow, pressed && styles.taskPressed]}>
                    <View style={styles.taskMarker} />
                    <View style={styles.taskCopy}><Text numberOfLines={1} style={styles.taskTitle}>{task.title}</Text><Text style={styles.mutedSmall}>{[task.courseCode, formatDueDate(task.dueDate)].filter(Boolean).join(" · ")}</Text></View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </Link>
              )) : <Text style={styles.muted}>No open tasks right now.</Text>}
            </HudPanel>
          </>
        ) : null}
        <Text style={styles.footer}>CATALYST CORE <Text style={styles.eyebrowDivider}>·</Text> PERSONAL ACADEMIC OS</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DailyPriorityCard({
  recommendation,
  loading,
  error,
  onRetry,
}: {
  recommendation: DailyPriorityResponse["recommendation"] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <HudPanel style={styles.priorityPanel}>
      <View style={styles.priorityHeader}>
        <View style={styles.priorityIcon}><Text style={styles.priorityIconText}>✦</Text></View>
        <View style={styles.priorityHeading}>
          <Text style={styles.eyebrow}>AI FOCUS · READ ONLY</Text>
          <Text style={styles.sectionTitle}>Priority of the day</Text>
        </View>
        <View style={styles.suggestionBadge}><Text style={styles.suggestionText}>SUGGESTION</Text></View>
      </View>
      {loading ? (
        <View style={styles.priorityLoading}><ActivityIndicator size="small" color={colors.cyan} /><Text style={styles.mutedSmall}>Reviewing your upcoming tasks…</Text></View>
      ) : error ? (
        <View style={styles.priorityError}>
          <Text style={styles.mutedSmall}>{error}</Text>
          <TactilePressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></TactilePressable>
        </View>
      ) : recommendation ? (
        <>
          <Text style={styles.priorityTitle}>{recommendation.title}</Text>
          <Text style={styles.priorityReason}>{recommendation.reason}</Text>
          <View style={styles.nextStep}>
            <Text style={styles.nextStepLabel}>A GOOD NEXT STEP</Text>
            <Text style={styles.nextStepText}>{recommendation.nextStep}</Text>
          </View>
          {recommendation.taskId ? (
            <Link href="/command" asChild>
              <TactilePressable accessibilityRole="button" style={styles.priorityLink}>
                <Text style={styles.priorityLinkText}>Review in Command Center <Text>→</Text></Text>
              </TactilePressable>
            </Link>
          ) : null}
          <Text style={styles.priorityFootnote}>Based on your listed upcoming tasks. Nothing is changed automatically.</Text>
        </>
      ) : null}
    </HudPanel>
  );
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "lime" | "cyan" }) {
  const accent = tone === "lime" ? colors.lime : colors.cyan;
  return (
    <HudPanel style={[styles.metricCard, { borderTopColor: `${accent}88` }]}>
      <View style={styles.metricHeader}><View style={[styles.metricLight, { backgroundColor: accent, shadowColor: accent }]} /><Text style={styles.metricDetail}>{detail}</Text></View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={[styles.metricAccentLine, { backgroundColor: accent }]} />
    </HudPanel>
  );
}

function Telemetry({ label, value }: { label: string; value: string }) {
  return <View style={styles.telemetryItem}><Text style={styles.telemetryLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.telemetryValue}>{value}</Text></View>;
}

function WeeklyGoalCard({ minutes, goalHours }: { minutes: number; goalHours: number }) {
  const targetMinutes = goalHours * 60;
  const progress = Math.min(100, Math.round((minutes / targetMinutes) * 100));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return (
    <HudPanel style={styles.goalPanel}>
      <View style={styles.goalHeader}>
        <View><Text style={styles.eyebrow}>WEEKLY TARGET</Text><Text style={styles.sectionTitle}>Study goal</Text></View>
        <Text style={styles.goalProgress}>{progress}%</Text>
      </View>
      <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${progress}%` }]} /></View>
      <Text style={styles.goalCaption}>{hours}h {remainingMinutes}m of {goalHours}h this week</Text>
    </HudPanel>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: 112, gap: space.md },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, marginBottom: 2 },
  profileButton: { minHeight: 47, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.pill, borderWidth: 1, borderTopColor: "#52616A", borderLeftColor: "#273842", borderRightColor: "#1C2932", borderBottomColor: "#17232B", backgroundColor: colors.surface, paddingHorizontal: 7, paddingVertical: 5, shadowColor: colors.black, shadowOpacity: 0.8, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  profileInset: { width: 33, height: 33, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: `${colors.cyan}75`, backgroundColor: "#081016", shadowColor: colors.cyan, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2 },
  profileInitial: { color: colors.cyan, fontSize: 12, fontWeight: "900" },
  profileLabel: { color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 1.1 },
  profileName: { color: colors.foreground, fontSize: 10, fontWeight: "700", marginTop: 2 },
  greetingBlock: { marginTop: space.xs, marginBottom: space.xs },
  eyebrow: { color: colors.lime, fontSize: 8, fontWeight: "800", letterSpacing: 1.4 },
  eyebrowDivider: { color: colors.subtle },
  eyebrowAmber: { color: colors.amber, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  greeting: { color: colors.foreground, fontSize: 23, fontWeight: "800", marginTop: 7, letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 5 },
  corePanel: { padding: 0, overflow: "hidden", borderRadius: radius.hero, borderColor: "#344852", borderTopColor: "#61747C", backgroundColor: "#0B131A", shadowColor: colors.cyan, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  coreHeader: { minHeight: 184, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: space.lg, paddingRight: 8, paddingVertical: space.sm },
  coreCopy: { flex: 1, alignItems: "flex-start", gap: 5, paddingVertical: space.md },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: "#587348", backgroundColor: "#152117", paddingHorizontal: 8, paddingVertical: 5, marginBottom: 8 },
  onlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.9, shadowRadius: 5 },
  onlineText: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  coreEyebrow: { color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 1.2 },
  coreTitle: { maxWidth: 190, color: colors.foreground, fontSize: 20, lineHeight: 25, fontWeight: "800", letterSpacing: -0.4 },
  coreSub: { maxWidth: 180, color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  orbButton: { width: 144, height: 156, alignItems: "center", justifyContent: "center", marginLeft: -6, borderRadius: 999, borderWidth: 1, borderColor: `${colors.cyan}25`, backgroundColor: "#091117" },
  coreFooter: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: "#263740", backgroundColor: "#080F15", paddingHorizontal: 15 },
  coreFooterLine: { width: 3, height: 18, borderRadius: 3, backgroundColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.85, shadowRadius: 6 },
  coreFooterLabel: { color: colors.cyan, fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  coreFooterCopy: { flex: 1, color: colors.muted, fontSize: 8 },
  coreFooterArrow: { color: colors.lime, fontSize: 15, fontWeight: "800" },
  setupHint: { borderTopWidth: 1, borderTopColor: colors.line, padding: 12, gap: 5 },
  inlineLink: { color: colors.cyan, fontSize: 10, fontWeight: "700" },
  progressPanel: { padding: 15, gap: 13, borderColor: "#2B4147", borderTopColor: "#52635A", backgroundColor: "#0D171A", shadowColor: colors.lime, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  priorityPanel: { gap: 10, borderColor: `${colors.cyan}40`, borderTopColor: `${colors.cyan}80`, backgroundColor: "#0E171D" },
  priorityHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  priorityIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderTopColor: `${colors.cyan}90`, borderLeftColor: `${colors.cyan}50`, borderRightColor: `${colors.cyan}30`, borderBottomColor: `${colors.cyan}25`, backgroundColor: `${colors.cyan}10`, shadowColor: colors.cyan, shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  priorityIconText: { color: colors.cyan, fontSize: 17, fontWeight: "900", textShadowColor: colors.cyan, textShadowRadius: 7 },
  priorityHeading: { flex: 1, gap: 1 },
  suggestionBadge: { borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.cyan}40`, backgroundColor: "#0A1419", paddingHorizontal: 7, paddingVertical: 4 },
  suggestionText: { color: colors.cyan, fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  priorityLoading: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 9 },
  priorityError: { alignItems: "flex-start", gap: 8 },
  priorityTitle: { color: colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 2 },
  priorityReason: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  nextStep: { gap: 4, borderLeftWidth: 2, borderLeftColor: colors.cyan, backgroundColor: "#091116", paddingHorizontal: 10, paddingVertical: 8 },
  nextStepLabel: { color: colors.cyan, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  nextStepText: { color: colors.foreground, fontSize: 10, lineHeight: 15 },
  priorityLink: { alignSelf: "flex-start", borderRadius: radius.control, backgroundColor: "#122026", paddingHorizontal: 11, paddingVertical: 8, borderColor: `${colors.cyan}35` },
  priorityLinkText: { color: colors.cyan, fontSize: 9, fontWeight: "800" },
  priorityFootnote: { color: colors.subtle, fontSize: 8, lineHeight: 12 },
  retryButton: { borderRadius: radius.control, backgroundColor: colors.surface, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 7 },
  retryText: { color: colors.cyan, fontSize: 9, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { color: colors.foreground, fontSize: 15, fontWeight: "800", marginTop: 4, letterSpacing: -0.2 },
  percentBadge: { width: 49, height: 49, alignItems: "center", justifyContent: "center", borderRadius: 25, borderWidth: 1, borderTopColor: `${colors.lime}B0`, borderLeftColor: `${colors.lime}66`, borderRightColor: `${colors.lime}35`, borderBottomColor: `${colors.lime}22`, backgroundColor: "#121C17", shadowColor: colors.lime, shadowOpacity: 0.18, shadowRadius: 7, elevation: 3 },
  percentValue: { color: colors.lime, fontSize: 12, fontWeight: "900" },
  percentCaption: { color: colors.subtle, fontSize: 5, fontWeight: "800", letterSpacing: 0.7, marginTop: 1 },
  progressTrackOuter: { height: 17, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: "#263832", backgroundColor: "#070D0C", paddingHorizontal: 3, shadowColor: colors.black, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  progressTrackInset: { height: 8, overflow: "hidden", borderRadius: 5, backgroundColor: "#19231E" },
  progressFill: { height: "100%", borderRadius: 5, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  progressLegend: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime },
  legendDotRemaining: { backgroundColor: "#50615B" },
  legendLabel: { color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 0.7 },
  legendValue: { color: colors.foreground, fontSize: 9, fontWeight: "800", marginLeft: 2 },
  statsGrid: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, minHeight: 111, justifyContent: "space-between", padding: 13, borderColor: "#2C3940", borderTopWidth: 2, backgroundColor: "#0E161D", shadowColor: colors.black, shadowOpacity: 0.7, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  metricHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricLight: { width: 5, height: 5, borderRadius: 3, shadowOpacity: 0.8, shadowRadius: 5 },
  metricDetail: { color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  metricValue: { color: colors.foreground, fontSize: 29, fontWeight: "800", letterSpacing: -0.8, marginTop: 11 },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: "600", marginTop: -1 },
  metricAccentLine: { width: 24, height: 2, borderRadius: 2, opacity: 0.85, marginTop: 8 },
  panel: { gap: 13, borderColor: "#2B3942", borderTopColor: "#465963", backgroundColor: colors.surface, shadowColor: colors.black, shadowOpacity: 0.65, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  telemetryMark: { height: 25, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: "#080E13" },
  telemetryLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.8, shadowRadius: 4 },
  telemetryLiveText: { color: colors.subtle, fontSize: 6, fontWeight: "900", letterSpacing: 0.8 },
  telemetryGrid: { minHeight: 61, flexDirection: "row", alignItems: "stretch", gap: 0, borderWidth: 1, borderColor: "#22313A", borderRadius: 12, backgroundColor: "#080F14", paddingVertical: 10, shadowColor: colors.black, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  telemetryItem: { flex: 1, justifyContent: "space-between", minWidth: 0, gap: 8, paddingHorizontal: 9 },
  telemetryLabel: { color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  telemetryValue: { color: colors.foreground, fontSize: 13, fontWeight: "800" },
  goalPanel: { gap: 10, borderColor: "#2D4146", borderTopColor: `${colors.lime}88`, backgroundColor: "#0D1719" },
  goalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalProgress: { color: colors.lime, fontSize: 17, fontWeight: "900" },
  goalTrack: { height: 8, overflow: "hidden", borderRadius: 5, backgroundColor: "#1B2A2B" },
  goalFill: { height: "100%", borderRadius: 5, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.8, shadowRadius: 6 },
  goalCaption: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  courseCount: { color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  courseChart: { gap: 10, paddingVertical: 3 },
  courseChartRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  courseCode: { width: 65, color: colors.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  courseTrack: { flex: 1, height: 9, justifyContent: "center", borderRadius: 5, borderWidth: 1, borderColor: "#202F38", backgroundColor: "#080E13", padding: 1 },
  courseFill: { height: 5, borderRadius: 4, backgroundColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.65, shadowRadius: 5 },
  courseUnits: { width: 35, color: colors.foreground, fontSize: 9, fontWeight: "800", textAlign: "right" },
  courseUnitLabel: { color: colors.subtle, fontSize: 6, fontWeight: "800" },
  chartCaption: { color: colors.subtle, fontSize: 8, marginTop: -3 },
  countBadge: { color: colors.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 0.8, borderWidth: 1, borderColor: `${colors.cyan}45`, borderRadius: radius.pill, backgroundColor: "#0A171D", paddingHorizontal: 9, paddingVertical: 6 },
  taskRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9 },
  taskPressed: { opacity: 0.65 },
  taskMarker: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber, shadowColor: colors.amber, shadowOpacity: 0.65, shadowRadius: 5 },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.foreground, fontSize: 11, fontWeight: "700" },
  chevron: { color: colors.cyan, fontSize: 21, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  mutedSmall: { color: colors.muted, fontSize: 9, marginTop: 4 },
  statePanel: { alignItems: "center", paddingVertical: 28, gap: 10 },
  errorPanel: { gap: 11, borderColor: `${colors.amber}55` },
  actionButton: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.control, backgroundColor: colors.lime },
  actionText: { color: colors.black, fontSize: 11, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  footer: { textAlign: "center", color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 1.2, paddingTop: space.xs, paddingBottom: space.sm },
});
