import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import api from "../config/api";
import IzinTalepCard from "../components/IzinTalepCard";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Bildirimler">;

export default function BildirimlerScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/ailecuzdani/izin/inbox");
      const arr = Array.isArray(res.data) ? res.data : [];
      setItems(arr);
    } catch (err: any) {
      console.log("Bildirim inbox hata:", err?.response?.data || err?.message);
      setError("Bildirimler yüklenemedi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const onApprove = useCallback(
    async (talepId?: number) => {
      if (!talepId) return;
      setBusyId(talepId);
      try {
        await api.post(`/api/ailecuzdani/izin/${talepId}/approve`, null);
        setItems((prev) => prev.filter((x: any) => Number(x.talepId ?? x.id) !== talepId));
      } catch (err: any) {
        console.log("Approve hata:", err?.response?.data || err?.message);
        setError("Onay işlemi başarısız.");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const onReject = useCallback(
    async (talepId?: number) => {
      if (!talepId) return;
      setBusyId(talepId);
      try {
        await api.post(`/api/ailecuzdani/izin/${talepId}/reject`, null);
        setItems((prev) => prev.filter((x: any) => Number(x.talepId ?? x.id) !== talepId));
      } catch (err: any) {
        console.log("Reject hata:", err?.response?.data || err?.message);
        setError("Red işlemi başarısız.");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const normalized = useMemo(() => {
    return (items || []).map((x: any) => ({
      talepId: Number(x.talepId ?? x.id),
      adSoyad: String(x.adSoyad ?? x.kullaniciAdSoyad ?? x.ad ?? "Üye"),
      createdAt: String(x.createdAt ?? x.tarih ?? ""),
      aciklama: String(x.aciklama ?? ""),
    }));
  }, [items]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Bildirimler"
        subtitle="Güncel bildirimler"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <HeaderAction
            icon={<Ionicons name="refresh" size={16} color={colors.text} />}
            onPress={fetchInbox}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>İzin Talepleri</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.warning} />
            <Text style={styles.muted}>Yükleniyor...</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : normalized.length === 0 ? (
          <Text style={styles.muted}>Bekleyen izin talebi yok.</Text>
        ) : (
          normalized.map((item) => (
            <IzinTalepCard
              key={String(item.talepId)}
              adSoyad={item.adSoyad}
              createdAt={item.createdAt}
              aciklama={item.aciklama}
              onApprove={() => onApprove(item.talepId)}
              onReject={() => onReject(item.talepId)}
              loading={busyId === item.talepId}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16 },
    sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "900", marginBottom: 10 },
    center: { alignItems: "center", paddingVertical: 16, gap: 8 },
    muted: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  });
