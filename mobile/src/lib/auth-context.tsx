import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import { ApiError, createMobileSession, getMobileSession, revokeMobileSession, type UserProfile } from "@/lib/api";
import { activateOfflineUser } from "@/lib/offline-store";
import { disableServerPush, forgetServerPushRegistration } from "@/lib/push-notifications";

const TOKEN_KEY = "catalysts.mobile.session";
const USER_KEY = "catalysts.mobile.user";

function readStoredToken() {
  return Platform.OS === "web" ? Promise.resolve(sessionStorage.getItem(TOKEN_KEY)) : SecureStore.getItemAsync(TOKEN_KEY);
}

function saveStoredToken(token: string) {
  if (Platform.OS === "web") {
    sessionStorage.setItem(TOKEN_KEY, token);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

function deleteStoredToken() {
  if (Platform.OS === "web") {
    sessionStorage.removeItem(TOKEN_KEY);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function readStoredUser(): Promise<UserProfile | null> {
  const stored = Platform.OS === "web"
    ? sessionStorage.getItem(USER_KEY)
    : await SecureStore.getItemAsync(USER_KEY);
  if (!stored) return null;
  const parsed: unknown = JSON.parse(stored);
  if (!parsed || typeof parsed !== "object" || !("id" in parsed) || !("email" in parsed) || !("name" in parsed)) {
    throw new Error("Saved account profile is invalid.");
  }
  return parsed as UserProfile;
}

async function saveStoredUser(user: UserProfile) {
  const serialized = JSON.stringify(user);
  if (Platform.OS === "web") {
    sessionStorage.setItem(USER_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, serialized);
}

async function deleteStoredUser() {
  if (Platform.OS === "web") {
    sessionStorage.removeItem(USER_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(USER_KEY);
}

type AuthState =
  | { status: "loading" | "signed-out" }
  | { status: "offline"; message?: string }
  | { status: "authenticated"; token: string; user: UserProfile };

interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  retryRestore(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function restoreMobileSession(): Promise<AuthState> {
  let token: string | null;
  let cachedUser: UserProfile | null;
  try {
    token = await readStoredToken();
    cachedUser = await readStoredUser();
  } catch (cause) {
    return {
      status: "offline",
      message: cause instanceof Error ? cause.message : "Could not read the saved account session.",
    };
  }
  if (!token) return { status: "signed-out" };

  if (cachedUser && Platform.OS !== "web") {
    try {
      await activateOfflineUser(cachedUser.id);
    } catch (cause) {
      return {
        status: "offline",
        message: cause instanceof Error ? cause.message : "Could not open this account's offline data.",
      };
    }
  }

  try {
    const session = await getMobileSession(token);
    await saveStoredUser(session.user);
    if (Platform.OS !== "web") await activateOfflineUser(session.user.id);
    return { status: "authenticated", token, user: session.user };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      await deleteStoredToken();
      await deleteStoredUser();
      return { status: "signed-out" };
    }
    if (cachedUser && Platform.OS !== "web") return { status: "authenticated", token, user: cachedUser };
    return { status: "offline" };
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const retryRestore = useCallback(async () => {
    setState(await restoreMobileSession());
  }, []);

  useEffect(() => {
    let active = true;
    void restoreMobileSession().then((restored) => {
      if (active) setState(restored);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await createMobileSession(email, password);
    try {
      if (Platform.OS !== "web") await activateOfflineUser(session.user.id);
      await saveStoredToken(session.token);
      await saveStoredUser(session.user);
    } catch (cause) {
      try {
        await revokeMobileSession(session.token);
      } catch (revokeError) {
        console.error("Could not revoke a session that failed to save locally", revokeError);
      }
      if (cause instanceof Error && cause.message.includes("unsynced changes")) throw cause;
      throw new Error("Secure storage is unavailable on this device. Your session was not saved.");
    }
    setState({ status: "authenticated", token: session.token, user: session.user });
  }, []);

  const signOut = useCallback(async () => {
    const current = state;
    if (current.status === "authenticated") {
      try {
        await disableServerPush(current.token);
      } catch (error) {
        console.error("Could not unregister push notifications during sign out", error);
        await forgetServerPushRegistration();
      }
      try {
        await revokeMobileSession(current.token);
      } catch (error) {
        console.error("Could not revoke the mobile session", error);
      }
    } else {
      await forgetServerPushRegistration();
    }
    await deleteStoredToken();
    await deleteStoredUser();
    setState({ status: "signed-out" });
  }, [state]);

  const value = useMemo(() => ({ state, signIn, signOut, retryRestore }), [state, signIn, signOut, retryRestore]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
