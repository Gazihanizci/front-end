import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import api from "../config/api";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import MessageBox from "../components/MessageBox";
import { ThemeColors, useTheme } from "../theme/theme";

type Kategori = {
  id: number;
  ad: string;
  tip: "GIDER" | "GELIR";
  source?: "STANDARD" | "CUSTOM";
};

const ICONS: Record<string, string> = {
  Aidat: "🏢",
  Elektrik: "💡",
  Su: "💧",
  Isınma: "🔥",
  Telefon: "📱",
  İnternet: "🌐",
  "Ev Kirası": "🏠",
  "Kredi Kartı Borcu": "💳",
  "Yol ve Seyahat": "🚌",
  Mutfak: "🍽️",
  Giyim: "👕",
  "Diğer Giderler": "🧾",
  "Maaş Getirisi": "💼",
  "Diğer Gelirler": "💰",
};

const DATA: Kategori[] = [
  { id: 1, ad: "Aidat", tip: "GIDER" },
  { id: 2, ad: "Elektrik", tip: "GIDER" },
  { id: 3, ad: "Su", tip: "GIDER" },
  { id: 4, ad: "Isınma", tip: "GIDER" },
  { id: 5, ad: "Telefon", tip: "GIDER" },
  { id: 6, ad: "İnternet", tip: "GIDER" },
  { id: 7, ad: "Ev Kirası", tip: "GIDER" },
  { id: 8, ad: "Kredi Kartı Borcu", tip: "GIDER" },
  { id: 9, ad: "Yol ve Seyahat", tip: "GIDER" },
  { id: 10, ad: "Mutfak", tip: "GIDER" },
  { id: 11, ad: "Giyim", tip: "GIDER" },
  { id: 12, ad: "Diğer Giderler", tip: "GIDER" },
  { id: 13, ad: "Maaş Getirisi", tip: "GELIR" },
  { id: 14, ad: "Diğer Gelirler", tip: "GELIR" },
];

type Props = NativeStackScreenProps<RootStackParamList, "Categories">;

export default function KategorilerScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"HEPSI" | "GIDER" | "GELIR">("HEPSI");

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Kategori | null>(null);
  const [amountVisible, setAmountVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"GIDER" | "GELIR">("GIDER");
  const [creating, setCreating] = useState(false);

  const [customCategories, setCustomCategories] = useState<Kategori[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [userInfo, setUserInfo] = useState<{ aileId: number | null } | null>(null);

  const [msgVisible, setMsgVisible] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  const fetchCustomCategories = useCallback(async () => {
    setLoadingCustom(true);
    try {
      const res = await api.get("/api/ozel-kategori");
      const arr = Array.isArray(res.data) ? res.data : [];
      const normalized: Kategori[] = arr.map((x: any) => ({
        id: Number(x.ozelKategoriId ?? x.id),
        ad: String(x.ad ?? ""),
        tip: x.tip === "GELIR" ? "GELIR" : "GIDER",
        source: "CUSTOM",
      }));
      setCustomCategories(normalized);
    } catch (e: any) {
      console.log("ozel kategori listeleme hata:", e?.response?.data || e?.message);
      setCustomCategories([]);
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomCategories();
  }, [fetchCustomCategories]);

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await api.get("/api/userinfo");
      setUserInfo({ aileId: res?.data?.aileId ?? null });
    } catch (e: any) {
      console.log("userinfo hata:", e?.response?.data || e?.message);
      setUserInfo(null);
    }
  }, []);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [
      ...DATA.map((k) => ({ ...k, source: "STANDARD" as const })),
      ...customCategories,
    ];
    return all.filter((k) => {
      const okTab = tab === "HEPSI" ? true : k.tip === tab;
      const okQ = q ? k.ad.toLowerCase().includes(q) : true;
      return okTab && okQ;
    });
  }, [query, tab, customCategories]);

  const displayTip = (tip: "GIDER" | "GELIR") => (tip === "GELIR" ? "GELİR" : "GİDER");

  const parseTrMoney = (s: string) => {
    const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  };

  const createIslem = useCallback(async () => {
    if (!selected) return;

    const tutarNum = parseTrMoney(amount);
    if (!Number.isFinite(tutarNum) || tutarNum <= 0) {
      setMsgType("error");
      setMsgText("Tutar geçerli değil.");
      setMsgVisible(true);
      return;
    }

    setSaving(true);
    try {
      const isStandard = DATA.some((k) => k.id === selected.id);
      if (selected.source === "CUSTOM" || !isStandard) {
        if (userInfo?.aileId == null) {
          setMsgType("error");
          setMsgText("Aile bilgisi bulunamadı. Özel işlem oluşturulamadı.");
          setMsgVisible(true);
          return;
        }
        await api.post("/api/ozelislemler", {
          aileId: userInfo.aileId,
          ozelKategoriId: selected.id,
          tutar: tutarNum,
          paraBirimi: "TL",
          islemTarihi: new Date().toISOString(),
          aciklama: description?.trim() || null,
        });
      } else {
        await api.post("/api/islemler", {
          kategoriId: selected.id,
          tutar: tutarNum,
          aciklama: description?.trim() || null,
        });
      }

      setAmountVisible(false);
      setSelected(null);
      setAmount("");
      setDescription("");
      setMsgType("success");
      setMsgText("İşlem kaydedildi.");
      setMsgVisible(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data ||
        e?.message ||
        "İşlem oluşturulamadı.";
      console.log("islem create hata:", msg);
      setMsgType("error");
      setMsgText(String(msg));
      setMsgVisible(true);
    } finally {
      setSaving(false);
    }
  }, [amount, description, selected, userInfo]);

  const createCategory = useCallback(async () => {
    if (creating) return;
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    try {
      await api.post("/api/ozel-kategori", {
        ad: name,
        tip: newType,
      });
      await fetchCustomCategories();
      setCreateVisible(false);
      setNewName("");
      setNewType("GIDER");
      setMsgType("success");
      setMsgText("Kategori oluşturuldu.");
      setMsgVisible(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data ||
        e?.message ||
        "Kategori oluşturulamadı.";
      console.log("ozel kategori create hata:", msg);
      setMsgType("error");
      setMsgText(String(msg));
      setMsgVisible(true);
    } finally {
      setCreating(false);
    }
  }, [creating, newName, newType, fetchCustomCategories]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Kategoriler"
        subtitle="Gelir ve gider kalemlerini düzenle"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
      />

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kategori ara..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.tabs}>
        {(["HEPSI", "GIDER", "GELIR"] as const).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t === "HEPSI" ? "Hepsi" : displayTip(t)}
                </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loadingCustom && (
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>
            Özel kategoriler yükleniyor...
          </Text>
        )}

        {filtered.map((k, idx) => {
          const isGider = k.tip === "GIDER";
          const icon = ICONS[k.ad] ?? (isGider ? "💸" : "💵");
          return (
            <TouchableOpacity
              key={`${k.source ?? "STANDARD"}-${k.id}-${k.ad}-${k.tip}-${idx}`}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {
                setSelected(k);
                setAmount("");
                setDescription("");
                setAmountVisible(true);
              }}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, isGider ? styles.iconBoxGider : styles.iconBoxGelir]}>
                  <Text style={styles.iconText}>{icon}</Text>
                </View>
                <View>
                  <Text style={styles.cardTitle}>{k.ad}</Text>
                </View>
              </View>
              <View style={[styles.badge, isGider ? styles.badgeGider : styles.badgeGelir]}>
                <Text style={[styles.badgeText, isGider ? styles.badgeTextGider : styles.badgeTextGelir]}>
                  {displayTip(k.tip)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={amountVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Tutar Gir</Text>
            <Text style={styles.sheetSubTitle}>
              {selected ? `${selected.ad} (${displayTip(selected.tip)})` : "Kategori"}
            </Text>

            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Tutar (örn: 1.250,50)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Açıklama (opsiyonel)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, (!amount.trim() || saving) && { opacity: 0.6 }]}
              disabled={!amount.trim() || saving}
              onPress={createIslem}
            >
              {saving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>Kaydet</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setAmountVisible(false)}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={createVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Yeni Kategori</Text>
            <Text style={styles.sheetSubTitle}>Kategori adı ve türünü seç</Text>

            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Kategori adı"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <View style={styles.typeRow}>
              {(["GIDER", "GELIR"] as const).map((t) => {
                const active = newType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, active && styles.typeBtnActive]}
                    onPress={() => setNewType(t)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeBtnText, active && styles.typeBtnTextActive]}>
                      {displayTip(t)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (!newName.trim() || creating) && { opacity: 0.6 }]}
              disabled={!newName.trim() || creating}
              onPress={createCategory}
            >
              {creating ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>Oluştur</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCreateVisible(false)}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => setCreateVisible(true)} activeOpacity={0.9}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <MessageBox
        visible={msgVisible}
        title={msgType === "success" ? "Başarılı" : msgType === "error" ? "Hata" : "Bilgi"}
        message={msgText}
        type={msgType}
        onClose={() => setMsgVisible(false)}
        confirmText="Tamam"
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, mode: "dark" | "light") =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchWrap: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    searchInput: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabs: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.accentSoft,
    },
    tabActive: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    tabText: {
      color: colors.textMuted,
      fontWeight: "800",
      fontSize: 12,
    },
    tabTextActive: {
      color: colors.onAccent,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 10,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    iconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBoxGider: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    iconBoxGelir: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.success,
    },
    iconText: { fontSize: 18 },
    cardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    badge: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeGider: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.danger,
    },
    badgeGelir: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.success,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    badgeTextGider: { color: colors.danger },
    badgeTextGelir: { color: colors.success },
    modalBackdrop: {
      flex: 1,
      backgroundColor: mode === "light" ? "rgba(15,23,42,0.35)" : "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    sheetSubTitle: { color: colors.textMuted, marginTop: 4, marginBottom: 12, fontWeight: "700" },
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      padding: 14,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryBtn: {
      backgroundColor: colors.warning,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.onAccent, fontWeight: "900" },
    cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
    cancelText: { color: colors.textMuted, fontWeight: "800" },
    typeRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    typeBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
    },
    typeBtnActive: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    typeBtnText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },
    typeBtnTextActive: { color: colors.onAccent },
    fab: {
      position: "absolute",
      right: 18,
      bottom: 18,
      width: 56,
      height: 56,
      borderRadius: 56,
      backgroundColor: colors.warning,
      alignItems: "center",
      justifyContent: "center",
    },
    fabText: { color: colors.onAccent, fontSize: 28, fontWeight: "900", marginTop: -2 },
  });
