import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

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

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#0b0f1a",
    overflow: "hidden",
  },
  bgGlowA: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(250,204,21,0.14)",
    top: -120,
    right: -80,
  },
  bgGlowB: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(56,189,248,0.12)",
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
    color: "#e5e7eb",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  bottomLine: {
    marginTop: 10,
    height: 1,
    backgroundColor: "rgba(148,163,184,0.12)",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  actionSolid: {
    backgroundColor: "#facc15",
    borderColor: "#facc15",
  },
  actionIcon: { marginTop: 1 },
  actionText: { color: "#e5e7eb", fontSize: 12, fontWeight: "800" },
  actionTextSolid: { color: "#0b0f1a" },
});
