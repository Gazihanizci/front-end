import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = {
  adSoyad: string;
  createdAt?: string;
  aciklama?: string;
  sourceLabel?: string;
  onApprove?: () => void;
  onReject?: () => void;
  loading?: boolean;
};

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

export default function IzinTalepCard({
  adSoyad,
  createdAt,
  aciklama,
  sourceLabel,
  onApprove,
  onReject,
  loading,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{adSoyad || "Üye"}</Text>
      <Text style={styles.meta}>Tarih: {formatDate(createdAt)}</Text>
      {sourceLabel ? <Text style={styles.meta}>Kaynak: {sourceLabel}</Text> : null}
      {aciklama ? <Text style={styles.meta}>Açıklama: {aciklama}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.approveBtn} activeOpacity={0.85} onPress={onApprove} disabled={loading}>
          <Text style={styles.approveText}>{loading ? "İşleniyor..." : "Onayla"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.85} onPress={onReject} disabled={loading}>
          <Text style={styles.rejectText}>Reddet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    title: { color: colors.text, fontSize: 15, fontWeight: "900", marginBottom: 6 },
    meta: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
    actions: { flexDirection: "row", gap: 10, marginTop: 10 },
    approveBtn: {
      flex: 1,
      backgroundColor: colors.warning,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    approveText: { color: colors.onAccent, fontSize: 13, fontWeight: "900" },
    rejectBtn: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.danger,
    },
    rejectText: { color: colors.danger, fontSize: 13, fontWeight: "900" },
  });
