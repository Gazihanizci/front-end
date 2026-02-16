import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ThemeColors, useTheme } from "../theme/theme";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
};

type HeaderActionProps = {
  label?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  variant?: "ghost" | "solid";
};

export function HeaderAction({ label, icon, onPress, variant = "ghost" }: HeaderActionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.action, variant === "solid" && styles.actionSolid]}
    >
      {icon ? <View style={styles.actionIcon}>{icon}</View> : null}
      {label ? (
        <Text style={[styles.actionText, variant === "solid" && styles.actionTextSolid]}>
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function ScreenHeader({ title, subtitle, left, right }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.bgGlowA} />
      <View style={styles.bgGlowB} />

      <View style={styles.row}>
        <View style={styles.sideLeft}>{left ?? <View style={styles.sideSpacer} />}</View>
        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.sideRight}>{right ?? <View style={styles.sideSpacer} />}</View>
      </View>

      <View style={styles.bottomLine} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    bgGlowA: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: colors.headerGlowA,
      top: -120,
      right: -80,
    },
    bgGlowB: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: colors.headerGlowB,
      bottom: -140,
      left: -100,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sideLeft: { minWidth: 72, alignItems: "flex-start" },
    sideRight: { minWidth: 72, alignItems: "flex-end" },
    sideSpacer: { width: 24, height: 24 },
    center: { flex: 1, alignItems: "center" },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    bottomLine: {
      marginTop: 10,
      height: 1,
      backgroundColor: colors.divider,
    },
    action: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    actionSolid: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    actionIcon: { marginTop: 1 },
    actionText: { color: colors.text, fontSize: 12, fontWeight: "800" },
    actionTextSolid: { color: colors.chipText },
  });
