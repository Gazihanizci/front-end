import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import api from "../config/api";
import IzinTalepCard from "../components/IzinTalepCard";
import { ThemeColors, useTheme } from "../theme/theme";
import { approveRequest, getPendingRequests, rejectRequest } from "../services/familyNotePermissionService";

type Props = NativeStackScreenProps<RootStackParamList, "Bildirimler">;

export default function BildirimlerScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [notePermItems, setNotePermItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteBusyId, setNoteBusyId] = useState<number | null>(null);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cuzdanRes, noteRes] = await Promise.all([
        api.get("/api/ailecuzdani/izin/inbox"),
        getPendingRequests(),
      ]);
      const arr = Array.isArray(cuzdanRes.data) ? cuzdanRes.data : [];
      setItems(arr);
      setNotePermItems(noteRes || []);
    } catch (err: any) {
      const status = err?.response?.status;
      console.log("Bildirim inbox hata:", err?.response?.data || err?.message);
      if (status === 401 || status === 403) {
        setError("Herhangi bir bildirim bulunamadı.");
      } else {
        setError("Bildirimler yüklenemedi.");
      }
      setItems([]);
      setNotePermItems([]);
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

  const onApproveNotePerm = useCallback(
    async (id?: number) => {
      if (!id) return;
      setNoteBusyId(id);
      try {
        await approveRequest(id);
        setNotePermItems((prev) => prev.filter((x: any) => Number(x.id ?? x.talepId) !== id));
      } catch (err: any) {
        console.log("Note izin approve hata:", err?.response?.data || err?.message);
        setError("Onay işlemi başarısız.");
      } finally {
        setNoteBusyId(null);
      }
    },
    []
  );

  const onRejectNotePerm = useCallback(
    async (id?: number) => {
      if (!id) return;
      setNoteBusyId(id);
      try {
        await rejectRequest(id);
        setNotePermItems((prev) => prev.filter((x: any) => Number(x.id ?? x.talepId) !== id));
      } catch (err: any) {
        console.log("Note izin reject hata:", err?.response?.data || err?.message);
        setError("Red işlemi başarısız.");
      } finally {
        setNoteBusyId(null);
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

  const normalizedNotePerms = useMemo(() => {
    return (notePermItems || []).map((x: any) => ({
      id: Number(x.id ?? x.talepId),
      requesterUserId: Number(x.requesterUserId ?? x.kullaniciId ?? 0),
      createdAt: String(x.createdAt ?? x.tarih ?? ""),
    }));
  }, [notePermItems]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="İzin Talepleri"
        subtitle="Güncel taleper"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
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
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>İzin Talepleri</Text>
          {!loading && !error && (normalized.length + normalizedNotePerms.length) > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{normalized.length + normalizedNotePerms.length}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.warning} />
            <Text style={styles.muted}>Yükleniyor...</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : normalized.length === 0 && normalizedNotePerms.length === 0 ? (
          <Text style={styles.muted}>Bekleyen bildirim yok.</Text>
        ) : (
          <>
            {normalized.length > 0 ? (
              <>
                <Text style={styles.sectionTitleSmall}>Aile Cüzdanı Talepleri</Text>
                {normalized.map((item) => (
                  <IzinTalepCard
                    key={`cuzdan-${item.talepId}`}
                    adSoyad={item.adSoyad}
                    createdAt={item.createdAt}
                    aciklama={item.aciklama}
                    sourceLabel="Aile Cüzdanı"
                    onApprove={() => onApprove(item.talepId)}
                    onReject={() => onReject(item.talepId)}
                    loading={busyId === item.talepId}
                  />
                ))}
              </>
            ) : null}

            {normalizedNotePerms.length > 0 ? (
              <>
                <Text style={styles.sectionTitleSmall}>Aile Not İzin Talepleri</Text>
                {normalizedNotePerms.map((item) => (
                  <IzinTalepCard
                    key={`note-${item.id}`}
                    adSoyad={`Kullanıcı ID: ${item.requesterUserId}`}
                    createdAt={item.createdAt}
                    sourceLabel="Aile Not İzni"
                    onApprove={() => onApproveNotePerm(item.id)}
                    onReject={() => onRejectNotePerm(item.id)}
                    loading={noteBusyId === item.id}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16 },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
    sectionTitleSmall: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginTop: 6, marginBottom: 8 },
    countBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      backgroundColor: colors.warning,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    countBadgeText: { color: colors.onAccent, fontSize: 11, fontWeight: "900" },
    center: { alignItems: "center", paddingVertical: 16, gap: 8 },
    muted: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  });


