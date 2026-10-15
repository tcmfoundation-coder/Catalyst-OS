import * as Network from "expo-network";
import { AppState, Platform } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { flushOfflineQueue, retryFailedMutations } from "@/lib/api";
import { getOfflineQueueCounts } from "@/lib/offline-store";

type SyncState = {
  online: boolean;
  pending: number;
  failed: number;
  failureMessage: string | null;
  syncNow(): Promise<number>;
  retry(): Promise<void>;
};

const OfflineSyncContext = createContext<SyncState | null>(null);

export function OfflineSyncProvider({ children }: PropsWithChildren) {
  const { state } = useAuth();
  const [online, setOnline] = useState(false);
  const token = state.status === "authenticated" ? state.token : null;
  const userId = state.status === "authenticated" ? state.user.id : null;
  const [queueCounts, setQueueCounts] = useState({
    userId: null as string | null,
    pending: 0,
    failed: 0,
    failureMessage: null as string | null,
  });
  const pending = queueCounts.userId === userId ? queueCounts.pending : 0;
  const failed = queueCounts.userId === userId ? queueCounts.failed : 0;
  const failureMessage = queueCounts.userId === userId ? queueCounts.failureMessage : null;

  const refreshQueue = useCallback(async () => {
    if (!userId || Platform.OS === "web") return;
    const counts = await getOfflineQueueCounts();
    setQueueCounts({ userId, ...counts });
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!token || !online || Platform.OS === "web") return 0;
    const synced = await flushOfflineQueue(token);
    await refreshQueue();
    return synced;
  }, [online, refreshQueue, token]);

  const retry = useCallback(async () => {
    if (Platform.OS === "web") return;
    await retryFailedMutations();
    await refreshQueue();
    await syncNow();
  }, [refreshQueue, syncNow]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const update = () => setOnline(window.navigator.onLine);
      update();
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      return () => {
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
      };
    }
    let active = true;
    const update = (connected: boolean | null | undefined, reachable: boolean | null | undefined) => {
      if (active) setOnline(connected === true && reachable !== false);
    };
    void Network.getNetworkStateAsync()
      .then((network) => update(network.isConnected, network.isInternetReachable))
      .catch((error: unknown) => console.error("Could not read device network state", error));
    const subscription = Network.addNetworkStateListener((network) => {
      update(network.isConnected, network.isInternetReachable);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!userId || Platform.OS === "web") return;
    let active = true;
    void getOfflineQueueCounts()
      .then((counts) => {
        if (active) setQueueCounts({ userId, ...counts });
      })
      .catch((error: unknown) => console.error("Could not read offline sync queue", error));
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!token || !online || Platform.OS === "web") return;
    let active = true;
    const sync = () => {
      if (AppState.currentState !== "active") return;
      void flushOfflineQueue(token)
        .then(refreshQueue)
        .catch((error: unknown) => console.error("Offline changes could not be synced", error));
    };
    sync();
    const timer = setInterval(() => {
      if (active) sync();
    }, 15_000);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") sync();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [online, refreshQueue, token]);

  const value = useMemo(
    () => ({ online, pending, failed, failureMessage, syncNow, retry }),
    [online, pending, failed, failureMessage, syncNow, retry],
  );
  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  return context;
}
