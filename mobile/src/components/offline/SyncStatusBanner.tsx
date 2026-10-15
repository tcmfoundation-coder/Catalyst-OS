import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useOfflineSync } from "@/lib/offline-sync-context";
import { colors } from "@/theme/tokens";

export function SyncStatusBanner() {
  const { online, pending, failed, failureMessage, retry, syncNow } = useOfflineSync();
  if (online && pending === 0 && failed === 0) return null;

  const title = failed > 0
    ? `${failed} change${failed === 1 ? "" : "s"} need attention`
    : pending > 0
      ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync`
      : "Offline · showing saved data";
  const detail = failed > 0
    ? failureMessage ?? "This change was rejected. Retry or discard it to continue syncing."
    : online
      ? "Syncing with Catalysts Core when connected."
      : "Your cached workspace and queued changes stay on this device.";

  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, failed > 0 && styles.failed]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      {!online && pending > 0 ? <ActivityIndicator color={colors.cyan} size="small" /> : null}
      {online && pending > 0 && failed === 0 ? (
        <Pressable accessibilityRole="button" onPress={() => void syncNow()}><Text style={styles.action}>SYNC</Text></Pressable>
      ) : null}
      {failed > 0 && online ? (
        <Pressable accessibilityRole="button" onPress={() => void retry()}><Text style={styles.action}>RETRY</Text></Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${colors.cyan}44`, backgroundColor: "#0B1820" },
  failed: { borderBottomColor: `${colors.danger}66`, backgroundColor: "#211217" },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.foreground, fontSize: 10, fontWeight: "800" },
  detail: { color: colors.muted, fontSize: 9 },
  action: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
});
