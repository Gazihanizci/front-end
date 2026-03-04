import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import api, { BASE_URL } from "../config/api";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";
import { RootStackParamList } from "../../App";

type PortfolioItem = {
  portfoyId: number;
  kullaniciId: number;
  varlikTuru: string;
  toplamAdet: number;
  ortalamaMaliyet: number;
  toplamMaliyet: number;
  realizedKar: number;
  unrealizedKar: number;
  guncelDeger: number;
};

type AssetType = "USD" | "EUR" | "ALTIN";

type TransactionRequest = {
  varlikTuru: AssetType;
  tip: "ALIS" | "SATIS";
  adet: number;
  fiyat: number;
};

type MarketLatestResponse = {
  ok: boolean;
  ts: number;
  source?: string;
  data: Record<string, { value: number }>;
};

const ASSETS: AssetType[] = ["USD", "EUR", "ALTIN"];

const formatMoney = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatQty = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const parseNumber = (s: string) => {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const fetchPortfolio = async () => {
  const res = await api.get<PortfolioItem[]>("/api/portfoy/mine");
  return res.data;
};

const createTransaction = async (payload: TransactionRequest) => {
  const res = await api.post("/api/islem", payload);
  return res.data;
};

type ModalMode = {
  visible: boolean;
  type: "ALIS" | "SATIS";
  asset: AssetType;
  assetLocked: boolean;
};

export default function HesaplarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketLatestResponse["data"] | null>(null);

  const [modal, setModal] = useState<ModalMode>({
    visible: false,
    type: "ALIS",
    asset: "USD",
    assetLocked: false,
  });
  const [quantityText, setQuantityText] = useState("");
  const [priceText, setPriceText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);

  const marketBaseUrl = useMemo(() => {
    const raw = String(BASE_URL || "").trim();
    const match = raw.match(/^(https?:)\/\/([^:/]+)/i);
    if (match) {
      const protocol = match[1];
      const host = match[2];
      return `${protocol}//${host}:8090`;
    }
    return "http://127.0.0.1:8090";
  }, []);

  const fetchMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const res = await api.get(`${marketBaseUrl}/api/market/latest`);
      const payload: MarketLatestResponse = res.data;
      if (payload?.ok && payload?.data) {
        setMarketData(payload.data);
      }
    } catch (e: any) {
      setMarketData(null);
    } finally {
      setMarketLoading(false);
    }
  }, [marketBaseUrl]);

  const getRate = useCallback(
    (keys: string[]) => {
      if (!marketData) return undefined;
      for (const k of keys) {
        const val = marketData[k]?.value;
        if (Number.isFinite(val)) return val;
      }
      return undefined;
    },
    [marketData]
  );

  const getMarketPriceFor = useCallback(
    (t: AssetType | undefined) => {
      if (!t) return undefined;
      if (t === "USD") return getRate(["USDTRY", "USD/TRY", "USD_TRY"]);
      if (t === "EUR") return getRate(["EURTRY", "EUR/TRY", "EUR_TRY"]);
      return getRate(["GRAM_ALTIN_TRY", "GRAM_ALTIN", "GRAM/TRY", "XAU_TRY", "XAUTRY"]);
    },
    [getRate]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPortfolio();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data ||
        e?.message ||
        "Portföy yüklenemedi.";
      setError(String(msg));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchMarket();
  }, [fetchMarket, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data] = await Promise.all([fetchPortfolio(), fetchMarket()]);
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data ||
        e?.message ||
        "Portföy yenilenemedi.";
      setError(String(msg));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const openTradeModal = useCallback((asset: PortfolioItem["varlikTuru"], type: "ALIS" | "SATIS") => {
    if (asset !== "USD" && asset !== "EUR" && asset !== "ALTIN") {
      setError("Geçersiz varlık türü.");
      return;
    }
    setModal({ visible: true, type, asset, assetLocked: true });
    setQuantityText("");
    setPriceText("");
    setAssetOpen(false);
  }, []);

  const openAddAccount = useCallback(() => {
    setModal({ visible: true, type: "ALIS", asset: "USD", assetLocked: false });
    setQuantityText("");
    setPriceText("");
    setAssetOpen(false);
  }, []);

  const submitDisabled = useMemo(() => {
    if (submitting) return true;
    const adet = parseNumber(quantityText);
    const fiyat = parseNumber(priceText);
    return !Number.isFinite(adet) || adet <= 0 || !Number.isFinite(fiyat) || fiyat <= 0;
  }, [priceText, quantityText, submitting]);

  const handleSubmit = useCallback(async () => {
    const adet = parseNumber(quantityText);
    const fiyat = parseNumber(priceText);
    if (!Number.isFinite(adet) || adet <= 0 || !Number.isFinite(fiyat) || fiyat <= 0) {
      setError("Miktar ve fiyat 0'dan büyük olmalıdır.");
      return;
    }

    const payload: TransactionRequest = {
      varlikTuru: modal.asset,
      tip: modal.type,
      adet,
      fiyat,
    };

    setSubmitting(true);
    try {
      await createTransaction(payload);
      setModal((s) => ({ ...s, visible: false }));
      await load();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data ||
        e?.message ||
        "İşlem başarısız.";
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }, [modal.asset, modal.type, load, priceText, quantityText]);

  const renderItem = useCallback(
    ({ item }: { item: PortfolioItem }) => {
      const unrealizedUp = Number(item.unrealizedKar) >= 0;
      const realizedUp = Number(item.realizedKar) >= 0;
      const marketPrice = getMarketPriceFor(item.varlikTuru as AssetType);
      const backendCurrent = Number(item.guncelDeger) || 0;
      const marketCurrent =
        Number.isFinite(Number(marketPrice)) && Number.isFinite(Number(item.toplamAdet))
          ? Number(marketPrice) * Number(item.toplamAdet)
          : NaN;
      const displayCurrent =
        Number.isFinite(marketCurrent) && marketCurrent > 0 ? marketCurrent : backendCurrent;

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.varlikTuru}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>#{item.portfoyId}</Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.label}>Toplam Adet</Text>
            <Text style={styles.value}>{formatQty(item.toplamAdet)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Ortalama Maliyet</Text>
            <Text style={styles.value}>₺ {formatMoney(item.ortalamaMaliyet)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Güncel Değer</Text>
            <Text style={styles.value}>₺ {formatMoney(displayCurrent)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Anlık Kâr/Zarar</Text>
            <Text style={[styles.value, unrealizedUp ? styles.positive : styles.negative]}>
              {unrealizedUp ? "+" : "-"}₺ {formatMoney(Math.abs(item.unrealizedKar))}
            </Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Gerçekleşen Kâr/Zarar</Text>
            <Text style={[styles.value, realizedUp ? styles.positive : styles.negative]}>
              {realizedUp ? "+" : "-"}₺ {formatMoney(Math.abs(item.realizedKar))}
            </Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.buyBtn]}
              onPress={() => openTradeModal(item.varlikTuru, "ALIS")}
            >
              <Text style={styles.actionText}>Alış Yap</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.sellBtn]}
              onPress={() => openTradeModal(item.varlikTuru, "SATIS")}
            >
              <Text style={styles.actionText}>Satış Yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [getMarketPriceFor, marketLoading, openTradeModal, styles]
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScreenHeader
        title="Hesaplarım"
        subtitle="Portföy Özeti"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.warning} />
          <Text style={styles.muted}>Yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.portfoyId)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.muted}>Portföy bulunamadı.</Text>}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : <View style={{ height: 6 }} />}
        />
      )}

      <Modal visible={modal.visible} transparent animationType="slide" onRequestClose={() => setModal((s) => ({ ...s, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modal.type === "ALIS" ? "Alış" : "Satış"} İşlemi</Text>
              <Pressable onPress={() => setModal((s) => ({ ...s, visible: false }))}>
                <Text style={styles.modalClose}>Kapat</Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Varlık</Text>
            {modal.assetLocked ? (
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>{modal.asset}</Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={[styles.dropdown, assetOpen && styles.dropdownOpen]}
                  onPress={() => setAssetOpen((v) => !v)}
                >
                  <Text style={styles.dropdownText}>{modal.asset}</Text>
                  <Ionicons name={assetOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </Pressable>
                {assetOpen && (
                  <View style={styles.dropdownList}>
                    {ASSETS.map((a) => (
                      <Pressable
                        key={a}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setModal((s) => ({ ...s, asset: a }));
                          setAssetOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, a === modal.asset && styles.dropdownItemActive]}>
                          {a}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={styles.inputLabel}>Adet</Text>
            <TextInput
              value={quantityText}
              onChangeText={setQuantityText}
              placeholder="Örn: 100"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Fiyat</Text>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              placeholder="Örn: 32,50"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, submitDisabled && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitDisabled}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>Onayla</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.addAccountBtn} onPress={openAddAccount}>
          <Ionicons name="add" size={18} color={colors.onAccent} />
          <Text style={styles.addAccountText}>Hesap Ekle</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    listContent: { paddingHorizontal: 16, paddingBottom: 88 },

    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    muted: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "800", marginBottom: 6 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    cardTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    badge: {
      backgroundColor: colors.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    badgeText: { color: colors.textMuted, fontSize: 10, fontWeight: "800" },

    cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    label: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
    value: { color: colors.text, fontSize: 12, fontWeight: "800" },
    positive: { color: colors.success },
    negative: { color: colors.danger },

    cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
    actionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: 1,
    },
    buyBtn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    sellBtn: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: colors.danger },
    actionText: { color: colors.text, fontSize: 12, fontWeight: "800" },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
    modalClose: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },

    inputLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800", marginTop: 10, marginBottom: 6 },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    readonlyBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    readonlyText: { color: colors.text, fontSize: 12, fontWeight: "800" },

    dropdown: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dropdownOpen: { borderColor: colors.warning },
    dropdownText: { color: colors.text, fontSize: 12, fontWeight: "800" },
    dropdownList: {
      marginTop: 6,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
    dropdownItemText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
    dropdownItemActive: { color: colors.text },

    primaryBtn: {
      marginTop: 14,
      backgroundColor: colors.warning,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.onAccent, fontWeight: "900" },
    btnDisabled: { opacity: 0.6 },

    bottomBar: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    addAccountBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.warning,
      paddingVertical: 12,
      borderRadius: 12,
    },
    addAccountText: { color: colors.onAccent, fontWeight: "900", fontSize: 14 },
  });
