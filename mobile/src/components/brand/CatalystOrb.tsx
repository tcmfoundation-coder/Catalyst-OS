import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { assistantStateColors, type CatalystAssistantState, colors } from "@/theme/tokens";
import { useAppSettings } from "@/lib/settings-context";

interface CatalystOrbProps {
  state?: CatalystAssistantState;
  size?: number;
  audioLevel?: number;
  motionEnabled?: boolean;
}

export function CatalystOrb({ state = "idle", size = 228, audioLevel = 0, motionEnabled = true }: CatalystOrbProps) {
  const { settings } = useAppSettings();
  const systemReduceMotion = useReducedMotion();
  const shouldAnimate = motionEnabled && !settings.reduceMotion && !systemReduceMotion;
  const orbitA = useSharedValue(0);
  const orbitB = useSharedValue(0);
  const breath = useSharedValue(1);
  const color = assistantStateColors[state];
  const coreSize = size * 0.48;

  useEffect(() => {
    cancelAnimation(orbitA);
    cancelAnimation(orbitB);
    cancelAnimation(breath);
    orbitA.value = 0;
    orbitB.value = 0;
    breath.value = 1;
    if (!shouldAnimate) return;

    const orbitDuration = state === "thinking" ? 2800 : state === "listening" ? 6800 : 24000;
    orbitA.value = withRepeat(withTiming(1, { duration: orbitDuration, easing: Easing.linear }), -1, false);
    orbitB.value = withRepeat(withTiming(1, { duration: orbitDuration * 1.31, easing: Easing.linear }), -1, false);

    if (state === "activated") {
      breath.value = withSequence(
        withTiming(1.09, { duration: 220, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
      );
    } else if (state === "success") {
      breath.value = withSequence(
        withTiming(1.12, { duration: 190, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 440, easing: Easing.out(Easing.quad) }),
      );
    } else if (state === "idle" || state === "listening" || state === "alert" || state === "speaking") {
      const amplitude = state === "idle" ? 0.025 : state === "alert" ? 0.045 : 0.035;
      const duration = state === "idle" ? 2800 : state === "alert" ? 850 : state === "listening" ? 1500 : 1100;
      breath.value = withRepeat(
        withSequence(
          withTiming(1 + amplitude, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }

    return () => {
      cancelAnimation(orbitA);
      cancelAnimation(orbitB);
      cancelAnimation(breath);
    };
  }, [breath, orbitA, orbitB, shouldAnimate, state]);

  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Catalyst Core, ${state}`}
      style={[styles.orb, { width: size, height: size }]}
    >
      <View style={[styles.aura, { width: size * 0.66, height: size * 0.66, backgroundColor: color }]} />
      <OrbitRing diameter={size * 0.94} color={`${colors.cyan}40`} rotate={orbitA} tilt={0.34} />
      <OrbitRing diameter={size * 0.78} color={`${color}88`} rotate={orbitB} tilt={0.55} />
      <ParticleSystem size={size} color={color} rotate={orbitA} />
      <Animated.View style={[styles.coreWrap, { width: coreSize, height: coreSize }, coreStyle]}>
        <CatalystCore size={coreSize} color={color} />
        <SparkCore color={color} />
      </Animated.View>
      {(state === "listening" || state === "speaking") && audioLevel > 0 ? (
        <VoiceWaveform level={audioLevel} color={color} size={size} />
      ) : null}
    </View>
  );
}

export function CatalystCore({ size, color = colors.lime }: { size: number; color?: string }) {
  return (
    <View style={[styles.core, { width: size, height: size, borderColor: `${color}A0` }]}>
      <View style={[styles.coreInner, { backgroundColor: `${color}12`, shadowColor: color }]} />
      <View style={[styles.cGap, { backgroundColor: colors.background }]} />
    </View>
  );
}

export function OrbitRing({
  diameter,
  color,
  rotate,
  tilt,
}: {
  diameter: number;
  color: string;
  rotate: SharedValue<number>;
  tilt: number;
}) {
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value * 360}deg` }, { scaleY: tilt }] }));
  return <Animated.View pointerEvents="none" style={[styles.orbit, { width: diameter, height: diameter, borderColor: color }, spinStyle]} />;
}

export function SparkCore({ color = colors.lime }: { color?: string }) {
  return (
    <View pointerEvents="none" style={styles.sparkWrap}>
      <View style={[styles.sparkGlow, { backgroundColor: color, shadowColor: color }]} />
      <View style={[styles.sparkDiamond, { backgroundColor: color, shadowColor: color }]} />
      <View style={[styles.sparkTip, { backgroundColor: colors.foreground }]} />
    </View>
  );
}

export function ParticleSystem({ size, color, rotate }: { size: number; color: string; rotate: SharedValue<number> }) {
  const particleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rotate.value * 360}deg` }] }));
  const points = [
    { left: 0.18, top: 0.27, scale: 1 },
    { left: 0.8, top: 0.3, scale: 0.72 },
    { left: 0.77, top: 0.72, scale: 0.9 },
    { left: 0.22, top: 0.77, scale: 0.64 },
    { left: 0.49, top: 0.09, scale: 0.58 },
  ];
  return (
    <Animated.View pointerEvents="none" style={[styles.particleLayer, { width: size, height: size }, particleStyle]}>
      {points.map((point, index) => (
        <View
          key={index}
          style={[
            styles.particle,
            { left: size * point.left, top: size * point.top, backgroundColor: color, transform: [{ scale: point.scale }] },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export function VoiceWaveform({ level, color, size }: { level: number; color: string; size: number }) {
  const safeLevel = Math.max(0, Math.min(1, level));
  const heights = [0.24, 0.52, 0.8, 0.4, 0.68, 0.92, 0.52, 0.3, 0.62];
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.waveform, { width: size * 0.38 }]}>
      {heights.map((weight, index) => (
        <View key={index} style={[styles.waveBar, { height: 3 + safeLevel * weight * 18, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { alignItems: "center", justifyContent: "center", alignSelf: "center" },
  aura: { position: "absolute", borderRadius: 999, opacity: 0.075, transform: [{ scale: 1.1 }] },
  orbit: { position: "absolute", borderWidth: 1, borderRadius: 999 },
  coreWrap: { alignItems: "center", justifyContent: "center" },
  core: { alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 2, shadowColor: colors.lime, shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 8, transform: [{ rotate: "-38deg" }] },
  coreInner: { width: "68%", height: "68%", borderRadius: 999, shadowOpacity: 0.42, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  cGap: { position: "absolute", right: -4, top: "30%", width: 11, height: "40%", borderRadius: 6 },
  sparkWrap: { position: "absolute", alignItems: "center", justifyContent: "center", width: 26, height: 26 },
  sparkGlow: { position: "absolute", width: 14, height: 14, borderRadius: 10, opacity: 0.5, shadowOpacity: 0.95, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  sparkDiamond: { width: 10, height: 10, borderRadius: 2, transform: [{ rotate: "45deg" }], shadowOpacity: 0.85, shadowRadius: 9, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  sparkTip: { position: "absolute", width: 3, height: 3, borderRadius: 2, top: 5, right: 5 },
  particleLayer: { position: "absolute" },
  particle: { position: "absolute", width: 4, height: 4, borderRadius: 4, opacity: 0.8, shadowColor: colors.lime, shadowOpacity: 0.75, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  waveform: { position: "absolute", bottom: -2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, height: 24 },
  waveBar: { width: 2, minHeight: 3, borderRadius: 2, opacity: 0.8 },
});
