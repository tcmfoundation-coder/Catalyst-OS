import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { HudPanel } from "@/components/ui/HudPanel";
import { useAppSettings } from "@/lib/settings-context";
import { colors, space } from "@/theme/tokens";
import type { DashboardResponse } from "@/lib/api";

type PerformanceTrend = DashboardResponse["performance"];
const GRAPH_WIDTH = 360;
const GRAPH_HEIGHT = 150;
const GRAPH_BOTTOM = 120;
const GRAPH_TOP = 22;
const GRAPH_LEFT = 12;
const GRAPH_RIGHT = 348;

function formatChange(current: number, previous: number) {
  if (current === 0 && previous === 0) return "No activity yet";
  if (previous === 0) return "New this week";
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent > 0 ? "+" : ""}${percent}% vs last week`;
}

function makeCurve(values: number[], maximum: number) {
  if (values.length === 0) return `M${GRAPH_LEFT} ${GRAPH_BOTTOM} L${GRAPH_RIGHT} ${GRAPH_BOTTOM}`;
  const step = (GRAPH_RIGHT - GRAPH_LEFT) / Math.max(1, values.length - 1);
  const points = values.map((value, index) => ({
    x: GRAPH_LEFT + index * step,
    y: GRAPH_BOTTOM - (Math.max(0, value) / maximum) * (GRAPH_BOTTOM - GRAPH_TOP),
  }));
  let path = `M${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpoint = (previous.x + current.x) / 2;
    path += ` C${midpoint} ${previous.y}, ${midpoint} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function makeArea(curve: string) {
  return `${curve} L${GRAPH_RIGHT} ${GRAPH_HEIGHT} L${GRAPH_LEFT} ${GRAPH_HEIGHT} Z`;
}

export function PerformanceTrendCard({ trend }: { trend: PerformanceTrend }) {
  const { settings } = useAppSettings();
  const systemReduceMotion = useReducedMotion();
  const float = useSharedValue(0);
  const drift = useSharedValue(0);
  const reduceMotion = systemReduceMotion || settings.reduceMotion;
  const maxMinutes = Math.max(60, ...trend.days.map((day) => day.studyMinutes));
  const maxTasks = Math.max(1, ...trend.days.map((day) => day.completedTasks));
  const studyCurve = makeCurve(trend.days.map((day) => day.studyMinutes), maxMinutes);
  const taskCurve = makeCurve(trend.days.map((day) => day.completedTasks), maxTasks);
  const accessibilitySummary = trend.days.map((day) => {
    const weekday = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
    return `${weekday}: ${day.studyMinutes} study minutes, ${day.completedTasks} tasks completed`;
  }).join(". ");

  useEffect(() => {
    float.value = reduceMotion ? 0 : withRepeat(
      withSequence(
        withTiming(-3, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [float, reduceMotion]);

  useEffect(() => {
    drift.value = reduceMotion ? 0 : withRepeat(
      withTiming(-16, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift, reduceMotion]);

  const waveStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));
  const driftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value }] }));

  return (
    <HudPanel style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PERFORMANCE METRICS</Text>
          <Text style={styles.title}>Weekly flow</Text>
        </View>
        <Text style={styles.period}>UTC · 7 DAYS</Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{trend.current.studyMinutes}<Text style={styles.metricUnit}>m</Text></Text>
          <Text style={styles.metricLabel}>STUDY TIME</Text>
          <Text style={styles.change}>{formatChange(trend.current.studyMinutes, trend.previous.studyMinutes)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={[styles.metricValue, styles.cyan]}>{trend.current.completedTasks}</Text>
          <Text style={styles.metricLabel}>TASKS DONE</Text>
          <Text style={styles.change}>{formatChange(trend.current.completedTasks, trend.previous.completedTasks)}</Text>
        </View>
      </View>

      <View accessibilityRole="image" accessibilityLabel={accessibilitySummary} style={styles.chart}>
        <Animated.View pointerEvents="none" style={[styles.waterFlow, driftStyle]}>
          <Svg width="120%" height="100%" viewBox={`0 0 ${GRAPH_WIDTH} 80`} preserveAspectRatio="none">
            <Path d="M0 35 C45 12 75 52 120 34 C165 15 195 53 240 34 C285 14 315 54 360 34 L360 80 L0 80 Z" fill="#73DCEB18" />
            <Path d="M0 52 C42 35 76 66 120 51 C165 34 195 67 240 50 C285 34 318 67 360 52 L360 80 L0 80 Z" fill="#B8F66A10" />
            <Path d="M0 35 C45 12 75 52 120 34 C165 15 195 53 240 34 C285 14 315 54 360 34" fill="none" stroke={colors.cyan} strokeOpacity="0.14" strokeWidth="1" />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, waveStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="studyWave" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.lime} stopOpacity="0.48" />
                <Stop offset="1" stopColor={colors.lime} stopOpacity="0.025" />
              </LinearGradient>
              <LinearGradient id="taskWave" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.cyan} stopOpacity="0.42" />
                <Stop offset="1" stopColor={colors.cyan} stopOpacity="0.025" />
              </LinearGradient>
            </Defs>
            <Path d={makeArea(studyCurve)} fill="url(#studyWave)" />
            <Path d={makeArea(taskCurve)} fill="url(#taskWave)" />
            <Path d={studyCurve} fill="none" stroke={colors.lime} strokeOpacity="0.92" strokeWidth="2.2" />
            <Path d={taskCurve} fill="none" stroke={colors.cyan} strokeOpacity="0.88" strokeWidth="1.8" />
            <Path d={`M${GRAPH_LEFT} ${GRAPH_BOTTOM} H${GRAPH_RIGHT}`} fill="none" stroke="#71838A" strokeOpacity="0.42" strokeWidth="1" />
          </Svg>
        </Animated.View>
        <View pointerEvents="none" style={styles.dayLabels}>
          {trend.days.map((day) => {
            const label = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }).slice(0, 2);
            return <Text key={day.date} style={styles.dayLabel}>{label}</Text>;
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.lime }]} /><Text style={styles.legendLabel}>STUDY MINUTES</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.cyan }]} /><Text style={styles.legendLabel}>TASKS COMPLETED</Text></View>
      </View>
    </HudPanel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.md, borderColor: "#31444A", borderTopColor: "#586B69", backgroundColor: "#0D1719" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  eyebrow: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.foreground, fontSize: 15, fontWeight: "800", marginTop: 4 },
  period: { color: colors.subtle, fontSize: 7, fontWeight: "800", letterSpacing: 0.7 },
  metrics: { flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderColor: "#25373A", borderRadius: 12, backgroundColor: "#080F12", paddingVertical: 10 },
  metric: { flex: 1, gap: 3, paddingHorizontal: 11 },
  metricValue: { color: colors.lime, fontSize: 21, fontWeight: "900" },
  metricUnit: { fontSize: 11 },
  cyan: { color: colors.cyan },
  metricLabel: { color: colors.subtle, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  change: { color: colors.muted, fontSize: 8, marginTop: 2 },
  metricDivider: { width: 1, marginVertical: 3, backgroundColor: colors.line },
  chart: { height: 142, overflow: "hidden", borderRadius: 12, borderWidth: 1, borderColor: "#23373C", backgroundColor: "#081216" },
  waterFlow: { position: "absolute", left: -10, right: -10, bottom: 12, height: 80 },
  dayLabels: { position: "absolute", left: 12, right: 12, bottom: 5, flexDirection: "row", justifyContent: "space-between" },
  dayLabel: { color: colors.subtle, fontSize: 7, fontWeight: "800" },
  legend: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 5, height: 5, borderRadius: 3 },
  legendLabel: { color: colors.subtle, fontSize: 6, fontWeight: "800", letterSpacing: 0.6 },
});
