import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";
import MessageBox from "../components/MessageBox";
import { getMyRequests, type PermissionRequestItem } from "../services/familyNotePermissionService";

type Props = NativeStackScreenProps<RootStackParamList, "MyFamilyNoteRequests">;

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("tr-TR");
};

const statusLabel = (s?: string) => {
  if (s === "APPROVED") return "Onaylandı";
  if (s === "REJECTED") return "Reddedildi";
  return "Bekliyor";
};

export default function MyFamilyNoteRequestsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<PermissionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
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
      const list = await getMyRequests();
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

  const statusStyle = (status?: string) => {
    if (status === "APPROVED") return styles.badgeApproved;
    if (status === "REJECTED") return styles.badgeRejected;
    return styles.badgePending;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="İzin Taleplerim"
        subtitle="Aile notu izinleri"
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
          <Text style={styles.muted}>Herhangi bir talep yok.</Text>
        ) : (
          items.map((item) => (
            <View key={String(item.id)} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>Talep #{item.id}</Text>
                <View style={[styles.badge, statusStyle(item.status)]}>
                  <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.meta}>Tarih: {formatDate(item.createdAt)}</Text>
              <Text style={styles.meta}>Kullanıcı ID: {item.requesterUserId}</Text>
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
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    title: { color: colors.text, fontSize: 15, fontWeight: "900" },
    meta: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgePending: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    badgeApproved: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    badgeRejected: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    badgeText: { color: colors.onAccent, fontSize: 11, fontWeight: "900" },
  });

