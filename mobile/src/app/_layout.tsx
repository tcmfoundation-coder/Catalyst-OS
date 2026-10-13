import { Stack } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const colors = { background: "#080B10", foreground: "#E6EDF2", muted: "#8495A2", accent: "#A5F34B" };

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { state, retryRestore } = useAuth();

  if (state.status === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Restoring your session…</Text>
      </View>
    );
  }

  if (state.status === "offline") {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.brand}>CATALYSTS</Text>
        <Text style={styles.title}>Connection unavailable</Text>
        <Text style={styles.muted}>Reconnect to the Catalysts API to restore your session.</Text>
        <Pressable style={styles.button} onPress={() => void retryRestore()}>
          <Text style={styles.buttonText}>Retry connection</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isAuthenticated = state.status === "authenticated";
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 28, backgroundColor: colors.background },
  brand: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 4 },
  title: { color: colors.foreground, fontSize: 23, fontWeight: "700", textAlign: "center" },
  muted: { color: colors.muted, fontSize: 14, textAlign: "center" },
  button: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.accent },
  buttonText: { color: colors.background, fontSize: 14, fontWeight: "700" },
});
