import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ApiError, createMobileSession, getMobileSession, revokeMobileSession, type UserProfile } from "@/lib/api";

const TOKEN_KEY = "catalysts.mobile.session";

type AuthState =
  | { status: "loading" | "signed-out" | "offline" }
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
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return { status: "offline" };
  }
  if (!token) return { status: "signed-out" };

  try {
    const session = await getMobileSession(token);
    return { status: "authenticated", token, user: session.user };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      return { status: "signed-out" };
    }
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
      await SecureStore.setItemAsync(TOKEN_KEY, session.token);
    } catch {
      await revokeMobileSession(session.token).catch(() => undefined);
      throw new Error("Secure storage is unavailable on this device. Your session was not saved.");
    }
    setState({ status: "authenticated", token: session.token, user: session.user });
  }, []);

  const signOut = useCallback(async () => {
    const current = state;
    if (current.status === "authenticated") {
      await revokeMobileSession(current.token).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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
