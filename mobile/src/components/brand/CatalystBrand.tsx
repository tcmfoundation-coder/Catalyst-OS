import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/tokens";

export function CatalystBrand({ compact = false }: { compact?: boolean }) {
  const markSize = compact ? 38 : 44;
  return (
    <View style={styles.brand}>
      <View style={[styles.markFrame, { width: markSize, height: markSize, borderRadius: compact ? 12 : 14 }]}>
        <View style={styles.markOrbit} />
        <View style={styles.markC} />
        <View style={styles.markSpark} />
      </View>
      <View style={styles.wordmarkBlock}>
        <Text style={[styles.wordmark, compact && styles.wordmarkCompact]}>CATALYSTS</Text>
        <Text style={styles.tagline}>YOUR PERSONAL ACADEMIC OS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  markFrame: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: `${colors.lime}50`, backgroundColor: `${colors.lime}0C`, shadowColor: colors.lime, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  markOrbit: { position: "absolute", width: "66%", height: "42%", borderWidth: 0.8, borderColor: `${colors.cyan}A0`, borderRadius: 999, transform: [{ rotate: "-28deg" }] },
  markC: { width: "48%", height: "48%", borderWidth: 2.2, borderColor: colors.lime, borderRightColor: "transparent", borderRadius: 999, transform: [{ rotate: "-28deg" }] },
  markSpark: { position: "absolute", width: 4, height: 4, borderRadius: 3, backgroundColor: colors.foreground, shadowColor: colors.lime, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  wordmarkBlock: { gap: 3 },
  wordmark: { color: colors.foreground, fontSize: 14, fontWeight: "800", letterSpacing: 2.6 },
  wordmarkCompact: { fontSize: 12, letterSpacing: 2.1 },
  tagline: { color: colors.subtle, fontSize: 8, fontWeight: "600", letterSpacing: 1.35 },
});
