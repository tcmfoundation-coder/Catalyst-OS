import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/theme/tokens";

type ToastKind = "success" | "error";
type ToastValue = { message: string; kind: ToastKind; id: number } | null;
type ToastContextValue = { showToast(message: string, kind?: ToastKind): void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastValue>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ message, kind, id });
    timer.current = setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
    }, 3600);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <SafeAreaProvider>
      <ToastContext.Provider value={{ showToast }}>
        {children}
        <ToastOverlay toast={toast} onDismiss={() => setToast(null)} />
      </ToastContext.Provider>
    </SafeAreaProvider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

function ToastOverlay({ toast, onDismiss }: { toast: ToastValue; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  const isError = toast.kind === "error";

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + space.sm }]}>
      <Pressable
        accessibilityRole={isError ? "alert" : "text"}
        accessibilityLiveRegion={isError ? "assertive" : "polite"}
        onPress={onDismiss}
        style={[styles.toast, isError ? styles.errorToast : styles.successToast]}
      >
        <Text style={[styles.icon, isError ? styles.errorText : styles.successText]}>
          {isError ? "!" : "✓"}
        </Text>
        <Text style={styles.message}>{toast.message}</Text>
        <Text style={styles.dismiss}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    alignItems: "center",
    paddingHorizontal: space.lg,
  },
  toast: {
    width: "100%",
    maxWidth: 520,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: radius.control,
    borderWidth: 1,
    backgroundColor: "#10191F",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  successToast: { borderColor: `${colors.lime}75` },
  errorToast: { borderColor: `${colors.danger}80` },
  icon: { fontSize: 15, fontWeight: "900" },
  successText: { color: colors.lime },
  errorText: { color: colors.danger },
  message: { flex: 1, color: colors.foreground, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  dismiss: { color: colors.subtle, fontSize: 20, lineHeight: 22, paddingLeft: 3 },
});
