import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { isRunningInExpoGo } from "expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SettingsProvider, useAppSettings } from "@/lib/settings-context";
import { OfflineSyncProvider, useOfflineSync } from "@/lib/offline-sync-context";
import { SyncStatusBanner } from "@/components/offline/SyncStatusBanner";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";
import { TactilePressable } from "@/components/ui/TactilePressable";
import { CatalystBrand } from "@/components/brand/CatalystBrand";
import { CatalystOrb } from "@/components/brand/CatalystOrb";
import { getTasks, subscribeToTaskCacheChanges } from "@/lib/api";
import { restoreServerPushRegistration } from "@/lib/push-notifications";
import { syncTaskDeadlineNotifications } from "@/lib/task-reminders";
import { colors, space } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <OfflineSyncProvider>
            <DeviceNotificationSync />
            <RootNavigator />
          </OfflineSyncProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

function RootNavigator() {
  const { state, retryRestore, signOut } = useAuth();

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
        <Text style={styles.muted}>{state.message ?? "Reconnect to the Catalysts API to restore your session."}</Text>
        <TactilePressable style={styles.button} onPress={() => void retryRestore()}>
          <Text style={styles.buttonText}>Retry connection <Text>→</Text></Text>
        </TactilePressable>
        <TactilePressable style={styles.secondaryButton} onPress={() => void signOut()}>
          <Text style={styles.secondaryButtonText}>Sign out to choose another account</Text>
        </TactilePressable>
      </SafeAreaView>
    );
  }

  const isAuthenticated = state.status === "authenticated";
  return (
    <View style={styles.navigator}>
      {Platform.OS !== "web" ? <SyncStatusBanner /> : null}
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
    </View>
  );
}

function DeviceNotificationSync() {
  const { state } = useAuth();
  const { settings, loading } = useAppSettings();
  const { online, pending, failed } = useOfflineSync();
  const { showToast } = useToast();
  const router = useRouter();
  const pushRegistrationKey = useRef<string | null>(null);
  const token = state.status === "authenticated" ? state.token : null;

  useEffect(() => {
    if (Platform.OS === "web" || isRunningInExpoGo()) return;
    let active = true;
    let responseSubscription: { remove(): void } | null = null;
    void import("expo-notifications").then((Notifications) => {
      if (!active) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      let lastResponseId: string | null = null;
      const handleNotificationResponse = (response: import("expo-notifications").NotificationResponse | null) => {
        if (!response || response.notification.request.identifier === lastResponseId) return;
        lastResponseId = response.notification.request.identifier;
        const data: unknown = response.notification.request.content.data;
        if (data && typeof data === "object" && "url" in data && data.url === "/command") {
          router.push("/(tabs)/command");
        }
      };
      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
      void Notifications.getLastNotificationResponseAsync()
        .then(handleNotificationResponse)
        .catch((error: unknown) => console.error("Could not read the last notification response", error));
    }).catch((error: unknown) => {
      console.error("Could not initialize notification handling", error);
      showToast(error instanceof Error ? error.message : "Could not initialize notifications.", "error");
    });
    return () => {
      active = false;
      responseSubscription?.remove();
    };
  }, [router, showToast]);

  useEffect(() => {
    if (Platform.OS === "web" || !token || state.status !== "authenticated" || loading || !online) return;
    if (!settings.notifications.serverPush.enabled) {
      pushRegistrationKey.current = null;
      return;
    }
    const key = `${state.user.id}:${token}`;
    if (pushRegistrationKey.current === key) return;
    pushRegistrationKey.current = key;
    void restoreServerPushRegistration(token).catch((error: unknown) => {
      pushRegistrationKey.current = null;
      console.error("Could not restore push notification registration", error);
      showToast(error instanceof Error ? error.message : "Could not register push notifications.", "error");
    });
  }, [loading, online, settings.notifications.serverPush.enabled, showToast, state, token]);

  useEffect(() => {
    if (!token || state.status !== "authenticated" || loading) return;
    let active = true;
    const reminderTime = settings.notifications.taskReminder.time;
    const refreshTaskReminders = () => {
      if (!settings.notifications.taskReminder.enabled) {
        void syncTaskDeadlineNotifications([], reminderTime)
          .catch((error: unknown) => console.error("Could not clear task due-date reminders", error));
        return;
      }
      void getTasks(token)
        .then((tasks) => {
          if (active) return syncTaskDeadlineNotifications(tasks, reminderTime);
          return undefined;
        })
        .catch((error: unknown) => {
          console.error("Could not refresh task due-date reminders", error);
          showToast(error instanceof Error ? error.message : "Could not refresh task reminders.", "error");
        });
    };
    refreshTaskReminders();
    const unsubscribe = subscribeToTaskCacheChanges(refreshTaskReminders);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") refreshTaskReminders();
    });
    return () => {
      active = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [failed, loading, pending, settings.notifications.taskReminder.enabled, settings.notifications.taskReminder.time, showToast, state.status, token]);

  return null;
}

const styles = StyleSheet.create({
  navigator: { flex: 1, backgroundColor: colors.background },
  startup: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xl, backgroundColor: colors.background },
  offline: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xxl, backgroundColor: colors.background },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  eyebrowAmber: { color: colors.amber, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  slash: { color: colors.subtle },
  title: { color: colors.foreground, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: space.xs },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 300 },
  button: { marginTop: space.md, paddingHorizontal: space.xl, paddingVertical: 13, borderRadius: 13, backgroundColor: colors.lime, borderTopColor: "#D4FF9A", borderBottomColor: "#79A83C" },
  buttonText: { color: colors.black, fontSize: 13, fontWeight: "800" },
  secondaryButton: { marginTop: space.sm, paddingHorizontal: space.xl, paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.line },
  secondaryButtonText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
});
