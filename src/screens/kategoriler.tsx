import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { ActivityIndicator } from "react-native";
import { getUserId } from "../utils/authStorage";

type Kategori = {
  id: number;
  ad: string;
  tip: "GIDER" | "GELIR";
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

export default function Kategoriler() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"HEPSI" | "GIDER" | "GELIR">("HEPSI");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Kategori | null>(null);
  const [amountVisible, setAmountVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const API_BASE = "http://192.168.234.156:8080"; // Spring Boot base’in neyse onu yaz

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DATA.filter((k) => {
      const okTab = tab === "HEPSI" ? true : k.tip === tab;
      const okQ = q ? k.ad.toLowerCase().includes(q) : true;
      return okTab && okQ;
    });
  }, [query, tab]);
  const parseTrMoney = (s: string) => {
  // "1.500,25" -> 1500.25  | "1500" -> 1500
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};
const createIslem = async () => {
  if (!selected) return;

  const tutarNum = parseTrMoney(amount);
  if (!Number.isFinite(tutarNum) || tutarNum <= 0) {
    // istersen MessageBox/Alert kullan
    return;
  }

  const userId = await getUserId();
  if (!userId) {
    // kullanıcı yoksa login’e at
    return;
  }

  setSaving(true);
  try {
    const res = await fetch(`${API_BASE}/api/islemler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-USER-ID": String(userId),
      },
      body: JSON.stringify({
        kategoriId: selected.id,
        tutar: tutarNum,          // backend BigDecimal alır
        aciklama: description?.trim() || null,
        // islemTarihi göndermek istersen:
        // islemTarihi: new Date().toISOString().slice(0,19),
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.message || "İşlem kaydedilemedi";
      throw new Error(msg);
    }

    // ✅ başarılı
    setAmountVisible(false);
    setSelected(null);
    setAmount("");
    setDescription("");
  } catch (e: any) {
    // burada MessageBox açabilirsin
    console.log("islem create hata:", e?.message || e);
  } finally {
    setSaving(false);
  }
};

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Kategoriler</Text>
        <Text style={styles.subTitle}>Gelir ve gider kalemlerini düzenle</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kategori ara..."
          placeholderTextColor="#6b7280"
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
                {t === "HEPSI" ? "Hepsi" : t}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filtered.map((k) => {
          const isGider = k.tip === "GIDER";
          const icon = ICONS[k.ad] ?? (isGider ? "💸" : "💵");
            return (
             <TouchableOpacity
               key={k.id}
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
                    {k.tip}
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
              {selected ? `${selected.ad} (${selected.tip})` : "Kategori"}
            </Text>

            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Tutar (örn: 1250,50)"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Açıklama (opsiyonel)"
              placeholderTextColor="#9ca3af"
              style={styles.input}
            />  
            <TouchableOpacity
  style={[styles.primaryBtn, (!amount.trim() || saving) && { opacity: 0.6 }]}
  disabled={!amount.trim() || saving}
  onPress={createIslem}
>
  {saving ? (
    <ActivityIndicator color="#0b0f1a" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b0f1a",
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#e5e7eb",
  },
  subTitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: "#111827",
    color: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
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
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(148,163,184,0.05)",
  },
  tabActive: {
    backgroundColor: "#facc15",
    borderColor: "#facc15",
  },
  tabText: {
    color: "#cbd5e1",
    fontWeight: "800",
    fontSize: 12,
  },
  tabTextActive: {
    color: "#0b0f1a",
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
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
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
  iconBoxGider: { backgroundColor: "rgba(251,113,133,0.15)" },
  iconBoxGelir: { backgroundColor: "rgba(34,197,94,0.15)" },
  iconText: { fontSize: 18 },
  cardTitle: {
    color: "#e5e7eb",
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
    backgroundColor: "rgba(251,113,133,0.12)",
    borderColor: "rgba(251,113,133,0.5)",
  },
  badgeGelir: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.5)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  badgeTextGider: { color: "#fb7185" },
  badgeTextGelir: { color: "#22c55e" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  sheetSubTitle: { color: "#94a3b8", marginTop: 4, marginBottom: 12, fontWeight: "700" },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  primaryBtn: {
    backgroundColor: "#facc15",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#0b0f1a", fontWeight: "900" },
  cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  cancelText: { color: "#94a3b8", fontWeight: "800" },
});
