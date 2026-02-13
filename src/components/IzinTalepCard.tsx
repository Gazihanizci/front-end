import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  adSoyad: string;
  createdAt?: string;
  aciklama?: string;
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

export default function IzinTalepCard({ adSoyad, createdAt, aciklama, onApprove, onReject, loading }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{adSoyad || "Üye"}</Text>
      <Text style={styles.meta}>Tarih: {formatDate(createdAt)}</Text>
      <Text style={styles.meta}>Açıklama: {aciklama || "-"}</Text>

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    marginBottom: 12,
  },
  title: { color: "#e5e7eb", fontSize: 15, fontWeight: "900", marginBottom: 6 },
  meta: { color: "#94a3b8", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  approveBtn: {
    flex: 1,
    backgroundColor: "#facc15",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  approveText: { color: "#0b0f1a", fontSize: 13, fontWeight: "900" },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#1f2933",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.6)",
  },
  rejectText: { color: "#fb7185", fontSize: 13, fontWeight: "900" },
});
