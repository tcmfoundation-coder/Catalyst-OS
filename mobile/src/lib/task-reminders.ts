import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import type { MobileTask } from "@/lib/api";

const TASK_REMINDER_DATA_KEY = "catalystsTaskId";
const MAX_SCHEDULED_TASK_REMINDERS = 50;
let syncQueue: Promise<void> = Promise.resolve();

export function syncTaskDeadlineNotifications(tasks: MobileTask[], reminderTime: string) {
  const next = syncQueue.catch(() => undefined).then(() => syncTaskDeadlineNotificationsNow(tasks, reminderTime));
  syncQueue = next;
  return next;
}

async function syncTaskDeadlineNotificationsNow(tasks: MobileTask[], reminderTime: string) {
  if (Platform.OS === "web" || isRunningInExpoGo()) return;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
    throw new Error("Task reminder time is invalid.");
  }
  const Notifications = await import("expo-notifications");
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const managed = scheduled.filter((notification) => {
    const data: unknown = notification.content.data;
    return Boolean(data && typeof data === "object" && TASK_REMINDER_DATA_KEY in data);
  });
  const [hour, minute] = reminderTime.split(":").map(Number);
  const now = Date.now();
  const dueTasks = tasks
    .filter((task) => task.status !== "completed" && task.dueDate)
    .map((task) => {
      const date = task.dueDate?.slice(0, 10).split("-").map(Number);
      if (!date || date.length !== 3) return null;
      const triggerDate = new Date(date[0], date[1] - 1, date[2], hour, minute);
      return triggerDate.getTime() > now ? { task, triggerDate } : null;
    })
    .filter((item): item is { task: MobileTask; triggerDate: Date } => item !== null)
    .sort((left, right) => left.triggerDate.getTime() - right.triggerDate.getTime())
    .slice(0, MAX_SCHEDULED_TASK_REMINDERS);

  const createdIds: string[] = [];
  try {
    for (const { task, triggerDate } of dueTasks) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Task due today",
          body: task.title,
          data: { [TASK_REMINDER_DATA_KEY]: task.id, url: "/command" },
          ...(Platform.OS === "android" ? { channelId: "catalysts-reminders" } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          ...(Platform.OS === "android" ? { channelId: "catalysts-reminders" } : {}),
        },
      });
      createdIds.push(identifier);
    }
  } catch (error) {
    await Promise.all(createdIds.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
    throw error;
  }

  await Promise.all(managed.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
}
