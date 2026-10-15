import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import type { MobileTask } from "@/lib/api";

const TASK_REMINDER_DATA_KEY = "catalystsTaskId";
const MAX_SCHEDULED_TASK_REMINDERS = 50;

export async function syncTaskDeadlineNotifications(tasks: MobileTask[], reminderTime: string) {
  if (Platform.OS === "web" || isRunningInExpoGo()) return;
  const Notifications = await import("expo-notifications");
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const managed = scheduled.filter((notification) => {
    const data: unknown = notification.content.data;
    return Boolean(data && typeof data === "object" && TASK_REMINDER_DATA_KEY in data);
  });
  await Promise.all(managed.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));

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

  for (const { task, triggerDate } of dueTasks) {
    await Notifications.scheduleNotificationAsync({
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
  }
}
