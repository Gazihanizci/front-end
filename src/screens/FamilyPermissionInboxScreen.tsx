import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import IzinTalepCard from "../components/IzinTalepCard";
import { ThemeColors, useTheme } from "../theme/theme";
import { approve, getInbox, PermissionInboxItem, reject } from "../services/familyPermissionApi";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyPermissionInbox">;

export default function FamilyPermissionInboxScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PermissionInboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const arr = await getInbox();
      setItems(arr);
    } catch (err: any) {
      console.log("İzin inbox hata:", err?.response?.data || err?.message);
      setError("İzin talepleri yüklenemedi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchInbox();
    } finally {
      setRefreshing(false);
    }
  }, [fetchInbox]);

  const onApprove = useCallback(
    async (permissionId: number) => {
      setBusyId(permissionId);
      setError(null);
      try {
        await approve(permissionId);
        await fetchInbox();
      } catch (err: any) {
        console.log("Approve hata:", err?.response?.data || err?.message);
        setError("Onay işlemi başarısız.");
      } finally {
        setBusyId(null);
      }
    },
    [fetchInbox]
  );

  const onReject = useCallback(
    async (permissionId: number) => {
      setBusyId(permissionId);
      setError(null);
      try {
        await reject(permissionId);
        await fetchInbox();
      } catch (err: any) {
        console.log("Reject hata:", err?.response?.data || err?.message);
        setError("Red işlemi başarısız.");
      } finally {
        setBusyId(null);
      }
    },
    [fetchInbox]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="İzin Talepleri"
        subtitle="Aile cüzdanı izinleri"
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

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />
        }
      >
        <Text style={styles.sectionTitle}>Bekleyen Talepler</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.warning} />
            <Text style={styles.muted}>Yükleniyor...</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.muted}>Bekleyen izin talebi yok.</Text>
        ) : (
          items.map((item) => (
            <IzinTalepCard
              key={String(item.id)}
              adSoyad={item.adSoyad}
              createdAt={item.createdAt}
              aciklama=""
              onApprove={() => onApprove(item.id)}
              onReject={() => onReject(item.id)}
              loading={busyId === item.id}
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
