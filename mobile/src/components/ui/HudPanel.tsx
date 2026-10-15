import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, space } from "@/theme/tokens";

export function HudPanel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[styles.panel, style]}>
      <View pointerEvents="none" style={styles.highlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.panel,
    borderWidth: 1,
    borderTopColor: "#50616B",
    borderLeftColor: "#34434D",
    borderRightColor: "#202D36",
    borderBottomColor: "#1A252D",
    backgroundColor: colors.surfaceRaised,
    padding: space.lg,
    shadowColor: colors.black,
    shadowOpacity: 0.48,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  highlight: { position: "absolute", top: 1, left: "12%", right: "12%", height: 1, borderRadius: 1, backgroundColor: "#FFFFFF12" },
});
