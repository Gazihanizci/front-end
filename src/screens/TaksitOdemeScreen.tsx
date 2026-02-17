import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
import api from "../config/api";
import MessageBox from "../components/MessageBox";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "TaksitOdeme">;

// Backend response (TaksitResponse)
type TaksitApiItem = {
  taksitId?: number;
  id?: number;

  kullaniciId?: number;
  aileId?: number;

  taksitBasligi?: string;
  baslik?: string;

  tutar?: number | string;
  paraBirimi?: string;

  baslangicTarihi?: string; // "2026-02-10"
  baslamaTarihi?: string; // eski ad gelirse diye

  taksitSayisi?: number | string;
  bittiMi?: boolean;

  aciklama?: string;
  createdAt?: string;
};

// UI form
type FormState = {
  baslik: string;
  tutar: string; // monthly amount (backend expects monthly amount)
  paraBirimi: string;
  baslamaTarihi: string; // YYYY-MM-DD
  taksitSayisi: string;
  aylikTutar: string; // UI only (optional)
  aciklama: string;
};

const toNum = (v: any) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const formatTRY = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const isValidDateYYYYMMDD = (s: string) => {
  // Basit doğrulama: 2026-02-10
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime());
};

export default function TaksitOdemeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<TaksitApiItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateValue, setDateValue] = useState<Date | null>(null);
  const [msgVisible, setMsgVisible] = useState(false);
  const [msgTitle, setMsgTitle] = useState("");
  const [msgMessage, setMsgMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");
  const [finishingId, setFinishingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [cancelAction, setCancelAction] = useState<(() => void) | null>(null);
  const [confirmText, setConfirmText] = useState<string | undefined>(undefined);
  const [cancelText, setCancelText] = useState<string | undefined>(undefined);

  const [form, setForm] = useState<FormState>({
    baslik: "",
    tutar: "",
    paraBirimi: "TL",
    baslamaTarihi: "",
    taksitSayisi: "",
    aylikTutar: "",
    aciklama: "",
  });

  // UI'da yardımcı: Eğer kullanıcı toplam tutar yazıp "taksit sayısı" ile aylık hesaplamak istiyorsa
  // (Ama backend'e "tutar" olarak aylık tutar gidecek.)
  const computedAylik = useMemo(() => {
    const t = toNum(form.tutar);
    const n = toNum(form.taksitSayisi);
    if (!Number.isFinite(t) || !Number.isFinite(n) || n <= 0) return "";
    return String(Math.round((t / n) * 100) / 100);
  }, [form.tutar, form.taksitSayisi]);

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
      setForm((p) => ({ ...p, baslamaTarihi: formatDate(picked) }));
    },
    [dateValue, formatDate]
  );

  const showMessage = useCallback(
    (title: string, message: string, type: "success" | "error" | "info" = "info") => {
      setMsgTitle(title);
      setMsgMessage(message);
      setMsgType(type);
      setConfirmAction(null);
      setCancelAction(null);
      setConfirmText(undefined);
      setCancelText(undefined);
      setMsgVisible(true);
    },
    []
  );

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setMsgTitle(title);
      setMsgMessage(message);
      setMsgType("info");
      setConfirmText("Bitir");
      setCancelText("Vazgeç");
      setCancelAction(() => {
        setMsgVisible(false);
      });
      setConfirmAction(() => {
        setMsgVisible(false);
        onConfirm();
      });
      setMsgVisible(true);
    },
    []
  );

  const fetchMy = useCallback(async () => {
    setLoadingList(true);
    try {

      const res = await api.get("/api/taksitler/my");

      const arr = Array.isArray(res.data) ? res.data : [];
      setItems(arr);
    } catch (err: any) {
      console.log("Taksit listeleme hata:", err?.response?.data || err?.message);
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMy();
    } finally {
      setRefreshing(false);
    }
  }, [fetchMy]);

  useEffect(() => {
    fetchMy();
  }, [fetchMy]);

  const onCreate = useCallback(async () => {
    if (saving) return;

    const baslik = form.baslik.trim();
    if (!baslik) {
      showMessage("Eksik Bilgi", "Taksit başlığı zorunludur.", "error");
      return;
    }

    const taksitSayisiNum = Math.floor(toNum(form.taksitSayisi));
    if (!Number.isFinite(taksitSayisiNum) || taksitSayisiNum <= 0) {
      showMessage("Eksik Bilgi", "Taksit sayısı 1 veya daha büyük olmalı.", "error");
      return;
    }

    const dateStr = form.baslamaTarihi.trim();
    if (!dateStr || !isValidDateYYYYMMDD(dateStr)) {
      showMessage("Eksik Bilgi", "Başlama tarihi YYYY-MM-DD formatında olmalı.", "error");
      return;
    }

    const aylikTutarStr = (form.aylikTutar || "").trim() || computedAylik || form.tutar.trim();
    const aylikTutarNum = toNum(aylikTutarStr);
    if (!Number.isFinite(aylikTutarNum) || aylikTutarNum <= 0) {
      showMessage("Eksik Bilgi", "Aylık tutar 0'dan büyük olmalı.", "error");
      return;
    }

    setSaving(true);
    try {

      const payload = {
        taksitBasligi: baslik,
        tutar: aylikTutarNum,
        baslangicTarihi: dateStr,
        taksitSayisi: taksitSayisiNum,
        aciklama: form.aciklama?.trim() || null,
      };

      await api.post("/api/taksitler", payload);

      setForm((p) => ({
        ...p,
        baslik: "",
        tutar: "",
        baslamaTarihi: "",
        taksitSayisi: "",
        aylikTutar: "",
        aciklama: "",
      }));

      await fetchMy();

      showMessage("Başarılı", "Taksit kaydı oluşturuldu.", "success");
    } catch (err: any) {
      console.log("Taksit create hata:", err?.response?.data || err?.message);
      showMessage("Hata", "Taksit kaydı oluşturulamadı.", "error");
    } finally {
      setSaving(false);
    }
  }, [saving, form, computedAylik, fetchMy, showMessage]);

  const onFinish = useCallback(
    async (taksitId?: number) => {
      if (!taksitId) return;

      showConfirm(
        "Taksiti Hemen Bitir",
        "Bu taksiti tek seferde kapatmak istiyor musun? (Toplam gider backend’de hesaplanacak)",
        async () => {
          if (finishingId != null) return;
          setFinishingId(taksitId);
        try {

          await api.post(`/api/taksitler/${taksitId}/finish-now`, null);

          await fetchMy();
          showMessage("Başarılı", "Taksit kapatıldı.", "success");
        } catch (err: any) {
          console.log("Taksit bitir hata:", err?.response?.data || err?.message);
          showMessage("Hata", "Taksit kapatılamadı.", "error");
        } finally {
          setFinishingId(null);
        }
      });
    },
    [fetchMy, showConfirm, showMessage, finishingId]
  );

  const normalizedItems = useMemo(() => {
    return (items || []).map((x) => {
      const id = Number(x.taksitId ?? x.id);
      const title = String(x.taksitBasligi ?? x.baslik ?? "").trim() || "Taksit";
      const tutar = toNum(x.tutar);
      const paraBirimi = String(x.paraBirimi ?? "TL").toUpperCase();
      const baslangic = String(x.baslangicTarihi ?? x.baslamaTarihi ?? "").slice(0, 10);
      const sayi = String(x.taksitSayisi ?? "");
      const aciklama = String(x.aciklama ?? "");
      const bittiMi = Boolean(x.bittiMi);

      return { id, title, tutar, paraBirimi, baslangic, sayi, aciklama, bittiMi };
    });
  }, [items]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Taksit Ödemeleri"
        subtitle="Düzenli ödemeler"
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
            onPress={fetchMy}
          />
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />
          }
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Yeni Taksit Kaydı</Text>

            <Text style={styles.label}>Taksit Başlığı</Text>
            <TextInput
              style={styles.input}
              value={form.baslik}
              onChangeText={(v) => setForm((p) => ({ ...p, baslik: v }))}
              placeholder="Örn: Telefon"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Toplam Tutar (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              value={form.tutar}
              onChangeText={(v) => setForm((p) => ({ ...p, tutar: v }))}
              placeholder="Örn: 12000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Para Birimi</Text>
            <TextInput
              style={styles.input}
              value={form.paraBirimi}
              onChangeText={(v) => setForm((p) => ({ ...p, paraBirimi: v }))}
              placeholder="TL, USD..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Taksit Başlama Tarihi</Text>
            <TouchableOpacity style={styles.input} activeOpacity={0.85} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.inputText}>{form.baslamaTarihi ? form.baslamaTarihi : "Tarih seçiniz"}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dateValue ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onPickDate}
              />
            )}

            <Text style={styles.label}>Taksit Sayısı</Text>
            <TextInput
              style={styles.input}
              value={form.taksitSayisi}
              onChangeText={(v) => setForm((p) => ({ ...p, taksitSayisi: v }))}
              placeholder="Örn: 12"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Aylık Tutar (gönderilecek değer)</Text>
            <TextInput
              style={styles.input}
              value={(form.aylikTutar || computedAylik).toString()}
              onChangeText={(v) => setForm((p) => ({ ...p, aylikTutar: v }))}
              placeholder="Otomatik hesaplanır"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

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
                <Text style={styles.saveButtonText}>Kaydet</Text>
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
              <View key={String(item.id)} style={styles.card}>
                <View style={styles.listHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.badge, item.bittiMi ? styles.badgeDone : styles.badgeActive]}>
                    <Text style={styles.badgeText}>{item.bittiMi ? "Bitti" : "Aktif"}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Aylık Tutar</Text>
                  <Text style={styles.value}>
                    {item.paraBirimi === "TL" || item.paraBirimi === "TRY"
                      ? `â‚º ${formatTRY(item.tutar)}`
                      : `${item.tutar} ${item.paraBirimi}`}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Başlama Tarihi</Text>
                  <Text style={styles.value}>{item.baslangic || "-"}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Taksit Sayısı</Text>
                  <Text style={styles.value}>{item.sayi || "-"}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Açıklama</Text>
                  <Text style={styles.value}>{item.aciklama || "-"}</Text>
                </View>

                {!item.bittiMi && (
                  <TouchableOpacity
                    style={[styles.endButton, finishingId === item.id && { opacity: 0.6 }]}
                    activeOpacity={0.85}
                    onPress={() => onFinish(item.id)}
                    disabled={finishingId === item.id}
                  >
                    {finishingId === item.id ? (
                      <ActivityIndicator color={colors.onAccent} />
                    ) : (
                      <Text style={styles.endButtonText}>Taksiti Hemen Bitir</Text>
                    )}
                  </TouchableOpacity>
                )}
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
        onConfirm={confirmAction ?? undefined}
        onCancel={cancelAction ?? undefined}
        confirmText={confirmText}
        cancelText={cancelText}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  screenTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  content: { padding: 16 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 12 },

  row: { marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 4 },
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
  inputText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  textarea: { minHeight: 80, textAlignVertical: "top" },

  saveButton: {
    marginTop: 4,
    backgroundColor: colors.warning,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: "900" },

  hintText: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 10 },

  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "900", marginBottom: 8 },
  emptyText: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 12 },

  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
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
  badgeDone: {
    backgroundColor: colors.textMuted,
    borderColor: "rgba(148,163,184,0.55)",
  },
  badgeText: { fontSize: 12, fontWeight: "900", color: colors.onAccent },

  endButton: {
    marginTop: 8,
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  endButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: "900" },
});
