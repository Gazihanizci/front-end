import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";

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
    background: "#0b0e14",
    surface: "#111827",
    surfaceAlt: "#0f172a",
    text: "#e5e7eb",
    textMuted: "#9aa4b2",
    border: "rgba(148,163,184,0.16)",
    borderStrong: "rgba(148,163,184,0.28)",
    divider: "rgba(148,163,184,0.16)",
    accent: "#1f9a8a",
    accentSoft: "rgba(31,154,138,0.14)",
    warning: "#1d4ed8",
    success: "#22c55e",
    danger: "#ef4444",
    onAccent: "#ffffff",
    headerGlowA: "rgba(29,78,216,0.18)",
    headerGlowB: "rgba(31,154,138,0.12)",
    chipText: "#ffffff",
    logoutBg: "#0f172a",
  },
  light: {
    background: "#f4f6f9",
    surface: "#ffffff",
    surfaceAlt: "#eef2f6",
    text: "#0f172a",
    textMuted: "#475569",
    border: "rgba(15,23,42,0.12)",
    borderStrong: "rgba(15,23,42,0.2)",
    divider: "rgba(15,23,42,0.1)",
    accent: "#0f766e",
    accentSoft: "rgba(15,118,110,0.12)",
    warning: "#1e3a8a",
    success: "#15803d",
    danger: "#b91c1c",
    onAccent: "#ffffff",
    headerGlowA: "rgba(30,58,138,0.16)",
    headerGlowB: "rgba(15,118,110,0.12)",
    chipText: "#ffffff",
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
  const getSystemMode = (): ThemeMode =>
    Appearance.getColorScheme() === "light" ? "light" : "dark";

  const [mode, setModeState] = useState<ThemeMode>(getSystemMode());
  const [followSystem, setFollowSystem] = useState(true);

  useEffect(() => {
    if (!followSystem) return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setModeState(colorScheme === "light" ? "light" : "dark");
    });
    return () => {
      if (typeof sub?.remove === "function") sub.remove();
    };
  }, [followSystem]);

  const colors = useMemo(() => themes[mode], [mode]);
  const value = useMemo(
    () => ({
      mode,
      colors,
      setMode: (next: ThemeMode) => {
        setFollowSystem(false);
        setModeState(next);
      },
      toggleMode: () => {
        setFollowSystem(false);
        setModeState(mode === "dark" ? "light" : "dark");
      },
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
