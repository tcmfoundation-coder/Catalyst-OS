import * as SecureStore from "expo-secure-store";
import { isRunningInExpoGo } from "expo";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { disableServerPush } from "@/lib/push-notifications";

export interface AppSettings {
  notifications: {
    studyReminder: { enabled: boolean; time: string };
    taskReminder: { enabled: boolean; time: string };
    serverPush: { enabled: boolean };
  };
  weeklyStudyGoalHours: number;
  reduceMotion: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    studyReminder: { enabled: false, time: "18:00" },
    taskReminder: { enabled: false, time: "09:00" },
    serverPush: { enabled: false },
  },
  weeklyStudyGoalHours: 5,
  reduceMotion: false,
};

const REMINDER_DATA_KEY = "catalystsReminder";

async function loadNotificationApi() {
  if (isRunningInExpoGo()) {
    throw new Error("Scheduled reminders need a Catalyst development build with the notifications module. The rest of the app works in Expo Go.");
  }
  return import("expo-notifications");
}

interface SettingsRecord {
  userId: string;
  settings: AppSettings;
  error: string | null;
}

async function readSettingsRecord(userId: string): Promise<SettingsRecord> {
  try {
    return { userId, settings: await readSettings(userId), error: null };
  } catch (cause) {
    return {
      userId,
      settings: DEFAULT_SETTINGS,
      error: cause instanceof Error ? cause.message : "Could not load saved settings.",
    };
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  retryLoad(): void;
  resetSettings(): Promise<void>;
  updateSettings(patch: Partial<Omit<AppSettings, "notifications">> & {
    notifications?: Partial<AppSettings["notifications"]>;
  }): Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function storageKey(userId: string) {
  return `catalysts.mobile.settings.v1.${userId}`;
}

async function readSettings(userId: string): Promise<AppSettings> {
  const key = storageKey(userId);
  const stored = Platform.OS === "web"
    ? window.localStorage.getItem(key)
    : await SecureStore.getItemAsync(key);
  if (!stored) return DEFAULT_SETTINGS;

  const parsed: unknown = JSON.parse(stored);
  if (!parsed || typeof parsed !== "object") throw new Error("Saved settings are invalid. Reset them to continue.");
  const value = parsed as Partial<AppSettings> & {
    notifications?: Partial<AppSettings["notifications"]>;
  };
  const notifications = { ...DEFAULT_SETTINGS.notifications, ...value.notifications };
  const validTime = (time: unknown) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (
    typeof notifications.studyReminder?.enabled !== "boolean" ||
    !validTime(notifications.studyReminder.time) ||
    typeof notifications.taskReminder?.enabled !== "boolean" ||
    !validTime(notifications.taskReminder.time) ||
    typeof notifications.serverPush?.enabled !== "boolean" ||
    typeof value.weeklyStudyGoalHours !== "number" ||
    !Number.isInteger(value.weeklyStudyGoalHours) ||
    value.weeklyStudyGoalHours < 1 ||
    value.weeklyStudyGoalHours > 20 ||
    typeof value.reduceMotion !== "boolean"
  ) {
    throw new Error("Saved settings are invalid. Reset them to continue.");
  }
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    notifications,
  };
}

async function writeSettings(userId: string, settings: AppSettings) {
  const key = storageKey(userId);
  const value = JSON.stringify(settings);
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

function reminderTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

async function clearCatalystReminders() {
  const Notifications = await loadNotificationApi();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const managed = scheduled.filter((notification) => {
    const data: unknown = notification.content.data;
    if (!data || typeof data !== "object") return false;
    const reminderId = (data as Record<string, unknown>)[REMINDER_DATA_KEY];
    return reminderId === "study" || reminderId === "tasks";
  });
  await Promise.all(managed.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
}

async function syncReminderNotifications(settings: AppSettings["notifications"]) {
  if (Platform.OS === "web") {
    if (settings.studyReminder.enabled || settings.taskReminder.enabled) {
      throw new Error("Scheduled device reminders are available in the mobile app, not the browser.");
    }
    return;
  }

  const hasEnabledReminder = settings.studyReminder.enabled || settings.taskReminder.enabled;
  if (isRunningInExpoGo()) {
    if (hasEnabledReminder) {
      throw new Error("Scheduled reminders need a Catalyst development build with the notifications module. The rest of the app works in Expo Go.");
    }
    return;
  }

  const Notifications = await loadNotificationApi();
  if (hasEnabledReminder) {
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") {
      throw new Error("Notification permission was not granted. Enable notifications in your device settings to turn on reminders.");
    }
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("catalysts-reminders", {
      name: "Catalysts reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#B8F66A",
    });
  }

  await clearCatalystReminders();
  const reminders = [
    {
      id: "study" as const,
      enabled: settings.studyReminder.enabled,
      time: settings.studyReminder.time,
      title: "Time for a focused study session",
      body: "Take one small step toward your weekly study goal.",
    },
    {
      id: "tasks" as const,
      enabled: settings.taskReminder.enabled,
      time: settings.taskReminder.time,
      title: "Check your next actions",
      body: "Review your upcoming tasks and choose what matters next.",
    },
  ];

  try {
    for (const reminder of reminders) {
      if (!reminder.enabled) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { [REMINDER_DATA_KEY]: reminder.id, url: "/command" },
          ...(Platform.OS === "android" ? { channelId: "catalysts-reminders" } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          ...reminderTime(reminder.time),
          ...(Platform.OS === "android" ? { channelId: "catalysts-reminders" } : {}),
        },
      });
    }
  } catch (cause) {
    await clearCatalystReminders();
    throw cause;
  }
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const { state } = useAuth();
  const userId = state.status === "authenticated" ? state.user.id : null;
  const [record, setRecord] = useState<SettingsRecord | null>(null);

  const load = useCallback((id: string) => {
    void readSettingsRecord(id).then(setRecord);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void readSettingsRecord(userId).then((nextRecord) => {
      if (active) setRecord(nextRecord);
    });
    return () => { active = false; };
  }, [userId]);

  const retryLoad = useCallback(() => {
    if (userId) void load(userId);
  }, [load, userId]);

  const resetSettings = useCallback(async () => {
    if (!userId) throw new Error("Sign in before resetting settings.");
    if (record?.userId === userId && record.settings.notifications.serverPush.enabled && state.status === "authenticated") {
      await disableServerPush(state.token);
    }
    await syncReminderNotifications(DEFAULT_SETTINGS.notifications);
    const key = storageKey(userId);
    if (Platform.OS === "web") window.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
    setRecord({ userId, settings: DEFAULT_SETTINGS, error: null });
  }, [record, state, userId]);

  const updateSettings = useCallback(async (
    patch: Partial<Omit<AppSettings, "notifications">> & {
      notifications?: Partial<AppSettings["notifications"]>;
    },
  ) => {
    if (!userId || !record || record.userId !== userId || record.error) {
      throw new Error("Settings are not ready yet. Reload them and try again.");
    }
    const next: AppSettings = {
      ...record.settings,
      ...patch,
      notifications: { ...record.settings.notifications, ...patch.notifications },
    };
    if (patch.notifications) await syncReminderNotifications(next.notifications);
    try {
      await writeSettings(userId, next);
    } catch (cause) {
      if (patch.notifications) {
        try {
          await syncReminderNotifications(record.settings.notifications);
        } catch (restoreCause) {
          const saveError = cause instanceof Error ? cause.message : "Could not save settings.";
          const restoreError = restoreCause instanceof Error ? restoreCause.message : "Could not restore the previous reminder schedule.";
          throw new Error(`${saveError} The previous reminder schedule could not be restored: ${restoreError}`);
        }
      }
      throw cause;
    }
    setRecord({ userId, settings: next, error: null });
  }, [record, userId]);

  const currentRecord = record?.userId === userId ? record : null;
  const value = useMemo<SettingsContextValue>(() => ({
    settings: currentRecord?.settings ?? DEFAULT_SETTINGS,
    loading: Boolean(userId && !currentRecord),
    error: currentRecord?.error ?? null,
    retryLoad,
    resetSettings,
    updateSettings,
  }), [currentRecord, resetSettings, retryLoad, updateSettings, userId]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useAppSettings must be used within SettingsProvider");
  return context;
}
