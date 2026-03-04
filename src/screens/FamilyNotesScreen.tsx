import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, ThemeMode, useTheme } from "../theme/theme";
import api from "../config/api";
import MessageBox from "../components/MessageBox";
import { requestPermission } from "../services/familyNotePermissionService";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyNotes">;

type NoteType = "USER" | "FAMILY";
type NotResponse = {
  notId: number;
  notMetini: string;
  createdAt: string;
  notTuru: NoteType;
  aileId: number | null;
};

export default function FamilyNotesScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  const [items, setItems] = useState<NotResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<NotResponse | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const [msgVisible, setMsgVisible] = useState(false);
  const [msgTitle, setMsgTitle] = useState("");
  const [msgMessage, setMsgMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  const [permissionVisible, setPermissionVisible] = useState(false);
  const [requestingPerm, setRequestingPerm] = useState(false);

  const showMessage = useCallback(
    (title: string, message: string, type: "success" | "error" | "info" = "info") => {
      setMsgTitle(title);
      setMsgMessage(message);
      setMsgType(type);
      setMsgVisible(true);
    },
    []
  );

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/notlar/aile");
      const data = Array.isArray(res.data) ? (res.data as NotResponse[]) : [];
      setItems(data.filter((x) => x.notTuru === "FAMILY"));
    } catch (err: any) {
      console.log("Aile notları hata:", err?.response?.data || err?.message);
      setError("Notlar yüklenemedi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNotes();
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotes]);

  const openCreate = () => {
    setEditingNote(null);
    setNoteText("");
    setModalVisible(true);
  };

  const openEdit = (note: NotResponse) => {
    setEditingNote(note);
    setNoteText(note.notMetini);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingNote(null);
    setNoteText("");
  };

  const saveNote = async () => {
    if (saving) return;
    const text = noteText.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      if (editingNote) {
        await api.put(`/api/notlar/aile/${editingNote.notId}`, {
          notMetini: text,
          notTuru: "FAMILY",
        });
      } else {
        await api.post("/api/notlar", { notMetini: text, notTuru: "FAMILY" });
      }
      closeModal();
      await fetchNotes();
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = String(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.response?.data ||
          err?.message ||
          ""
      );
      const noPermission = apiMsg.toLowerCase().includes("izin") && apiMsg.toLowerCase().includes("not");
      if (status === 401 || status === 403 || noPermission) {
        setPermissionVisible(true);
      } else if (status >= 500) {
        showMessage("Hata", "Sunucu hatası oluştu.", "error");
      } else {
        showMessage("Hata", "Not kaydedilemedi.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (note: NotResponse) => {
    try {
      await api.delete(`/api/notlar/aile/${note.notId}`);
      setItems((prev) => prev.filter((x) => x.notId !== note.notId));
    } catch (err: any) {
      console.log("Not silme hata:", err?.response?.data || err?.message);
      showMessage("Hata", "Not silinemedi.", "error");
    }
  };

  const requestPermissionNow = async () => {
    if (requestingPerm) return;
    setRequestingPerm(true);
    try {
      await requestPermission();
      setPermissionVisible(false);
      showMessage("Başarılı", "Permission request sent to family admin.", "success");
    } catch (err: any) {
      showMessage("Hata", "İzin isteği gönderilemedi.", "error");
    } finally {
      setRequestingPerm(false);
    }
  };

  const renderItem = ({ item }: { item: NotResponse }) => {
    const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
    return (
      <View style={styles.noteCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.noteText} numberOfLines={3}>
            {item.notMetini}
          </Text>
          <View style={styles.noteMetaRow}>
            <View style={[styles.noteBadge, styles.badgeFamily]}>
              <Text style={styles.noteBadgeText}>Aile</Text>
            </View>
            <Text style={styles.noteDate}>{created}</Text>
          </View>
        </View>
        <View style={styles.noteActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={18} color={colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => deleteNote(item)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Aile Notları"
        subtitle="Aile notlarını yönet"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
        right={<HeaderAction label="Yeni" onPress={openCreate} />}
      />

      <FlatList
        data={items}
        keyExtractor={(x) => String(x.notId)}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />}
        ListHeaderComponent={<View style={{ height: 6 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.muted}>Yükleniyor...</Text>
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Text style={styles.muted}>Henüz aile notu yok.</Text>
          )
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingNote ? "Not Düzenle" : "Yeni Aile Notu"}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Notunu yaz..."
                placeholderTextColor={colors.textMuted}
                value={noteText}
                onChangeText={setNoteText}
                multiline
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={saveNote}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryBtnText}>Kaydet</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MessageBox
        visible={permissionVisible}
        title="Yetki Yok"
        message="You don't have permission to write family notes. Request permission?"
        type="info"
        onClose={() => setPermissionVisible(false)}
        onCancel={() => setPermissionVisible(false)}
        onConfirm={requestPermissionNow}
        confirmText={requestingPerm ? "Gönderiliyor..." : "Request Permission"}
        cancelText="Vazgeç"
      />

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

const createStyles = (colors: ThemeColors, mode: ThemeMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
    noteCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    noteText: { color: colors.text, fontSize: 14, fontWeight: "700" },
    noteMetaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
    noteDate: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    noteBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
    },
    noteBadgeText: { color: colors.text, fontSize: 10, fontWeight: "900" },
    badgeFamily: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
    noteActions: { flexDirection: "row", gap: 8 },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    center: { alignItems: "center", paddingVertical: 20, gap: 8 },
    muted: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "800", marginTop: 8 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: mode === "light" ? "rgba(15,23,42,0.35)" : "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      height: "70%",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
    inputContainer: { flex: 1, marginBottom: 10 },
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      padding: 14,
      borderRadius: 12,
      flex: 1,
      minHeight: 140,
    },
    primaryBtn: {
      backgroundColor: colors.warning,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 4,
    },
    primaryBtnText: { color: colors.onAccent, fontWeight: "900" },
    cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
    cancelText: { color: colors.textMuted, fontWeight: "800" },
  });
