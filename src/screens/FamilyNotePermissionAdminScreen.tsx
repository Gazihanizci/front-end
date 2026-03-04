import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";
import MessageBox from "../components/MessageBox";
import {
  approveRequest,
  getPendingRequests,
  rejectRequest,
  type PermissionRequestItem,
} from "../services/familyNotePermissionService";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyNotePermissionAdmin">;

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("tr-TR");
};

export default function FamilyNotePermissionAdminScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<PermissionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msgVisible, setMsgVisible] = useState(false);
  const [msgTitle, setMsgTitle] = useState("");
  const [msgMessage, setMsgMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  const showMessage = useCallback(
    (title: string, message: string, type: "success" | "error" | "info" = "info") => {
      setMsgTitle(title);
      setMsgMessage(message);
      setMsgType(type);
      setMsgVisible(true);
    },
    []
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPendingRequests();
      setItems(list || []);
    } catch (err: any) {
      showMessage("Hata", "İstekler yüklenemedi.", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const onApprove = useCallback(
    async (id: number) => {
      if (busyId != null) return;
      setBusyId(id);
      try {
        await approveRequest(id);
        await fetchList();
      } catch (err: any) {
        showMessage("Hata", "Onay işlemi başarısız.", "error");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, fetchList, showMessage]
  );

  const onReject = useCallback(
    async (id: number) => {
      if (busyId != null) return;
      setBusyId(id);
      try {
        await rejectRequest(id);
        await fetchList();
      } catch (err: any) {
        showMessage("Hata", "Red işlemi başarısız.", "error");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, fetchList, showMessage]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Aile Not İzinleri"
        subtitle="Bekleyen talepler"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
        right={<HeaderAction icon={<Ionicons name="refresh" size={16} color={colors.text} />} onPress={fetchList} />}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.warning} />
            <Text style={styles.muted}>Yükleniyor...</Text>
          </View>
        ) : items.length === 0 ? (
          <Text style={styles.muted}>Bekleyen talep yok.</Text>
        ) : (
          items.map((item) => (
            <View key={String(item.id)} style={styles.card}>
              <Text style={styles.title}>Kullanıcı ID: {item.requesterUserId}</Text>
              <Text style={styles.meta}>Tarih: {formatDate(item.createdAt)}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.approveBtn, busyId === item.id && { opacity: 0.6 }]}
                  onPress={() => onApprove(item.id)}
                  activeOpacity={0.85}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <Text style={styles.approveText}>Onayla</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, busyId === item.id && { opacity: 0.6 }]}
                  onPress={() => onReject(item.id)}
                  activeOpacity={0.85}
                  disabled={busyId === item.id}
                >
                  <Text style={styles.rejectText}>Reddet</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <MessageBox
        visible={msgVisible}
        title={msgTitle}
        message={msgMessage}
        type={msgType}
        onClose={() => setMsgVisible(false)}
        confirmText="Tamam"
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16 },
    center: { alignItems: "center", paddingVertical: 16, gap: 8 },
    muted: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    title: { color: colors.text, fontSize: 15, fontWeight: "900", marginBottom: 6 },
    meta: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 10 },
    actions: { flexDirection: "row", gap: 10 },
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

