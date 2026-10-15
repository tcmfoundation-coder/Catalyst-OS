import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CatalystBrand } from "@/components/brand/CatalystBrand";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { TactilePressable } from "@/components/ui/TactilePressable";
import { colors, radius, space } from "@/theme/tokens";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      showToast("Welcome back");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Sign in failed. Try again.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.screen}>
            <View style={styles.topLine}>
              <CatalystBrand />
              <Text style={styles.accessTag}>SECURE ACCESS <Text style={styles.dimSlash}>/ 01</Text></Text>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroGlow} />
              <Text style={styles.heroEyebrow}>YOUR PERSONAL ACADEMIC OS</Text>
              <CatalystOrb state="idle" size={184} />
              <Text style={styles.heroTitle}>Your studies, in sync.</Text>
              <Text style={styles.heroCopy}>One focused space for your academic momentum.</Text>
            </View>

            <View style={styles.formPanel}>
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>Welcome back</Text>
                <Text style={styles.formDescription}>Sign in with your existing Catalysts account.</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  returnKeyType="next"
                  selectionColor={colors.lime}
                  style={styles.input}
                  value={email}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>PASSWORD</Text>
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleSignIn()}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  returnKeyType="go"
                  secureTextEntry
                  selectionColor={colors.lime}
                  style={styles.input}
                  value={password}
                />
              </View>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {!getApiBaseUrl() ? (
                <Text style={styles.configHint}>API address is not set. Configure EXPO_PUBLIC_CATALYSTS_API_URL in mobile/.env.local.</Text>
              ) : null}

              <TactilePressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void handleSignIn()}
                style={[styles.button, submitting && styles.disabled]}
              >
                {submitting ? <ActivityIndicator color={colors.black} /> : <Text style={styles.buttonText}>Sign in to Catalysts <Text style={styles.arrow}>→</Text></Text>}
              </TactilePressable>
              <Text style={styles.footer}>Your password is checked by Catalysts Core. Your sign-in stays active for this session.</Text>
            </View>

            <Text style={styles.bottomMark}>CATALYST CORE <Text style={styles.dimSlash}>·</Text> KNOWLEDGE INTO MOMENTUM</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: "center", paddingHorizontal: space.xl, paddingVertical: space.xxl },
  screen: { width: "100%", maxWidth: 520, gap: space.lg },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  accessTag: { color: colors.lime, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  dimSlash: { color: colors.subtle },
  hero: { alignItems: "center", overflow: "hidden", borderRadius: radius.hero, borderWidth: 1, borderColor: `${colors.lime}26`, backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.lg, gap: 7 },
  heroGlow: { position: "absolute", top: 30, width: 220, height: 180, borderRadius: 999, backgroundColor: colors.lime, opacity: 0.045 },
  heroEyebrow: { color: colors.subtle, fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: colors.foreground, fontSize: 21, fontWeight: "700", marginTop: -5, letterSpacing: -0.25 },
  heroCopy: { color: colors.muted, fontSize: 12, textAlign: "center" },
  formPanel: { borderRadius: radius.hero, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: space.xl, gap: space.lg },
  formHeading: { gap: 5, marginBottom: 1 },
  formTitle: { color: colors.foreground, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  formDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  field: { gap: 8 },
  label: { color: colors.foreground, fontSize: 9, fontWeight: "800", letterSpacing: 1.25 },
  input: { minHeight: 54, borderRadius: radius.control, borderWidth: 1, borderTopColor: "#080E12", borderLeftColor: "#17232A", borderRightColor: "#34454F", borderBottomColor: "#425761", backgroundColor: "#0A1116", color: colors.foreground, paddingHorizontal: 15, fontSize: 15, fontWeight: "500", shadowColor: colors.black, shadowOpacity: 0.45, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  configHint: { color: colors.amber, fontSize: 11, lineHeight: 17 },
  button: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: radius.control, backgroundColor: colors.lime, borderColor: "#D4FF9A", borderBottomColor: "#79A83C", marginTop: 1 },
  buttonText: { color: colors.black, fontSize: 13, fontWeight: "800" },
  arrow: { fontSize: 17 },
  disabled: { opacity: 0.65 },
  footer: { color: colors.subtle, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: -3 },
  bottomMark: { color: colors.subtle, fontSize: 8, fontWeight: "800", letterSpacing: 1.3, textAlign: "center", paddingTop: 3 },
});
