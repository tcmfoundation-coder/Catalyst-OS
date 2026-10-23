import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { HudPanel } from "@/components/ui/HudPanel";
import { TactileIconTile, TactilePressable } from "@/components/ui/TactilePressable";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/lib/auth-context";
import { useOfflineSync } from "@/lib/offline-sync-context";
import { colors, radius, space } from "@/theme/tokens";

export default function ProfileScreen() {
  const { state, signOut } = useAuth();
  const { online } = useOfflineSync();
  const { showToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  if (state.status !== "authenticated") return null;

  const initials = state.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>YOUR ACCOUNT <Text style={styles.dim}>/ IDENTITY</Text></Text>
        <Text style={styles.title}>Account profile</Text>
        <Text style={styles.subtitle}>Your Catalysts identity and account access.</Text>

        <HudPanel style={styles.identity}>
          <TactileIconTile color={colors.lime} size={58}>
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
          <View style={styles.orb}><CatalystOrb state="idle" size={48} /></View>
        </HudPanel>

        <Text style={styles.sectionEyebrow}>ACCOUNT DETAILS</Text>
        <HudPanel style={styles.details}>
          <DetailRow label="Name" value={state.user.name} />
          <View style={styles.separator} />
          <DetailRow label="Email" value={state.user.email} />
          <View style={styles.separator} />
          <DetailRow label="Session" value="Active on this device" last />
          <Text style={styles.privacyNote}>Your session token is protected in secure device storage.</Text>
        </HudPanel>

        <TactilePressable
          accessibilityRole="button"
          disabled={signingOut}
          onPress={() => void handleSignOut()}
          style={[styles.signOut, signingOut && styles.disabled]}
        >
          {signingOut
            ? <ActivityIndicator color={colors.danger} />
            : <Text style={styles.signOutText}>Sign out of Catalysts <Text style={styles.arrow}>→</Text></Text>}
        </TactilePressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.lastRow]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: space.xl, paddingTop: space.lg, paddingBottom: 120, gap: space.md },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.35 },
  dim: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 27, fontWeight: "800", letterSpacing: -0.6, marginTop: -7 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: -space.sm },
  identity: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15, marginTop: space.xs },
  initials: { color: colors.lime, fontSize: 20, fontWeight: "800" },
  identityCopy: { flex: 1, gap: 4 },
  name: { color: colors.foreground, fontSize: 16, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 10 },
  connection: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  connectionDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.lime },
  connectionText: { color: colors.lime, fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },
  offlineDot: { backgroundColor: colors.amber },
  offlineText: { color: colors.amber },
  orb: { width: 48, height: 48, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  sectionEyebrow: { color: colors.cyan, fontSize: 8, fontWeight: "800", letterSpacing: 1.3, marginTop: space.xs },
  details: { paddingHorizontal: 15, paddingTop: 4, paddingBottom: 13 },
  detailRow: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  lastRow: { borderBottomWidth: 0 },
  detailLabel: { color: colors.muted, fontSize: 10 },
  detailValue: { maxWidth: "65%", color: colors.foreground, fontSize: 10, fontWeight: "700" },
  separator: { height: 1, backgroundColor: colors.line },
  privacyNote: { color: colors.subtle, fontSize: 9, lineHeight: 14, marginTop: 8 },
  signOut: { minHeight: 48, flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: radius.control, borderWidth: 1, borderColor: `${colors.danger}70`, backgroundColor: "#211417", marginTop: space.sm },
  signOutText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  arrow: { fontSize: 15 },
  disabled: { opacity: 0.5 },
});
