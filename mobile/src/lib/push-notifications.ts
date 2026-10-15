import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import { registerPushToken, setActivePushToken, unregisterPushToken } from "@/lib/api";

const PUSH_TOKEN_KEY = "catalysts.mobile.push-token";

async function getExpoPushToken() {
  if (Platform.OS === "web") throw new Error("Push notifications are available in the installed mobile app.");
  if (isRunningInExpoGo()) throw new Error("Remote push notifications need an installed Catalyst development or production build.");
  if (!Device.isDevice) throw new Error("Remote push notifications require a physical device.");

  const Notifications = await import("expo-notifications");
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Notification permission was not granted. Enable notifications in your device settings.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("catalysts-updates", {
      name: "Catalysts updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#B8F66A",
    });
  }

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Expo project ID is missing from the app configuration.");
  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  return result.data;
}

export async function enableServerPush(token: string) {
  const pushToken = await getExpoPushToken();
  await registerPushToken(token, pushToken, Platform.OS === "ios" ? "ios" : "android");
  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
  } catch (error) {
    try {
      await unregisterPushToken(token, pushToken);
    } catch (cleanupError) {
      console.error("Could not undo push registration after secure storage failed", cleanupError);
    }
    throw error;
  }
  setActivePushToken(pushToken);
}

export async function restoreServerPushRegistration(token: string) {
  if (Platform.OS === "web") return;
  const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!pushToken) {
    await enableServerPush(token);
    return;
  }
  setActivePushToken(pushToken);
  await registerPushToken(token, pushToken, Platform.OS === "ios" ? "ios" : "android");
}

export async function disableServerPush(token: string) {
  if (Platform.OS === "web") {
    setActivePushToken(null);
    return;
  }
  const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (pushToken) await unregisterPushToken(token, pushToken);
  setActivePushToken(null);
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}

export async function forgetServerPushRegistration() {
  setActivePushToken(null);
  if (Platform.OS === "web") {
    return;
  }
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
