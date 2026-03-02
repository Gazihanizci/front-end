import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import api, { BASE_URL } from "../config/api";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Kurlar">;

type MarketLatestResponse = {
  ok: boolean;
  ts: number;
  source?: string;
  data: Record<string, { value: number }>;
};

type RateItem = {
  code: string;
  label: string;
  keys: string[];
  tone?: "accent" | "success" | "danger" | "warning";
};

export default function KurlarScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marketData, setMarketData] = useState<MarketLatestResponse["data"] | null>(null);
  const [marketTs, setMarketTs] = useState<number | null>(null);

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
    setLoading(true);
    try {
      const res = await api.get(`${marketBaseUrl}/api/market/latest`);
      const payload: MarketLatestResponse = res.data;
      if (payload?.ok && payload?.data) {
        setMarketData(payload.data);
        setMarketTs(Number(payload?.ts) || null);
      }
    } catch (err) {
      console.log("Kurlar market hata:", err);
    } finally {
      setLoading(false);
    }
  }, [marketBaseUrl]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMarket();
    } finally {
      setRefreshing(false);
    }
  }, [fetchMarket]);

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

  const formatRate = (n?: number, digits = 4) =>
    Number.isFinite(n)
      ? `₺ ${Number(n).toLocaleString("tr-TR", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })}`
      : "-";

  const updatedAt = useMemo(() => {
    if (!marketTs) return null;
    return new Date(marketTs * 1000).toLocaleString("tr-TR");
  }, [marketTs]);

  const majorRates: RateItem[] = [
    { code: "USD/TRY", label: "Dolar", keys: ["USDTRY", "USD/TRY", "USD_TRY"], tone: "accent" },
    { code: "EUR/TRY", label: "Euro", keys: ["EURTRY", "EUR/TRY", "EUR_TRY"], tone: "success" },
    { code: "GBP/TRY", label: "Sterlin", keys: ["GBPTRY", "GBP/TRY", "GBP_TRY"], tone: "danger" },
    { code: "JPY/TRY", label: "Japon Yeni", keys: ["JPYTRY", "JPY/TRY", "JPY_TRY"] },
    { code: "CHF/TRY", label: "İsviçre Frangı", keys: ["CHFTRY", "CHF/TRY", "CHF_TRY"] },
  ];

  const otherRates: RateItem[] = [
    { code: "CAD/TRY", label: "Kanada Doları", keys: ["CADTRY", "CAD/TRY", "CAD_TRY"] },
    { code: "AUD/TRY", label: "Avustralya D.", keys: ["AUDTRY", "AUD/TRY", "AUD_TRY"] },
    { code: "NZD/TRY", label: "Yeni Zelanda D.", keys: ["NZDTRY", "NZD/TRY", "NZD_TRY"] },
    { code: "SEK/TRY", label: "İsveç Kronu", keys: ["SEKTRY", "SEK/TRY", "SEK_TRY"] },
    { code: "NOK/TRY", label: "Norveç Kronu", keys: ["NOKTRY", "NOK/TRY", "NOK_TRY"] },
    { code: "DKK/TRY", label: "Danimarka Kronu", keys: ["DKKTRY", "DKK/TRY", "DKK_TRY"] },
    { code: "PLN/TRY", label: "Polonya Zloty", keys: ["PLNTRY", "PLN/TRY", "PLN_TRY"] },
  ];

  const goldRate: RateItem = {
    code: "GRAM ALTIN",
    label: "Gram Altın",
    keys: ["GRAM_ALTIN_TRY", "GRAM_ALTIN", "GRAM/TRY", "XAU_TRY", "XAUTRY"],
    tone: "warning",
  };

  const renderRate = (item: RateItem, wide?: boolean) => {
    const toneStyle =
      item.tone === "accent"
        ? styles.rateChipAccent
        : item.tone === "success"
        ? styles.rateChipSuccess
        : item.tone === "danger"
        ? styles.rateChipDanger
        : item.tone === "warning"
        ? styles.rateChipWarning
        : styles.rateChipNeutral;

    return (
      <View key={item.code} style={[styles.rateItem, wide && styles.rateItemWide]}>
        <View style={styles.rateTop}>
          <View style={[styles.rateChip, toneStyle]}>
            <Text style={styles.rateChipText}>{item.code}</Text>
          </View>
          <Text style={styles.rateLabel}>{item.label}</Text>
        </View>
        <Text style={styles.rateValue}>
          {loading ? "Yükleniyor..." : formatRate(getRate(item.keys))}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Kurlar"
        subtitle="Canlı piyasa görünümü"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Menu"))}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />
          <Text style={styles.heroTitle}>Anlık Kur Takibi</Text>
          <Text style={styles.heroSub}>
            {updatedAt ? `Son güncelleme: ${updatedAt}` : "Son güncelleme bekleniyor"}
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchMarket} activeOpacity={0.85}>
            <Ionicons name="refresh" size={16} color={colors.onAccent} />
            <Text style={styles.refreshText}>Yenile</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Öne Çıkanlar</Text>
        <View style={styles.rateGrid}>{majorRates.map((r) => renderRate(r))}</View>

        <Text style={styles.sectionTitle}>Altın</Text>
        <View style={styles.rateGrid}>{renderRate(goldRate, true)}</View>

        <Text style={styles.sectionTitle}>Diğer Kurlar</Text>
        <View style={styles.rateGrid}>{otherRates.map((r) => renderRate(r))}</View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 28 },

    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      overflow: "hidden",
    },
    heroGlowA: {
      position: "absolute",
      width: 160,
      height: 160,
      borderRadius: 160,
      backgroundColor: colors.accentSoft,
      top: -60,
      right: -40,
      opacity: 0.7,
    },
    heroGlowB: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 120,
      backgroundColor: colors.headerGlowB,
      bottom: -50,
      left: -40,
      opacity: 0.6,
    },
    heroTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    heroSub: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: "700" },
    refreshBtn: {
      marginTop: 12,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.warning,
      borderWidth: 1,
      borderColor: colors.warning,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    refreshText: { color: colors.onAccent, fontWeight: "800", fontSize: 12 },

    sectionTitle: { color: colors.text, fontSize: 13, fontWeight: "900", marginBottom: 10 },
    rateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
    rateItem: {
      width: "48%",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rateItemWide: { width: "100%" },
    rateTop: { gap: 6 },
    rateChip: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    rateChipText: { color: colors.onAccent, fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
    rateChipNeutral: { backgroundColor: colors.textMuted, borderColor: colors.textMuted },
    rateChipAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
    rateChipSuccess: { backgroundColor: colors.success, borderColor: colors.success },
    rateChipDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
    rateChipWarning: { backgroundColor: colors.warning, borderColor: colors.warning },
    rateLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    rateValue: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 8 },
  });
