import React, { createContext, useContext, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  divider: string;
  accent: string;
  accentSoft: string;
  warning: string;
  success: string;
  danger: string;
  onAccent: string;
  headerGlowA: string;
  headerGlowB: string;
  chipText: string;
  logoutBg: string;
};

const themes: Record<ThemeMode, ThemeColors> = {
  dark: {
    background: "#0b0f1a",
    surface: "#0f172a",
    surfaceAlt: "#0b1224",
    text: "#e5e7eb",
    textMuted: "#94a3b8",
    border: "rgba(148,163,184,0.15)",
    borderStrong: "rgba(148,163,184,0.28)",
    divider: "rgba(148,163,184,0.18)",
    accent: "#38bdf8",
    accentSoft: "rgba(56,189,248,0.10)",
    warning: "#facc15",
    success: "#22c55e",
    danger: "#fb7185",
    onAccent: "#0b0f1a",
    headerGlowA: "rgba(250,204,21,0.14)",
    headerGlowB: "rgba(56,189,248,0.12)",
    chipText: "#0b0f1a",
    logoutBg: "#1f2933",
  },
  light: {
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceAlt: "#f1f5f9",
    text: "#0f172a",
    textMuted: "#475569",
    border: "rgba(15,23,42,0.12)",
    borderStrong: "rgba(15,23,42,0.22)",
    divider: "rgba(15,23,42,0.12)",
    accent: "#7dd3fc",
    accentSoft: "rgba(125,211,252,0.28)",
    warning: "#f59e0b",
    success: "#86efac",
    danger: "#fda4af",
    onAccent: "#0b0f1a",
    headerGlowA: "rgba(253,230,138,0.28)",
    headerGlowB: "rgba(125,211,252,0.22)",
    chipText: "#0f172a",
    logoutBg: "#ffffff",
  },
};

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  const colors = useMemo(() => themes[mode], [mode]);
  const value = useMemo(
    () => ({
      mode,
      colors,
      setMode,
      toggleMode: () => setMode(mode === "dark" ? "light" : "dark"),
    }),
    [mode, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
