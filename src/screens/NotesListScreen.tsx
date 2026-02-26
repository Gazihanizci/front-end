import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Props = NativeStackScreenProps<RootStackParamList, "Notlar">;
type NoteType = "USER" | "FAMILY";
type NotResponse = {
  notId: number;
  notMetini: string;
  createdAt: string;
  notTuru: NoteType;
  aileId: number | null;
};

export default function NotesListScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  const [items, setItems] = useState<NotResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NoteType>("USER");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<NotResponse | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("USER");
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async (type: NoteType) => {
    setLoading(true);
    setError(null);
    try {
      const url = type === "USER" ? "/api/notlar" : "/api/notlar/aile";
      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data as NotResponse[]);
    } catch (err: any) {
      console.log("Notlar listesi hata:", err?.response?.data || err?.message);
      setError("Notlar yüklenemedi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes(activeTab);
  }, [fetchNotes, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNotes(activeTab);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotes, activeTab]);

  const openCreate = () => {
    setEditingNote(null);
    setNoteText("");
    setNoteType(activeTab);
    setModalVisible(true);
  };

  const openEdit = (note: NotResponse) => {
    setEditingNote(note);
    setNoteText(note.notMetini);
    setNoteType(note.notTuru);
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
        const url =
          editingNote.notTuru === "FAMILY"
            ? `/api/notlar/aile/${editingNote.notId}`
            : `/api/notlar/${editingNote.notId}`;
        await api.put(url, { notMetini: text, notTuru: editingNote.notTuru });
      } else {
        await api.post("/api/notlar", { notMetini: text, notTuru: noteType });
      }
      closeModal();
      await fetchNotes(activeTab);
    } catch (err: any) {
      console.log("Not kaydetme hata:", err?.response?.data || err?.message);
      setError("Not kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (note: NotResponse) => {
    Alert.alert("Notu Sil", "Silmek istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            const url =
              note.notTuru === "FAMILY" ? `/api/notlar/aile/${note.notId}` : `/api/notlar/${note.notId}`;
            await api.delete(url);
            setItems((prev) => prev.filter((x) => x.notId !== note.notId));
          } catch (err: any) {
            console.log("Not silme hata:", err?.response?.data || err?.message);
            setError("Not silinemedi.");
          }
        },
      },
    ]);
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
            <View style={[styles.noteBadge, item.notTuru === "FAMILY" ? styles.badgeFamily : styles.badgeUser]}>
              <Text style={styles.noteBadgeText}>{item.notTuru === "FAMILY" ? "Aile" : "Kişisel"}</Text>
            </View>
            <Text style={styles.noteDate}>{created}</Text>
          </View>
        </View>
        <View style={styles.noteActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={18} color={colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => confirmDelete(item)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notlar"
        subtitle="Kısa notlarını sakla"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
        right={null}
      />

      <FlatList
        data={items}
        keyExtractor={(x) => String(x.notId)}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <View style={styles.tabRow}>
              {(["USER", "FAMILY"] as NoteType[]).map((t) => {
                const active = activeTab === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    onPress={() => setActiveTab(t)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {t === "USER" ? "Kişisel Notlar" : "Aile Notları"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.newBtn} onPress={openCreate} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color={colors.onAccent} />
              <Text style={styles.newBtnText}>Yeni Not</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.muted}>Yükleniyor...</Text>
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Text style={styles.muted}>Henüz not yok.</Text>
          )
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingNote ? "Not Düzenle" : "Yeni Not"}</Text>
            <TextInput
              style={styles.input}
              placeholder="Notunu yaz..."
              placeholderTextColor={colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
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
    </View>
  );
}

const createStyles = (colors: ThemeColors, mode: ThemeMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 14 },
    listContent: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
    headerRow: { marginBottom: 6, gap: 10 },
    tabRow: { flexDirection: "row", gap: 8 },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
    },
    tabBtnActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    tabText: { color: colors.text, fontWeight: "800", fontSize: 12 },
    tabTextActive: { color: colors.onAccent },
    newBtn: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.warning,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    newBtnText: { color: colors.onAccent, fontWeight: "900", fontSize: 13 },
    noteCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
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
    badgeUser: {},
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
      height: "55%",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      padding: 14,
      borderRadius: 12,
      marginBottom: 10,
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
