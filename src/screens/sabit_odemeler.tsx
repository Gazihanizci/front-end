import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import api from "../config/api";
import MessageBox from "../components/MessageBox";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "SabitOdemeler">;

export default function SabitOdemelerScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    odemeAdi: "",
    sonOdemeGunu: "",
    aktif: true,
    aciklama: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateValue, setDateValue] = useState<Date | null>(null);

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

  const isValidDateYYYYMMDD = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00`);
    return !Number.isNaN(d.getTime());
  };

  const formatDate = useCallback((d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const onPickDate = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (event.type === "dismissed") return;
      const picked = selectedDate ?? dateValue ?? new Date();
      setDateValue(picked);
      setForm((p) => ({ ...p, sonOdemeGunu: formatDate(picked) }));
    },
    [dateValue, formatDate]
  );

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.get("/api/sabitodemeler");
      const arr = Array.isArray(res.data) ? res.data : [];
      setItems(arr);
    } catch (err: any) {
      console.log("Sabit ödeme listeleme hata:", err?.response?.data || err?.message);
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const onCreate = useCallback(async () => {
    if (saving) return;

    const odemeAdi = form.odemeAdi.trim();
    if (!odemeAdi) {
      showMessage("Eksik Bilgi", "Ödeme adı zorunludur.", "error");
      return;
    }

    const sonOdemeGunu = form.sonOdemeGunu.trim();
    if (!sonOdemeGunu || !isValidDateYYYYMMDD(sonOdemeGunu)) {
      showMessage("Eksik Bilgi", "Son ödeme günü YYYY-MM-DD formatında olmalı.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        odemeAdi,
        sonOdemeGunu,
        aktif: Boolean(form.aktif),
        aciklama: form.aciklama?.trim() || null,
      };

      await api.post("/api/sabitodemeler", payload);

      setForm({
        odemeAdi: "",
        sonOdemeGunu: "",
        aktif: true,
        aciklama: "",
      });

      await fetchList();
      showMessage("Başarılı", "Sabit ödeme kaydı oluşturuldu.", "success");
    } catch (err: any) {
      console.log("Sabit ödeme create hata:", err?.response?.data || err?.message);
      showMessage("Hata", "Sabit ödeme kaydı oluşturulamadı.", "error");
    } finally {
      setSaving(false);
    }
  }, [form, saving, showMessage, fetchList]);

  const normalizedItems = useMemo(() => {
    return (items || []).map((x: any) => ({
      odemeId: x.odemeId ?? x.id,
      odemeAdi: String(x.odemeAdi ?? x.ad ?? "").trim() || "Sabit Ödeme",
      sonOdemeGunu: String(x.sonOdemeGunu ?? "").slice(0, 10),
      aktif: Boolean(x.aktif),
      aciklama: String(x.aciklama ?? ""),
    }));
  }, [items]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Sabit Odemeler"
        subtitle="Duzenli odeme listesi"
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
            onPress={fetchList}
          />
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Yeni Sabit Ödeme</Text>

            <Text style={styles.label}>Ödeme Adı</Text>
            <TextInput
              style={styles.input}
              value={form.odemeAdi}
              onChangeText={(v) => setForm((p) => ({ ...p, odemeAdi: v }))}
              placeholder="Örn: İnternet Faturası"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Son Ödeme Günü</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.input, styles.dateInput]} activeOpacity={0.85} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.inputText}>
                  {form.sonOdemeGunu ? form.sonOdemeGunu : "Tarih seçiniz"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.activeToggle, form.aktif ? styles.activeOn : styles.activeOff]}
                activeOpacity={0.85}
                onPress={() => setForm((p) => ({ ...p, aktif: !p.aktif }))}
              >
                <Text style={[styles.activeText, form.aktif ? styles.activeTextOn : styles.activeTextOff]}>
                  {form.aktif ? "Açık" : "Kapalı"}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={dateValue ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onPickDate}
              />
            )}

            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.aciklama}
              onChangeText={(v) => setForm((p) => ({ ...p, aciklama: v }))}
              placeholder="Opsiyonel"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={onCreate} disabled={saving}>
              {saving ? (
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <ActivityIndicator color={colors.onAccent} />
                  <Text style={styles.saveButtonText}>Kaydediliyor...</Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>Sabit Ödeme Ekle</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Kayıtlar</Text>
          {loadingList ? (
            <View style={{ paddingVertical: 14, alignItems: "center" }}>
              <ActivityIndicator color={colors.warning} />
              <Text style={{ color: colors.textMuted, marginTop: 8, fontWeight: "700" }}>Yükleniyor...</Text>
            </View>
          ) : normalizedItems.length === 0 ? (
            <Text style={styles.emptyText}>Henüz kayıt yok.</Text>
          ) : (
            normalizedItems.map((item) => (
              <View key={String(item.odemeId ?? item.odemeAdi)} style={styles.card}>
                <View style={styles.listHeader}>
                  <Text style={styles.cardTitle}>{item.odemeAdi}</Text>
                  <View style={[styles.badge, item.aktif ? styles.badgeActive : styles.badgeMuted]}>
                    <Text style={styles.badgeText}>{item.aktif ? "Açık" : "Kapalı"}</Text>
                  </View>
                </View>

                <View style={styles.rowStack}>
                  <Text style={styles.label}>Son Ödeme Günü</Text>
                  <Text style={styles.value}>{item.sonOdemeGunu || "-"}</Text>
                </View>

                <View style={styles.rowStack}>
                  <Text style={styles.label}>Açıklama</Text>
                  <Text style={styles.value}>{item.aciklama || "-"}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <MessageBox
        visible={msgVisible}
        title={msgTitle}
        message={msgMessage}
        type={msgType}
        onClose={() => setMsgVisible(false)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 6 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "900", marginBottom: 8 },
  emptyText: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  rowStack: { marginBottom: 10 },
  value: { color: colors.text, fontSize: 14, fontWeight: "800" },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    marginBottom: 12,
  },
  dateInput: { flex: 1 },
  inputText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  activeToggle: {
    minWidth: 86,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  activeOn: {
    backgroundColor: colors.warning,
    borderColor: "rgba(250,204,21,0.55)",
  },
  activeOff: {
    backgroundColor: colors.surfaceAlt,
    borderColor: "rgba(148,163,184,0.35)",
  },
  activeText: { fontSize: 12, fontWeight: "900" },
  activeTextOn: { color: colors.onAccent },
  activeTextOff: { color: colors.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: colors.warning,
    borderColor: "rgba(250,204,21,0.55)",
  },
  badgeMuted: {
    backgroundColor: colors.textMuted,
    borderColor: "rgba(148,163,184,0.55)",
  },
  badgeText: { fontSize: 12, fontWeight: "900", color: colors.onAccent },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  saveButton: {
    marginTop: 4,
    backgroundColor: colors.warning,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: "900" },
});


