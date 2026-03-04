import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BarChart, Grid, XAxis } from "react-native-svg-charts";
import { RootStackParamList } from "../../App";
import api, { BASE_URL } from "../config/api";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";
import { getMyYatirimlar, YatirimCreateResponse, YatirimVarlikTuru } from "../services/yatirimService";

type Props = NativeStackScreenProps<RootStackParamList, "YatirimGraph">;

type YatirimGraphPointDto = {
  label: string;
  toplamMaliyet: string;
  guncelDeger: string;
  karZarar: string;
};

type YatirimGraphResponse = {
  toplamMaliyet: string;
  toplamGuncelDeger: string;
  toplamKarZarar: string;
  points: YatirimGraphPointDto[];
};

type MarketLatestResponse = {
  ok: boolean;
  ts: number;
  source?: string;
  data: Record<string, { value: number }>;
};

type GroupBy = "HESAP" | "VARLIK";

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

export default function YatirimGraphScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [groupBy, setGroupBy] = useState<GroupBy>("HESAP");
  const [data, setData] = useState<YatirimGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketLatestResponse["data"] | null>(null);
  const [yatirimlar, setYatirimlar] = useState<YatirimCreateResponse[]>([]);
  const [yatirimLoading, setYatirimLoading] = useState(true);

  const fetchGraph = useCallback(async (group: GroupBy) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/yatirim/graph", { params: { groupBy: group } });
      setData(res.data ?? null);
    } catch (err: any) {
      console.log("Yatırım graph hata:", err?.response?.data || err?.message);
      setError("Grafik verisi yüklenemedi.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyYatirimlar = useCallback(async () => {
    setYatirimLoading(true);
    try {
      const list = await getMyYatirimlar();
      setYatirimlar(list);
    } catch (err: any) {
      console.log("yatirim/mine hata:", err?.response?.data || err?.message);
      setYatirimlar([]);
    } finally {
      setYatirimLoading(false);
    }
  }, []);

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
    (t: YatirimVarlikTuru | undefined) => {
      if (!t || t === "TL") return undefined;
      if (t === "USD") return getRate(["USDTRY", "USD/TRY", "USD_TRY"]);
      if (t === "EUR") return getRate(["EURTRY", "EUR/TRY", "EUR_TRY"]);
      return getRate(["GRAM_ALTIN_TRY", "GRAM_ALTIN", "GRAM/TRY", "XAU_TRY", "XAUTRY"]);
    },
    [getRate]
  );

  const fetchMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const res = await api.get(`${marketBaseUrl}/api/market/latest`);
      const payload: MarketLatestResponse = res.data;
      if (payload?.ok && payload?.data) {
        setMarketData(payload.data);
      }
    } catch (err: any) {
      console.log("Market latest hata:", err?.response?.data || err?.message);
    } finally {
      setMarketLoading(false);
    }
  }, [marketBaseUrl]);

  useEffect(() => {
    fetchGraph(groupBy);
  }, [fetchGraph, groupBy]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  useEffect(() => {
    fetchMyYatirimlar();
  }, [fetchMyYatirimlar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchGraph(groupBy), fetchMarket(), fetchMyYatirimlar()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchGraph, fetchMarket, fetchMyYatirimlar, groupBy]);

  const liveGraph = useMemo<YatirimGraphResponse | null>(() => {
    if (!marketData || yatirimlar.length === 0) return null;
    const agg = new Map<string, { toplamMaliyet: number; guncelDeger: number }>();
    for (const y of yatirimlar) {
      const key = groupBy === "HESAP" ? y.hesapAdi : y.varlikTuru;
      const marketPrice = getMarketPriceFor(y.varlikTuru);
      const guncelDeger =
        y.varlikTuru === "TL"
          ? Number(y.adet)
          : Number.isFinite(Number(marketPrice))
          ? Number(y.adet) * Number(marketPrice)
          : Number(y.guncelDeger);
      const toplamMaliyet = Number(y.toplamMaliyet) || 0;
      const prev = agg.get(key) ?? { toplamMaliyet: 0, guncelDeger: 0 };
      agg.set(key, {
        toplamMaliyet: prev.toplamMaliyet + toplamMaliyet,
        guncelDeger: prev.guncelDeger + (Number.isFinite(guncelDeger) ? guncelDeger : 0),
      });
    }
    const points: YatirimGraphPointDto[] = Array.from(agg.entries()).map(([label, v]) => ({
      label,
      toplamMaliyet: String(v.toplamMaliyet),
      guncelDeger: String(v.guncelDeger),
      karZarar: String(v.guncelDeger - v.toplamMaliyet),
    }));
    const toplamMaliyet = points.reduce((s, p) => s + toNum(p.toplamMaliyet), 0);
    const toplamGuncelDeger = points.reduce((s, p) => s + toNum(p.guncelDeger), 0);
    const toplamKarZarar = toplamGuncelDeger - toplamMaliyet;
    return {
      toplamMaliyet: String(toplamMaliyet),
      toplamGuncelDeger: String(toplamGuncelDeger),
      toplamKarZarar: String(toplamKarZarar),
      points,
    };
  }, [marketData, yatirimlar, groupBy, getMarketPriceFor]);

  const dataToShow = liveGraph ?? data;
  const points = dataToShow?.points ?? [];
  const visiblePoints = showAll ? points : points.slice(0, 10);

  const chartData = visiblePoints.map((p) => toNum(p.karZarar));
  const labels = visiblePoints.map((p) => p.label);

  const totalKarZarar = toNum(dataToShow?.toplamKarZarar);
  const karZararPositive = totalKarZarar >= 0;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Yatırım Grafiği"
        subtitle="Portföy özet görünüm"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
        right={
          <HeaderAction
            icon={<Ionicons name="refresh" size={16} color={colors.text} />}
            onPress={() => {
              fetchGraph(groupBy);
              fetchMarket();
              fetchMyYatirimlar();
            }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />}
      >
        <View style={styles.segmentWrap}>
          <TouchableOpacity
            style={[styles.segmentBtn, groupBy === "HESAP" && styles.segmentBtnActive]}
            onPress={() => setGroupBy("HESAP")}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, groupBy === "HESAP" && styles.segmentTextActive]}>Hesap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, groupBy === "VARLIK" && styles.segmentBtnActive]}
            onPress={() => setGroupBy("VARLIK")}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, groupBy === "VARLIK" && styles.segmentTextActive]}>Varlık</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.warning} />
            <Text style={styles.muted}>Yükleniyor...</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Toplam Maliyet</Text>
                <Text style={styles.kpiValue}>₺ {formatTRY(toNum(dataToShow?.toplamMaliyet))}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Toplam Güncel</Text>
                <Text style={styles.kpiValue}>₺ {formatTRY(toNum(dataToShow?.toplamGuncelDeger))}</Text>
              </View>
            </View>

            <View style={styles.kpiCardWide}>
              <Text style={styles.kpiLabel}>Toplam Kâr/Zarar</Text>
              <View style={styles.karRow}>
                <Text style={[styles.kpiValue, karZararPositive ? styles.karUp : styles.karDown]}>
                  ₺ {formatTRY(totalKarZarar)}
                </Text>
                <View style={[styles.karBadge, karZararPositive ? styles.karBadgeUp : styles.karBadgeDown]}>
                  <Text style={styles.karBadgeText}>{karZararPositive ? "Kâr" : "Zarar"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Kâr/Zarar Grafiği</Text>
              {chartData.length === 0 ? (
                <Text style={styles.muted}>Grafik verisi yok.</Text>
              ) : (
                <>
                  <BarChart
                    style={styles.chart}
                    data={chartData}
                    svg={{ fill: colors.warning }}
                    contentInset={{ top: 10, bottom: 10 }}
                    spacingInner={0.3}
                  >
                    <Grid />
                  </BarChart>
                  <XAxis
                    style={styles.xAxis}
                    data={chartData}
                    formatLabel={(value, index) => labels[index] ?? ""}
                    contentInset={{ left: 10, right: 10 }}
                    svg={{ fontSize: 10, fill: colors.textMuted }}
                  />
                </>
              )}
            </View>

            <View style={styles.tableHeader}>
              <Text style={styles.sectionTitle}>Detaylar</Text>
              {points.length > 10 && (
                <TouchableOpacity onPress={() => setShowAll((p) => !p)} activeOpacity={0.85}>
                  <Text style={styles.linkText}>{showAll ? "İlk 10" : "Tümü"}</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={visiblePoints}
              keyExtractor={(item, idx) => `${item.label}-${idx}`}
              scrollEnabled={false}
              contentContainerStyle={styles.table}
              renderItem={({ item }) => (
                <View style={styles.tableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableTitle} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                  <Text style={styles.tableValue}>₺ {formatTRY(toNum(item.toplamMaliyet))}</Text>
                  <Text style={styles.tableValue}>₺ {formatTRY(toNum(item.guncelDeger))}</Text>
                  <Text style={styles.tableValue}>₺ {formatTRY(toNum(item.karZarar))}</Text>
                </View>
              )}
              ListHeaderComponent={
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableHead, { flex: 1 }]}>Etiket</Text>
                  <Text style={styles.tableHead}>Maliyet</Text>
                  <Text style={styles.tableHead}>Güncel</Text>
                  <Text style={styles.tableHead}>K/Z</Text>
                </View>
              }
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 28 },
    segmentWrap: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      marginBottom: 14,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },
    segmentBtnActive: { backgroundColor: colors.surfaceAlt },
    segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
    segmentTextActive: { color: colors.text },
    center: { alignItems: "center", paddingVertical: 20, gap: 8 },
    muted: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "800" },
    kpiRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kpiCardWide: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    kpiLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
    kpiValue: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 6 },
    karRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    karUp: { color: colors.success },
    karDown: { color: colors.danger },
    karBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    karBadgeUp: { backgroundColor: colors.success, borderColor: colors.success },
    karBadgeDown: { backgroundColor: colors.danger, borderColor: colors.danger },
    karBadgeText: { color: colors.onAccent, fontSize: 11, fontWeight: "900" },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    sectionTitle: { color: colors.text, fontSize: 13, fontWeight: "900", marginBottom: 8 },
    chart: { height: 180 },
    xAxis: { height: 24, marginTop: 6 },
    tableHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    linkText: { color: colors.warning, fontSize: 12, fontWeight: "900" },
    table: { gap: 8 },
    tableRowHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
    },
    tableHead: { color: colors.textMuted, fontSize: 11, fontWeight: "800", width: 72, textAlign: "right" },
    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tableTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
    tableValue: { color: colors.text, fontSize: 12, fontWeight: "800", width: 72, textAlign: "right" },
  });
