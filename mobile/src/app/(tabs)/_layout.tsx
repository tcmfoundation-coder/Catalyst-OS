import { Tabs } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { useAppSettings } from "@/lib/settings-context";
import { colors, radius } from "@/theme/tokens";

const tabs = [
  { name: "index", title: "Home", glyph: "home" },
  { name: "command", title: "Command", glyph: "command" },
  { name: "assistant", title: "Catalyst AI", glyph: "core" },
  { name: "create", title: "Create", glyph: "create" },
  { name: "profile", title: "Profile", glyph: "profile" },
] as const;

export default function MainTabs() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: styles.dock,
        tabBarBackground: () => <DockSurface />,
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
      {tabs.map(({ name, title, glyph }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: name === "assistant" ? "Catalyst AI assistant" : title,
            tabBarIcon: ({ color, focused }) => glyph === "core"
              ? <View style={styles.coreSlot}><View style={styles.coreHalo}><CatalystOrb state="idle" size={54} /></View></View>
              : <NavGlyph glyph={glyph} color={String(color)} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

function DockSurface() {
  return (
    <View pointerEvents="none" style={styles.surfaceWrap}>
      <View style={styles.surface}>
        <View style={styles.topTrace} />
        <View style={styles.leftNode} />
        <View style={styles.rightNode} />
      </View>
    </View>
  );
}

function NavGlyph({ glyph, color, focused }: { glyph: string; color: string; focused: boolean }) {
  const { settings } = useAppSettings();
  const focus = useSharedValue(focused ? 1 : 0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -focus.value * 2 },
      { scale: 0.94 + focus.value * 0.06 },
    ],
  }));

  useEffect(() => {
    focus.value = settings.reduceMotion ? Number(focused) : withSpring(focused ? 1 : 0, { damping: 15, stiffness: 220 });
  }, [focus, focused, settings.reduceMotion]);

  return (
    <Animated.View style={[styles.glyphBox, animatedStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {focused ? <View style={[styles.activeAura, { backgroundColor: `${color}18` }]} /> : null}
      <View style={[styles.glyphPlate, focused && styles.glyphPlateActive]} />
      {glyph === "home" ? <>
        <View style={[styles.homeRoof, { borderColor: color }]} />
        <View style={[styles.homeBody, { borderColor: color }]}><View style={[styles.homeDoor, { backgroundColor: color }]} /></View>
      </> : null}
      {glyph === "command" ? <View style={styles.commandGlyph}>{[0, 1, 2].map((line) => <View key={line} style={styles.commandRow}><View style={[styles.commandDot, { backgroundColor: color }]} /><View style={[styles.commandLine, { backgroundColor: color, width: line === 1 ? 13 : 17 }]} /></View>)}</View> : null}
      {glyph === "create" ? <View style={[styles.createRing, { borderColor: color }]}><View style={[styles.createHorizontal, { backgroundColor: color }]} /><View style={[styles.createVertical, { backgroundColor: color }]} /></View> : null}
      {glyph === "profile" ? <View style={styles.profileGlyph}><View style={[styles.profileHead, { borderColor: color }]} /><View style={[styles.profileShoulders, { borderColor: color }]} /></View> : null}
      {focused ? <View style={[styles.activePoint, { backgroundColor: color }]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 9,
    height: 76,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 5,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
  },
  surfaceWrap: { ...StyleSheet.absoluteFill, top: 0, overflow: "visible" },
  surface: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: "#31434F",
    backgroundColor: "#0A1119",
    shadowColor: colors.cyan,
    shadowOpacity: 0.17,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 18,
  },
  topTrace: { position: "absolute", top: -1, left: "28%", width: "44%", height: 1, borderRadius: 1, backgroundColor: `${colors.cyan}70` },
  leftNode: { position: "absolute", left: 14, top: 11, width: 3, height: 3, borderRadius: 2, backgroundColor: `${colors.cyan}B0` },
  rightNode: { position: "absolute", right: 14, top: 11, width: 3, height: 3, borderRadius: 2, backgroundColor: `${colors.cyan}B0` },
  item: { minWidth: 0, paddingHorizontal: 0, overflow: "visible" },
  label: { fontSize: 8, lineHeight: 11, fontWeight: "700", letterSpacing: 0.45, marginTop: 2 },
  glyphBox: { width: 38, height: 36, alignItems: "center", justifyContent: "center" },
  activeAura: { position: "absolute", width: 36, height: 28, borderRadius: 18 },
  glyphPlate: { position: "absolute", width: 34, height: 30, borderRadius: 10, borderWidth: 1, borderTopColor: "#465660", borderLeftColor: "#2D3B44", borderRightColor: "#18242C", borderBottomColor: "#111A20", backgroundColor: "#101820", shadowColor: colors.black, shadowOpacity: 0.45, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  glyphPlateActive: { borderTopColor: `${colors.lime}A0`, borderLeftColor: `${colors.lime}58`, backgroundColor: "#17231A", elevation: 5 },
  activePoint: { position: "absolute", bottom: 0, width: 3, height: 3, borderRadius: 2, shadowColor: colors.lime, shadowOpacity: 0.8, shadowRadius: 5 },
  homeRoof: { position: "absolute", top: 7, width: 13, height: 13, borderLeftWidth: 1.6, borderTopWidth: 1.6, borderTopLeftRadius: 2, transform: [{ rotate: "45deg" }] },
  homeBody: { position: "absolute", bottom: 7, width: 19, height: 14, borderWidth: 1.6, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, alignItems: "center", justifyContent: "flex-end" },
  homeDoor: { width: 4, height: 7, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.9 },
  commandGlyph: { gap: 4 },
  commandRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  commandDot: { width: 3, height: 3, borderRadius: 2, opacity: 0.9 },
  commandLine: { height: 1.5, borderRadius: 1, opacity: 0.9 },
  createRing: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  createHorizontal: { position: "absolute", width: 9, height: 1.5, borderRadius: 1 },
  createVertical: { position: "absolute", width: 1.5, height: 9, borderRadius: 1 },
  profileGlyph: { width: 21, height: 22, alignItems: "center", justifyContent: "space-between" },
  profileHead: { width: 8, height: 8, borderWidth: 1.5, borderRadius: 5 },
  profileShoulders: { width: 19, height: 10, borderWidth: 1.5, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomWidth: 0 },
  coreSlot: { width: 62, height: 47, alignItems: "center", justifyContent: "center", marginTop: -20 },
  coreHalo: {
    width: 62,
    height: 62,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1119",
    borderWidth: 1,
    borderColor: `${colors.cyan}65`,
    shadowColor: colors.lime,
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
});
