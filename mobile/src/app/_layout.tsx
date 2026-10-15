import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { TactilePressable } from "@/components/ui/TactilePressable";
import { CatalystBrand } from "@/components/brand/CatalystBrand";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { colors, space } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <RootNavigator />
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

function RootNavigator() {
  const { state, retryRestore } = useAuth();

  if (state.status === "loading") {
    return (
      <View style={styles.startup}>
        <CatalystBrand />
        <CatalystOrb state="thinking" size={190} />
        <Text style={styles.eyebrow}>SECURE SESSION <Text style={styles.slash}>/</Text> RESTORING</Text>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }

  if (state.status === "offline") {
    return (
      <SafeAreaView style={styles.offline}>
        <CatalystBrand />
        <CatalystOrb state="alert" size={172} motionEnabled={false} />
        <Text style={styles.eyebrowAmber}>CORE CONNECTION <Text style={styles.slash}>/</Text> OFFLINE</Text>
        <Text style={styles.title}>Connection unavailable</Text>
        <Text style={styles.muted}>Reconnect to the Catalysts API to restore your session.</Text>
        <TactilePressable style={styles.button} onPress={() => void retryRestore()}>
          <Text style={styles.buttonText}>Retry connection <Text>→</Text></Text>
        </TactilePressable>
      </SafeAreaView>
    );
  }

  const isAuthenticated = state.status === "authenticated";
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="academic" />
        <Stack.Screen name="materials" />
        <Stack.Screen name="study-notes" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  startup: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xl, backgroundColor: colors.background },
  offline: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xxl, backgroundColor: colors.background },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  eyebrowAmber: { color: colors.amber, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  slash: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: space.xs },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 300 },
  button: { marginTop: space.md, paddingHorizontal: space.xl, paddingVertical: 13, borderRadius: 13, backgroundColor: colors.lime, borderTopColor: "#D4FF9A", borderBottomColor: "#79A83C" },
  buttonText: { color: colors.black, fontSize: 13, fontWeight: "800" },
});
