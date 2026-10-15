export const colors = {
  background: "#070B10",
  surface: "#0D141B",
  surfaceRaised: "#141E27",
  line: "#2A3944",
  foreground: "#F1F6F7",
  muted: "#A2B2BC",
  subtle: "#758791",
  lime: "#B8F66A",
  cyan: "#73DCEB",
  amber: "#FFC46B",
  danger: "#FF707B",
  black: "#10170C",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radius = { control: 12, panel: 18, hero: 24, pill: 999 } as const;

export type CatalystAssistantState =
  | "idle"
  | "activated"
  | "listening"
  | "thinking"
  | "speaking"
  | "success"
  | "alert";

export const assistantStateLabels: Record<CatalystAssistantState, string> = {
  idle: "CORE STANDBY",
  activated: "CORE ACTIVATED",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "RESPONDING",
  success: "COMPLETE",
  alert: "ATTENTION REQUIRED",
};

export const assistantStateColors: Record<CatalystAssistantState, string> = {
  idle: colors.lime,
  activated: colors.cyan,
  listening: colors.cyan,
  thinking: colors.cyan,
  speaking: colors.cyan,
  success: colors.lime,
  alert: colors.amber,
};
