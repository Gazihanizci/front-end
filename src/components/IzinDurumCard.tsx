import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ThemeColors, useTheme } from "../theme/theme";

export type IzinDurum = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

type Props = {
  status: IzinDurum;
  onRequest?: () => void;
  onRetryFetch?: () => void;
  loading?: boolean;
};

export default function IzinDurumCard({ status, onRequest, onRetryFetch, loading }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const meta = useMemo(
    () =>
      ({
        NONE: {
          title: "İzin Gerekli",
          subtitle: "Aile cüzdanını görüntülemek için izin almalısın.",
          color: colors.warning,
        },
        PENDING: {
          title: "İzin Bekleniyor",
          subtitle: "Talebin aile sahibine iletildi. Onay bekleniyor.",
          color: colors.accent,
        },
        APPROVED: {
          title: "İzin Onaylandı",
          subtitle: "Aile cüzdanını görüntüleyebilirsin.",
          color: colors.success,
        },
        REJECTED: {
          title: "İzin Reddedildi",
          subtitle: "Talebin reddedildi. Tekrar isteyebilirsin.",
          color: colors.danger,
        },
      })[status],
    [colors, status]
  );

  return (
    <View style={styles.card}>
      <View style={[styles.badge, { backgroundColor: meta.color }]}>
        <Text style={styles.badgeText}>{status}</Text>
      </View>
      <Text style={styles.title}>{meta.title}</Text>
      <Text style={styles.subtitle}>{meta.subtitle}</Text>

      {status === "NONE" || status === "REJECTED" ? (
        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onRequest} disabled={loading}>
          <Text style={styles.primaryBtnText}>{loading ? "Gönderiliyor..." : "İzin İste"}</Text>
        </TouchableOpacity>
      ) : null}

      {status === "PENDING" ? (
        <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.85} onPress={onRetryFetch} disabled={loading}>
          <Text style={styles.ghostBtnText}>{loading ? "Kontrol ediliyor..." : "Durumu Yenile"}</Text>
        </TouchableOpacity>
      ) : null}
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
    },
    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      marginBottom: 10,
    },
    badgeText: { color: colors.onAccent, fontSize: 11, fontWeight: "900" },
    title: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 6 },
    subtitle: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 12 },
    primaryBtn: {
      backgroundColor: colors.warning,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.onAccent, fontSize: 14, fontWeight: "900" },
    ghostBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    ghostBtnText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  });
