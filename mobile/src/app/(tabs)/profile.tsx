import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactileIconTile, TactilePressable } from "@/components/ui/TactilePressable";
import { useAuth } from "@/lib/auth-context";
import { useOfflineSync } from "@/lib/offline-sync-context";
import { colors, radius, space } from "@/theme/tokens";

export default function ProfileHubScreen() {
  const { state } = useAuth();
  const { online } = useOfflineSync();

  if (state.status !== "authenticated") return null;

  const initials = state.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PERSONAL SYSTEM <Text style={styles.dim}>/ ACCOUNT</Text></Text>
        <Text style={styles.title}>Your space</Text>
        <Text style={styles.subtitle}>Manage your identity and how Catalysts works for you.</Text>

        <HudPanel style={styles.identity}>
          <TactileIconTile color={colors.lime} size={54}>
            <Text style={styles.initials}>{initials || "C"}</Text>
          </TactileIconTile>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{state.user.name}</Text>
            <Text style={styles.email}>{state.user.email}</Text>
            <View style={styles.connection}>
              <View style={[styles.connectionDot, !online && styles.offlineDot]} />
              <Text style={[styles.connectionText, !online && styles.offlineText]}>
                {online ? "CONNECTED" : "OFFLINE · SESSION SAVED"}
              </Text>
            </View>
          </View>
          <View style={styles.orb}><CatalystOrb state="idle" size={43} /></View>
        </HudPanel>

        <Text style={styles.sectionEyebrow}>ACCOUNT & PREFERENCES</Text>
        <Link href="./account" asChild>
          <TactilePressable accessibilityRole="button" style={styles.destination}>
            <View style={[styles.destinationIcon, styles.profileIcon]}>
              <View style={styles.profileHead} />
              <View style={styles.profileShoulders} />
            </View>
            <View style={styles.destinationCopy}>
              <Text style={styles.destinationTitle}>Profile</Text>
              <Text style={styles.destinationDescription}>Account details, security, and sign out</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TactilePressable>
        </Link>
        <Link href="./settings" asChild>
          <TactilePressable accessibilityRole="button" style={styles.destination}>
            <View style={[styles.destinationIcon, styles.settingsIcon]}>
              <Text style={styles.gear}>⚙</Text>
            </View>
            <View style={styles.destinationCopy}>
              <Text style={styles.destinationTitle}>Settings</Text>
              <Text style={styles.destinationDescription}>Notifications, study goals, and motion</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TactilePressable>
        </Link>

        <Text style={styles.footer}>CATALYST CORE <Text style={styles.footerDim}>· PERSONAL ACADEMIC OS</Text></Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: space.xl, paddingTop: space.lg, paddingBottom: 120, gap: space.md },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.35 },
  dim: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 27, fontWeight: "800", letterSpacing: -0.6, marginTop: -7 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: -space.sm },
  identity: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginTop: space.xs },
  initials: { color: colors.lime, fontSize: 18, fontWeight: "800" },
  identityCopy: { flex: 1, gap: 4 },
  name: { color: colors.foreground, fontSize: 15, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 10 },
  connection: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  connectionDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.lime },
  connectionText: { color: colors.lime, fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },
  offlineDot: { backgroundColor: colors.amber },
  offlineText: { color: colors.amber },
  orb: { width: 44, height: 44, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  sectionEyebrow: { color: colors.cyan, fontSize: 8, fontWeight: "800", letterSpacing: 1.3, marginTop: space.sm },
  destination: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderRadius: radius.hero, borderWidth: 1, borderTopColor: "#52616A", borderLeftColor: "#273842", borderRightColor: "#1C2932", borderBottomColor: "#17232B", backgroundColor: colors.surface },
  destinationIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.control, borderWidth: 1, backgroundColor: "#0B151C" },
  profileIcon: { borderColor: `${colors.lime}55`, gap: 3 },
  profileHead: { width: 9, height: 9, borderWidth: 1.5, borderColor: colors.lime, borderRadius: 6 },
  profileShoulders: { width: 20, height: 9, borderWidth: 1.5, borderColor: colors.lime, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomWidth: 0 },
  settingsIcon: { borderColor: `${colors.cyan}55` },
  gear: { color: colors.cyan, fontSize: 21 },
  destinationCopy: { flex: 1, gap: 4 },
  destinationTitle: { color: colors.foreground, fontSize: 13, fontWeight: "800" },
  destinationDescription: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  chevron: { color: colors.cyan, fontSize: 26, fontWeight: "300" },
  footer: { color: colors.cyan, fontSize: 8, fontWeight: "800", letterSpacing: 1.1, textAlign: "center", marginTop: space.lg },
  footerDim: { color: colors.subtle, fontWeight: "600" },
});
