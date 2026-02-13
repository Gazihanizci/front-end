import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type IzinDurum = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

type Props = {
  status: IzinDurum;
  onRequest?: () => void;
  onRetryFetch?: () => void;
  loading?: boolean;
};

const statusMeta: Record<IzinDurum, { title: string; subtitle: string; color: string }> = {
  NONE: {
    title: "İzin Gerekli",
    subtitle: "Aile cüzdanını görüntülemek için izin almalısın.",
    color: "#facc15",
  },
  PENDING: {
    title: "İzin Bekleniyor",
    subtitle: "Talebin aile sahibine iletildi. Onay bekleniyor.",
    color: "#38bdf8",
  },
  APPROVED: {
    title: "İzin Onaylandı",
    subtitle: "Aile cüzdanını görüntüleyebilirsin.",
    color: "#22c55e",
  },
  REJECTED: {
    title: "İzin Reddedildi",
    subtitle: "Talebin reddedildi. Tekrar isteyebilirsin.",
    color: "#fb7185",
  },
};

export default function IzinDurumCard({ status, onRequest, onRetryFetch, loading }: Props) {
  const meta = statusMeta[status];

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  badgeText: { color: "#0b0f1a", fontSize: 11, fontWeight: "900" },
  title: { color: "#e5e7eb", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  subtitle: { color: "#94a3b8", fontSize: 12, fontWeight: "700", marginBottom: 12 },
  primaryBtn: {
    backgroundColor: "#facc15",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#0b0f1a", fontSize: 14, fontWeight: "900" },
  ghostBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  ghostBtnText: { color: "#e5e7eb", fontSize: 13, fontWeight: "800" },
});
