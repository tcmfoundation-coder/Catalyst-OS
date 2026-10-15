import "server-only";
import { Types } from "mongoose";
import { MobilePushToken } from "@/models/MobilePushToken";

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

export async function sendExpoPushToUser(
  userId: string,
  message: Omit<ExpoPushMessage, "to" | "sound" | "channelId">,
  excludeToken?: string | null,
) {
  const tokens = await MobilePushToken.find({
    userId: new Types.ObjectId(userId),
    ...(excludeToken ? { token: { $ne: excludeToken } } : {}),
  }).select("token");

  if (tokens.length === 0) return;

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: "default" as const,
    channelId: "catalysts-updates",
    ...message,
  }));

  for (let offset = 0; offset < messages.length; offset += 100) {
    const batch = messages.slice(offset, offset + 100);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Expo Push Service returned HTTP ${response.status}`);
    }

    const result: unknown = await response.json();
    if (
      !result
      || typeof result !== "object"
      || !("data" in result)
      || !Array.isArray(result.data)
      || result.data.length !== batch.length
      || result.data.some((ticket) => (
        !ticket
        || typeof ticket !== "object"
        || !("status" in ticket)
        || (ticket.status !== "ok" && ticket.status !== "error")
      ))
    ) {
      throw new Error("Expo Push Service returned an invalid ticket response.");
    }
    const tickets = result.data as ExpoPushTicket[];
    const invalidTokens = tickets
      .map((ticket, index) => ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
        ? batch[index]?.to
        : null)
      .filter((token): token is string => token !== null);

    if (invalidTokens.length) {
      await MobilePushToken.deleteMany({ token: { $in: invalidTokens } });
    }

    const failures = tickets.filter((ticket) => ticket.status === "error" && ticket.details?.error !== "DeviceNotRegistered");
    if (failures.length) {
      throw new Error(`Expo Push Service rejected ${failures.length} notification(s): ${failures.map((ticket) => ticket.message ?? ticket.details?.error ?? "unknown error").join("; ")}`);
    }
  }
}

export async function notifyTaskChange(
  userId: string,
  title: string,
  body: string,
  taskId: string,
  excludeToken?: string | null,
) {
  try {
    await sendExpoPushToUser(userId, {
      title,
      body,
      data: { url: "/command", taskId },
    }, excludeToken);
  } catch (error) {
    console.error("Could not send task-change push notification", error);
  }
}
