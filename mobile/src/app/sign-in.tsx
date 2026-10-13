import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const colors = { background: "#080B10", surface: "#101820", line: "#26343E", foreground: "#E6EDF2", muted: "#8495A2", accent: "#A5F34B", danger: "#FF756E" };

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.logo}><Text style={styles.logoMark}>C</Text></View>
            <Text style={styles.eyebrow}>PERSONAL ACADEMIC SYSTEM</Text>
            <Text style={styles.title}>Your studies, in sync.</Text>
            <Text style={styles.description}>Sign in with the Catalysts account you already use on the web.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#657480"
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={setPassword}
                onSubmitEditing={() => void handleSignIn()}
                placeholder="Enter your password"
                placeholderTextColor="#657480"
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {!getApiBaseUrl() ? (
              <Text style={styles.configHint}>API address is not set. Configure EXPO_PUBLIC_CATALYSTS_API_URL in mobile/.env.local.</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void handleSignIn()}
              style={({ pressed }) => [styles.button, pressed && styles.pressed, submitting && styles.disabled]}
            >
              {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>Sign in to Catalysts</Text>}
            </Pressable>
            <Text style={styles.footer}>Your password is checked by Catalysts Core. The app stores only the issued session token in device secure storage.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 22 },
  card: { width: "100%", maxWidth: 440, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 24, gap: 13 },
  logo: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#A5F34B55", backgroundColor: "#A5F34B12", marginBottom: 2 },
  logoMark: { color: colors.accent, fontSize: 18, fontWeight: "800" },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1.8 },
  title: { color: colors.foreground, fontSize: 27, lineHeight: 33, fontWeight: "700", marginTop: 1 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 7 },
  field: { gap: 7 },
  label: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, color: colors.foreground, paddingHorizontal: 13, fontSize: 14 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  configHint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.accent, marginTop: 3 },
  buttonText: { color: colors.background, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.65 },
  footer: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 4 },
});
