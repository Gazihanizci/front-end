import React, { useEffect, useMemo, useState, useCallback } from "react";
import api, { BASE_URL } from "../config/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App"; // 🔴 yolu projene göre kontrol et
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as Progress from "react-native-progress";
import Svg, { Circle, G } from "react-native-svg";
import { ThemeColors, ThemeMode, useTheme } from "../theme/theme";

type Account = { id: string; name: string; balance: number; currency: string };

type Hesap = {
  hesapId: number;
  hesapAdi: string;
  paraBirimi: string;
  bakiye: number;
};

type AylikAnaliz = {
  yilAy: string; // "2026-02" veya "2026-02-01" veya "2026-02-01T00:00:00"
  aylikGelir: number;
  aylikGider: number;
};
type UserInfo = {
  kullaniciId: number;
  ad: string;
  soyad: string;
  email: string;
  aileId: number | null;
};
type MarketLatestResponse = {
  ok: boolean;
  ts: number;
  source?: string;
  data: Record<string, { value: number }>;
};
type CategorySummaryItem = {
  kategoriId: number;
  kategoriAd: string;
  tip: "GIDER" | "GELIR";
  toplamTutar: number;
};
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
type GraphGroupBy = "HESAP" | "VARLIK";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;
export default function HomeScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  // =========================
  // ✅ STATE
  // =========================
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(true);

  const [son6Ay, setSon6Ay] = useState<AylikAnaliz[]>([]);
  const [loading6Ay, setLoading6Ay] = useState(true);

  const [analiz, setAnaliz] = useState<AylikAnaliz | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [hesapAdi, setHesapAdi] = useState("");
  const [paraBirimi, setParaBirimi] = useState("TRY");
  const [bakiye, setBakiye] = useState("");
  const [saving, setSaving] = useState(false);
  const currencyOptions = ['TRY', 'USD', 'EUR', 'GBP'];
  const [balanceEditModalVisible, setBalanceEditModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Pick<Account, "id" | "name"> | null>(null);
  const [newBalanceText, setNewBalanceText] = useState("");
  const [updatingBalance, setUpdatingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketLatestResponse["data"] | null>(null);
  const [marketTs, setMarketTs] = useState<number | null>(null);
  const [marketSource, setMarketSource] = useState<string | null>(null);
  const [categorySummary, setCategorySummary] = useState<CategorySummaryItem[]>([]);
  const [loadingCategorySummary, setLoadingCategorySummary] = useState(true);
  const [graphGroupBy, setGraphGroupBy] = useState<GraphGroupBy>("HESAP");
  const [graphData, setGraphData] = useState<YatirimGraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphShowAll, setGraphShowAll] = useState(false);

  // =========================
  // ✅ HELPERS
  // =========================
  const formatTRY = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const formatCompact = (n: number) => {
    const v = Number.isFinite(n) ? n : 0;
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return formatTRY(v);
  };
  const toNum = (v: any) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
      const normalized = v.replace(/\./g, "").replace(",", ".");
      const n = Number(normalized);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  const formatRateValue = (n?: number) =>
    Number.isFinite(n) ? `₺ ${formatTRY(n as number)}` : "—";
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

  const monthShort = (yilAy: string) => {
    const parts = String(yilAy).split("-");
    const m = Number(parts[1]); // 1..12
    const ayKisa = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return ayKisa[(m || 1) - 1] ?? "Ay";
  };

  const pickCurrentOrLatest = (arr: AylikAnaliz[]) => {
    if (!arr || arr.length === 0) return null;

    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // yilAy "2026-02" / "2026-02-01" / "2026-02-01T00:00:00" => slice(0,7) çalışır
    const current = arr.find((x) => String(x.yilAy).slice(0, 7) === curKey);
    if (current) return current;

    // yoksa en günceli seç
    return [...arr].sort((a, b) => String(a.yilAy).localeCompare(String(b.yilAy))).at(-1) ?? null;
  };
  const getCurrentYM = () => {
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  // =========================
  // ✅ DERIVED (donut)
  // =========================
  const totalIncome = analiz?.aylikGelir ?? 0;
  const totalExpense = analiz?.aylikGider ?? 0;

  const monthLabel = useMemo(() => {
    if (!analiz?.yilAy) return "AYLIK";
    const m = Number(String(analiz.yilAy).split("-")[1]);
    const aylar = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
    return aylar[(m || 1) - 1] ?? "AYLIK";
  }, [analiz?.yilAy]);

  const total = totalIncome + totalExpense;
  const incomePct = total === 0 ? 0 : Math.round((totalIncome / total) * 100);
  const expensePct = total === 0 ? 0 : Math.round((totalExpense / total) * 100);
  const categoryExpenseTotal = useMemo(() => {
    return (categorySummary || [])
      .filter((x) => x.tip === "GIDER")
      .reduce((sum, x) => sum + (Number(x.toplamTutar) || 0), 0);
  }, [categorySummary]);
  const categoryIncomeTotal = useMemo(() => {
    return (categorySummary || [])
      .filter((x) => x.tip === "GELIR")
      .reduce((sum, x) => sum + (Number(x.toplamTutar) || 0), 0);
  }, [categorySummary]);
  const categoryTotal = categoryExpenseTotal + categoryIncomeTotal;
  const categoryExpensePct =
    categoryTotal === 0 ? 0 : Math.round((categoryExpenseTotal / categoryTotal) * 100);
  const giderItems = useMemo(() => {
    return (categorySummary || [])
      .filter((x) => x.tip === "GIDER")
      .sort((a, b) => Number(b.toplamTutar) - Number(a.toplamTutar));
  }, [categorySummary]);
  const expensePalette = useMemo(
    () =>
      mode === "light"
        ? [
            "#fecdd3",
            "#fde68a",
            "#bfdbfe",
            "#bbf7d0",
            "#fed7aa",
            "#ddd6fe",
            "#fbcfe8",
            "#bae6fd",
            "#86efac",
            "#f5d0fe",
          ]
        : [
            "#fb7185",
            "#facc15",
            "#60a5fa",
            "#34d399",
            "#fb923c",
            "#a78bfa",
            "#f472b6",
            "#38bdf8",
            "#22c55e",
            "#e879f9",
          ],
    [mode]
  );
  const ringSize = 160;
  const ringStroke = 16;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const marketUpdatedAt = useMemo(() => {
    if (!marketTs) return null;
    return new Date(marketTs * 1000).toLocaleString("tr-TR");
  }, [marketTs]);
  const graphPoints = graphData?.points ?? [];
  const graphVisiblePoints = graphShowAll ? graphPoints : graphPoints.slice(0, 10);
  const chartPoints = useMemo(() => {
    const base = graphVisiblePoints.slice(0, 3).map((p) => ({
      label: p.label,
      karZarar: p.karZarar,
    }));
    if (base.length === 3) return base;

    const fallbackLabels = [
      ...accounts.map((a) => a.name).filter((name) => Boolean(String(name).trim())),
      "Hesap 1",
      "Hesap 2",
      "Hesap 3",
    ]
      .slice(0, 3)
      .map(String);

    const demoValues = [1500, 0, -700];
    const filled = fallbackLabels.map((label, idx) => ({
      label,
      karZarar: demoValues[idx],
    }));
    return filled;
  }, [graphVisiblePoints, accounts]);
  const graphChartData = chartPoints.map((p) => toNum(p.karZarar));
  const graphMax = Math.max(0, ...graphChartData.map((v) => Math.abs(v)));
  const chipIntensity = (v: number) => {
    if (graphMax <= 0) return 0;
    return Math.min(1, Math.abs(v) / graphMax);
  };
  const totalMaliyet = toNum(graphData?.toplamMaliyet);
  const totalGuncel = toNum(graphData?.toplamGuncelDeger);
  const totalKarZarar = toNum(graphData?.toplamKarZarar);
  const karZararPositive = totalKarZarar >= 0;

  // =========================
  // ✅ FETCH: ACCOUNTS
  // =========================
  const fetchAccounts = useCallback(async () => {
    setLoadingAccount(true);
    try {
      const res = await api.get("/api/hesaplar");
      const list: Hesap[] = res.data;

      setAccounts(
        (list ?? []).map((h) => ({
          id: String(h.hesapId),
          name: h.hesapAdi,
          balance: Number(h.bakiye),
          currency: h.paraBirimi === "TRY" ? " TL" : ` ${h.paraBirimi}`,
        }))
      );

      setModalVisible(!list || list.length === 0);
    } catch (err: any) {
      console.log("Hesaplar çekme hata:", err?.response?.data || err?.message);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  // =========================
  // ✅ FETCH: LAST 6 MONTHS
  // =========================
  const fetchSon6Ay = useCallback(async () => {
    setLoading6Ay(true);
    try {
      const res = await api.get("/api/aylik-analiz");
      const arr = Array.isArray(res.data) ? res.data : [];

      const normalized: AylikAnaliz[] = arr.map((x: any) => ({
          yilAy: String(x.yilAy),
          aylikGelir: Number(x.aylikGelir) || 0,
          aylikGider: Number(x.aylikGider) || 0,
      }));

        setSon6Ay(buildLast6MonthsFilled(normalized));
      } catch (err: any) {
        console.log("Son 6 ay analiz hata:", err?.response?.status, err?.response?.data || err?.message);
        setSon6Ay([]);
      } finally {
        setLoading6Ay(false);
      }
    }, []);
  const fetchUserInfo = useCallback(async () => {
  setLoadingUserInfo(true);
  try {
    const res = await api.get("/api/userinfo");
    setUserInfo(res.data);
  } catch (err: any) {
    console.log("Userinfo çekme hata:", err?.response?.data || err?.message);
    setUserInfo(null);
  } finally {
    setLoadingUserInfo(false);
  }
}, []);
  const fetchMarket = useCallback(async () => {
  setMarketLoading(true);
  try {
    const res = await api.get(`${marketBaseUrl}/api/market/latest`);
    const payload: MarketLatestResponse = res.data;
    if (payload?.ok && payload?.data) {
      setMarketData(payload.data);
      setMarketTs(Number(payload?.ts) || null);
      setMarketSource(payload?.source ?? null);
    }
  } catch (err: any) {
    console.log("Market latest hata:", err?.response?.data || err?.message);
    // Hata olursa mevcut veriyi koru; son güncelleme boş kalmasın
  } finally {
    setMarketLoading(false);
  }
}, [marketBaseUrl]);
  const fetchCategorySummaryMonthly = useCallback(async () => {
  setLoadingCategorySummary(true);
  try {
    const yilAy = getCurrentYM();
    const res = await api.get("/api/categorysummary/monthly", {
      params: { yilAy },
    });
    const arr = Array.isArray(res.data) ? res.data : [];
    const normalized: CategorySummaryItem[] = arr.map((x: any) => ({
      kategoriId: Number(x.kategoriId),
      kategoriAd: String(x.kategoriAd ?? ""),
      tip: x.tip === "GELIR" ? "GELIR" : "GIDER",
      toplamTutar: Number(x.toplamTutar) || 0,
    }));
    setCategorySummary(normalized);
  } catch (err: any) {
    console.log("Category summary hata:", err?.response?.data || err?.message);
    setCategorySummary([]);
  } finally {
    setLoadingCategorySummary(false);
  }
}, []);
  const fetchYatirimGraph = useCallback(async (groupBy: GraphGroupBy) => {
  setGraphLoading(true);
  setGraphError(null);
  try {
    const res = await api.get("/api/yatirim/graph", { params: { groupBy } });
    setGraphData(res.data ?? null);
  } catch (err: any) {
    console.log("Yatırım graph hata:", err?.response?.data || err?.message);
    setGraphError("Yatırım grafiği yüklenemedi.");
    setGraphData(null);
  } finally {
    setGraphLoading(false);
  }
}, []);
  // =========================
  // ✅ EFFECTS
  // =========================
  useEffect(() => {
    fetchAccounts();
    fetchSon6Ay();
    fetchUserInfo();
    fetchMarket();
    fetchCategorySummaryMonthly();
    fetchYatirimGraph(graphGroupBy);
  }, [
    fetchAccounts,
    fetchSon6Ay,
    fetchUserInfo,
    fetchMarket,
    fetchCategorySummaryMonthly,
    fetchYatirimGraph,
    graphGroupBy,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchAccounts(),
        fetchSon6Ay(),
        fetchUserInfo(),
        fetchMarket(),
        fetchCategorySummaryMonthly(),
        fetchYatirimGraph(graphGroupBy),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchAccounts,
    fetchSon6Ay,
    fetchUserInfo,
    fetchMarket,
    fetchCategorySummaryMonthly,
    fetchYatirimGraph,
    graphGroupBy,
  ]);

  // son6Ay gelince donut için analiz seç
useEffect(() => {
  if (!loading6Ay) {
    setAnaliz(son6Ay.length ? son6Ay[son6Ay.length - 1] : null);
  }
}, [son6Ay, loading6Ay]);

  // =========================
  // ✅ CHART (dynamic)
  // =========================
  const months = useMemo(() => son6Ay.map((x) => monthShort(x.yilAy)), [son6Ay]);
  const incomes = useMemo(() => son6Ay.map((x) => x.aylikGelir || 0), [son6Ay]);
  const expenses = useMemo(() => son6Ay.map((x) => x.aylikGider || 0), [son6Ay]);

  const maxVal = Math.max(0, ...incomes, ...expenses);

  const calcHeight = (v: number) => {
    if (maxVal <= 0) return 0;
    return Math.max(6, Math.round((v / maxVal) * 90));
  };

  // =========================
  // ✅ CREATE ACCOUNT
  // =========================
  const createHesap = async () => {
    if (saving) return;
    if (!hesapAdi.trim() || !paraBirimi.trim() || bakiye.trim() === "") return;

    const bakiyeNum = Number(bakiye.replace(",", "."));
    if (Number.isNaN(bakiyeNum) || bakiyeNum < 0) return;

    setSaving(true);
    try {
      await api.post("/api/hesaplar", {
        hesapAdi: hesapAdi.trim(),
        aileId: null,
        paraBirimi: paraBirimi.trim().toUpperCase(),
        bakiye: bakiyeNum,
      });

      setHesapAdi("");
      setParaBirimi("TRY");
      setBakiye("");
      setModalVisible(false);

      fetchAccounts();
    } catch (err: any) {
      console.log("Hesap oluşturma hata:", err?.response?.data || err?.message);
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // ? UPDATE BALANCE
  // =========================
  const openBalanceModal = (account: Account) => {
    setSelectedAccount({ id: account.id, name: account.name });
    setNewBalanceText(String(account.balance ?? ""));
    setBalanceEditModalVisible(true);
  };

  const patchBalance = async () => {
    if (updatingBalance || !selectedAccount) return;
    if (!newBalanceText.trim()) return;
    const bakiyeNum = Number(newBalanceText.replace(",", "."));
    if (Number.isNaN(bakiyeNum) || bakiyeNum < 0) return;

    setUpdatingBalance(true);
    try {
      await api.patch(`/api/hesaplar/${selectedAccount.id}/bakiye`, { bakiye: bakiyeNum });
      setAccounts((prev) =>
        prev.map((a) => (a.id === selectedAccount.id ? { ...a, balance: bakiyeNum } : a))
      );
      setBalanceEditModalVisible(false);
      setSelectedAccount(null);
      setNewBalanceText("");
      fetchAccounts();
    } catch (err: any) {
      console.log("Bakiye güncelleme hata:", err?.response?.data || err?.message);
    } finally {
      setUpdatingBalance(false);
    }
  };
const addMonths = (d: Date, diff: number) => {
  const x = new Date(d.getFullYear(), d.getMonth() + diff, 1);
  return x;
};

const formatYM = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// ✅ Bu ay dahil son 6 ayı üretir, backend verisi yoksa 0 yazar

const buildLast6MonthsFilled = (raw: AylikAnaliz[] | null | undefined): AylikAnaliz[] => {
  const safeRaw = Array.isArray(raw) ? raw : [];

  const ymKey = (yilAy: string) => String(yilAy).slice(0, 7); // "YYYY-MM"
  const addMonths = (d: Date, diff: number) => new Date(d.getFullYear(), d.getMonth() + diff, 1);
  const formatYM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const map = new Map<string, AylikAnaliz>();
  safeRaw.forEach((x) => map.set(ymKey(x.yilAy), x));

  const now = new Date();
  const list: AylikAnaliz[] = [];

  for (let i = 5; i >= 0; i--) {
    const dt = addMonths(now, -i);
    const key = formatYM(dt);

    const found = map.get(key);
    list.push(
      found ?? {
        yilAy: `${key}-01`,
        aylikGelir: 0,
        aylikGider: 0,
      }
    );
  }

  return list;
};


  // =========================
  // ✅ UI
  // =========================
  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="CÜZDAN "
        subtitle={
          loadingUserInfo
            ? "YÜKLENİYOR..."
            : userInfo
            ? `${userInfo.ad} ${userInfo.soyad}`
            : "Kullanıcı"
        }
        right={<HeaderAction label="Menü" onPress={() => navigation.navigate("Menu")} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.warning}
          />
        }
      >
        {/* AYLIK ÖZET */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{monthLabel} GELİR / GİDER</Text>
            <Text style={styles.badge}>{monthLabel}</Text>
          </View>

          <View style={styles.row}>
            <View style={{ width: 160, height: 160 }}>
              <Progress.Circle
                size={160}
                thickness={16}
                progress={incomePct / 100}
                color={colors.warning}
                unfilledColor={colors.danger}
                borderWidth={0}
                showsText={false}
              />

              <View style={styles.donutCenter}>
                <Text style={styles.donutCenterTitle}>{monthLabel}</Text>
                <Text style={styles.donutCenterSub}>
                  {loading6Ay ? "YÜKLENİYOR..." : analiz ? "GELİR / GİDER" : "VERİ YOK"}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, paddingLeft: 14 }}>
              <Text style={styles.kpiLabel}>Aylık Gelir</Text>
              <Text style={styles.kpiValue}>+ {formatTRY(totalIncome)} TL</Text>

              <View style={{ height: 10 }} />

              <Text style={styles.kpiLabel}>Aylık Gider</Text>
              <Text style={styles.kpiValueDanger}>- {formatTRY(totalExpense)} TL</Text>

              <View style={{ height: 14 }} />

              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                <Text style={styles.legendText}>Gelir {incomePct}%</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                <Text style={styles.legendText}>Gider {expensePct}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 6 AYLIK KARŞILAŞTIRMA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SON 6 AY Karşılaştırma</Text>

          <View style={styles.chartArea}>
            {loading6Ay ? (
              <Text style={{ color: colors.textMuted }}>Yükleniyor...</Text>
            ) : months.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Veri yok</Text>
            ) : (
              months.map((m, i) => {
                const incH = calcHeight(incomes[i]);
                const expH = calcHeight(expenses[i]);

                return (
                  <View key={`${m}-${i}`} style={styles.chartCol}>
                    <View style={styles.barGroup}>
                      <View style={[styles.barIncome, { height: incH }]} />
                      <View style={{ width: 6 }} />
                      <View style={[styles.barExpense, { height: expH }]} />
                    </View>
                    <Text style={styles.chartLabel}>{m}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.chartLegendRow}>
            <View style={styles.legendItem}>
              <View style={styles.legendSwatchIncome} />
              <Text style={styles.legendText2}>Gelir</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendSwatchExpense} />
              <Text style={styles.legendText2}>Gider</Text>
            </View>
          </View>
        </View>

        {/* HARCAMALAR NEREYE GİDİYOR? */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>HARCAMALAR NEREYE GİDİYOR?</Text>

          {loadingCategorySummary ? (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>Yükleniyor...</Text>
          ) : giderItems.length === 0 ? (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>Bu ay gider verisi yok</Text>
          ) : (
            <View style={styles.categoryDonutRow}>
              <View style={styles.categoryDonutWrap}>
                <Svg width={ringSize} height={ringSize}>
                  <G rotation={-90} origin={`${ringSize / 2}, ${ringSize / 2}`}>
                    <Circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={ringRadius}
                      stroke={colors.divider}
                      strokeWidth={ringStroke}
                      fill="transparent"
                    />
                    {categoryExpenseTotal > 0 &&
                      giderItems.reduce<{ offset: number; nodes: React.ReactNode[] }>(
                        (acc, item, index) => {
                          const rawLen = (item.toplamTutar / categoryExpenseTotal) * ringCircumference;
                          const gap = 4;
                          const segLen = Math.max(0, rawLen - gap);
                          if (segLen > 0) {
                            acc.nodes.push(
                              <Circle
                                key={item.kategoriId}
                                cx={ringSize / 2}
                                cy={ringSize / 2}
                                r={ringRadius}
                                stroke={expensePalette[index % expensePalette.length]}
                                strokeWidth={ringStroke}
                                strokeDasharray={`${segLen} ${ringCircumference - segLen}`}
                                strokeDashoffset={-acc.offset}
                                strokeLinecap="round"
                                fill="transparent"
                              />
                            );
                          }
                          acc.offset += rawLen;
                          return acc;
                        },
                        { offset: 0, nodes: [] }
                      ).nodes}
                  </G>
                </Svg>
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterTitle}>Toplam Gider</Text>
                  <Text style={styles.donutCenterSub}>₺ {formatTRY(categoryExpenseTotal)}</Text>
                </View>
              </View>

              <ScrollView
                style={styles.categoryList}
                contentContainerStyle={styles.categoryListContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {giderItems.map((item, index) => {
                  const pct = categoryExpenseTotal
                    ? Math.round((item.toplamTutar / categoryExpenseTotal) * 100)
                    : 0;
                  const color = expensePalette[index % expensePalette.length];
                  return (
                    <View key={item.kategoriId} style={styles.categoryRow}>
                      <View style={[styles.categoryBadge, { backgroundColor: color }]}>
                        <Text style={styles.categoryBadgeText}>
                          {item.kategoriAd?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.categoryName} numberOfLines={1}>
                          {item.kategoriAd}
                        </Text>
                        <Text style={styles.categoryAmount}>₺ {formatTRY(item.toplamTutar)}</Text>
                      </View>
                      <Text style={styles.categoryPct}>%{pct}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

        </View>


                {/* GÜNCEL KURLAR */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Güncel Kurlar</Text>
              <Text style={styles.cardSubtitle}>Döviz ve altın (anlık)</Text>
              {!!marketUpdatedAt && (
                <Text style={styles.cardSubtitle}>Son güncelleme: {marketUpdatedAt}</Text>
              )}
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>Anlık</Text>
            </View>
          </View>

          <View style={styles.rateGrid}>
            <View style={styles.rateCard}>
              <View style={styles.rateTop}>
                <View style={styles.rateIcon}>
                  <Text style={styles.rateIconText}>USD</Text>
                </View>
                <Text style={styles.rateCode}>Dolar / TL</Text>
              </View>
              <Text style={styles.rateValue}>
                {marketLoading ? "YÜKLENİYOR..." : formatRateValue(getRate(["USDTRY", "USD/TRY", "USD_TRY"]))}
              </Text>
            </View>

            <View style={styles.rateCard}>
              <View style={styles.rateTop}>
                <View style={styles.rateIcon}>
                  <Text style={styles.rateIconText}>EUR</Text>
                </View>
                <Text style={styles.rateCode}>Euro / TL</Text>
              </View>
              <Text style={styles.rateValue}>
                {marketLoading ? "YÜKLENİYOR..." : formatRateValue(getRate(["EURTRY", "EUR/TRY", "EUR_TRY"]))}
              </Text>
            </View>

            <View style={styles.rateCard}>
              <View style={styles.rateTop}>
                <View style={styles.rateIcon}>
                  <Text style={styles.rateIconText}>GBP</Text>
                </View>
                <Text style={styles.rateCode}>Sterlin / TL</Text>
              </View>
              <Text style={styles.rateValue}>
                {marketLoading ? "YÜKLENİYOR..." : formatRateValue(getRate(["GBPTRY", "GBP/TRY", "GBP_TRY"]))}
              </Text>
            </View>

            <View style={styles.rateCard}>
              <View style={styles.rateTop}>
                <View style={styles.rateIconAltin}>
                  <Text style={styles.rateIconTextAltin}>ALTIN</Text>
                </View>
                <Text style={styles.rateCode}>Gram Altın</Text>
              </View>
              <Text style={styles.rateValue}>
                {marketLoading
                  ? "YÜKLENİYOR..."
                  : formatRateValue(
                      getRate([
                        "GRAM_ALTIN_TRY",
                        "GRAM_ALTIN",
                        "GRAM/TRY",
                        "XAU_TRY",
                        "XAUTRY",
                      ])
                    )}
              </Text>
            </View>
          </View>
        </View>

        {/* YATIRIM GRAFİĞİ */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Yatırım Grafiği</Text>
              <Text style={styles.cardSubtitle}>Portföy özeti</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{graphGroupBy}</Text>
            </View>
          </View>

          <View style={styles.segmentWrap}>
            <TouchableOpacity
              style={[styles.segmentBtn, graphGroupBy === "HESAP" && styles.segmentBtnActive]}
              onPress={() => setGraphGroupBy("HESAP")}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, graphGroupBy === "HESAP" && styles.segmentTextActive]}>
                Hesap
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, graphGroupBy === "VARLIK" && styles.segmentBtnActive]}
              onPress={() => setGraphGroupBy("VARLIK")}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, graphGroupBy === "VARLIK" && styles.segmentTextActive]}>
                Varlık
              </Text>
            </TouchableOpacity>
          </View>

          {graphLoading ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : graphError ? (
            <Text style={styles.errorText}>{graphError}</Text>
          ) : (
            <>
              <View style={styles.chartCard}>
                <View style={styles.chartHeaderRow}>
                  <Text style={styles.chartTitle}>Kâr/Zarar Dağılımı</Text>
                  <Text style={styles.chartHint}>En yüksek {chartPoints.length}</Text>
                </View>
                {graphChartData.length === 0 ? (
                  <Text style={styles.chartEmpty}>Grafik verisi yok.</Text>
                ) : (
                  <View style={styles.chartList}>
                    {chartPoints.map((p, i) => {
                      const v = toNum(p.karZarar);
                      const pct = graphMax > 0 ? Math.min(1, Math.abs(v) / graphMax) : 0;
                      return (
                        <View key={`${p.label}-${i}`} style={styles.chartRow}>
                          <View style={styles.chartRowTop}>
                            <Text style={styles.chartRowLabel} numberOfLines={1}>
                              {p.label}
                            </Text>
                            <Text style={[styles.chartRowValue, v >= 0 ? styles.kzUp : styles.kzDown]}>
                              ₺ {formatTRY(v)}
                            </Text>
                          </View>
                          <View style={styles.chartBarTrack}>
                            <View
                              style={[
                                styles.chartBarFill,
                                v >= 0 ? styles.chartBarFillUp : styles.chartBarFillDown,
                                { width: `${Math.round(pct * 100)}%` },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.graphListHeader}>
                <View style={styles.graphHeaderLeft}>
                  <Text style={styles.graphListTitle}>Detaylar</Text>
                  <View style={styles.graphCountBadge}>
                    <Text style={styles.graphCountText}>{graphPoints.length}</Text>
                  </View>
                </View>
                {graphPoints.length > 10 && (
                  <TouchableOpacity onPress={() => setGraphShowAll((p) => !p)} activeOpacity={0.85}>
                    <Text style={styles.graphLink}>{graphShowAll ? "İlk 10" : "Tümü"}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.graphDetailCarousel}
              >
                {graphVisiblePoints.map((p, idx) => {
                  const kz = toNum(p.karZarar);
                  return (
                    <View key={`${p.label}-${idx}`} style={styles.graphDetailCard}>
                      <View style={styles.graphDetailHeader}>
                        <Text style={styles.graphDetailTitle} numberOfLines={2}>
                          {p.label}
                        </Text>
                        <View style={[styles.karBadge, kz >= 0 ? styles.karBadgeUp : styles.karBadgeDown]}>
                          <Text style={styles.karBadgeText}>{kz >= 0 ? "Kâr" : "Zarar"}</Text>
                        </View>
                      </View>

                      <View style={styles.graphMetricRow}>
                        <View style={styles.graphMetricPill}>
                          <Text style={styles.graphMetricLabel}>Maliyet</Text>
                          <Text style={styles.graphMetricValue}>₺ {formatCompact(toNum(p.toplamMaliyet))}</Text>
                        </View>
                        <View style={styles.graphMetricPill}>
                          <Text style={styles.graphMetricLabel}>Güncel</Text>
                          <Text style={styles.graphMetricValue}>₺ {formatCompact(toNum(p.guncelDeger))}</Text>
                        </View>
                        <View style={styles.graphMetricPill}>
                          <Text style={styles.graphMetricLabel}>K/Z</Text>
                          <Text style={[styles.graphMetricValue, kz >= 0 ? styles.kzUp : styles.kzDown]}>
                            ₺ {formatCompact(kz)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>

      </ScrollView>
      {/* Chat Button */}
      <TouchableOpacity
        style={styles.chatFab}
        onPress={() => navigation.navigate("Chat")}
        activeOpacity={1}
      >
        <View style={styles.chatFabGlow} />
        <View style={styles.chatIcon}>
          <View style={styles.chatBubble}>
            <View style={styles.chatDotRow}>
              <View style={styles.chatDot} />
              <View style={styles.chatDot} />
              <View style={styles.chatDot} />
            </View>
          </View>
          <View style={styles.chatTail} />
        </View>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
<View style={styles.sheet}>
  <Text style={styles.sheetTitle}>Hesap Oluştur</Text>

  <TextInput
    style={styles.input}
    placeholder="Hesap Adı (örn: Nakit Kasa)"
    placeholderTextColor={colors.textMuted}
    value={hesapAdi}
    onChangeText={setHesapAdi}
  />

  <Text style={styles.inputLabel}>Para Birimi</Text>

  <View style={styles.currencyRow}>
    {currencyOptions.map((c) => {
      const active = paraBirimi === c;
      return (
        <TouchableOpacity
          key={c}
          style={[styles.currencyBtn, active && styles.currencyBtnActive]}
          onPress={() => setParaBirimi(c)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.currencyBtnText,
              active && styles.currencyBtnTextActive,
            ]}
          >
            {c}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>

  <TextInput
    style={styles.input}
    placeholder="Başlangıç Bakiyesi"
    placeholderTextColor={colors.textMuted}
    value={bakiye}
    onChangeText={setBakiye}
    keyboardType="numeric"
  />

  <TouchableOpacity
    style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
    onPress={createHesap}
    disabled={saving}
  >
    {saving ? (
      <ActivityIndicator color={colors.onAccent} />
    ) : (
      <Text style={styles.primaryBtnText}>Kaydet</Text>
    )}
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.cancelBtn}
    onPress={() => setModalVisible(false)}
    disabled={saving}
  >
    <Text style={styles.cancelText}>Vazgeç</Text>
  </TouchableOpacity>
</View>

        </View>
      </Modal>

      {/* Balance Update Modal */}
      <Modal visible={balanceEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Bakiye Güncelle</Text>
            <Text style={styles.inputLabel}>
              {selectedAccount ? selectedAccount.name : "Hesap"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Yeni Bakiye"
              placeholderTextColor={colors.textMuted}
              value={newBalanceText}
              onChangeText={setNewBalanceText}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, updatingBalance && { opacity: 0.6 }]}
              onPress={patchBalance}
              disabled={updatingBalance}
            >
              {updatingBalance ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>Kaydet</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setBalanceEditModalVisible(false)}
              disabled={updatingBalance}
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, mode: ThemeMode) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  topBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: { color: colors.textMuted, fontSize: 18 },
  topBarCenter: { alignItems: "center" },
  topTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  topSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  icon: { color: colors.text, fontSize: 22 },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "800", letterSpacing: 0.6 },
  cardSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sectionBadgeText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  badge: {
    color: colors.onAccent,
    backgroundColor: colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontWeight: "800",
    fontSize: 12,
  },

  row: { flexDirection: "row", marginTop: 14, alignItems: "center" },

  donutPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 160,
    borderWidth: 16,
    borderColor: colors.divider,
  },
  donutCenter: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenterTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  donutCenterSub: { color: colors.textMuted, marginTop: 4, fontSize: 12 },

  kpiLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  kpiValue: { color: colors.warning, fontSize: 16, fontWeight: "800", marginTop: 2 },
  kpiValueDanger: { color: colors.danger, fontSize: 16, fontWeight: "800", marginTop: 2 },

  legendRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  legendText: { color: colors.textMuted, fontSize: 12 },

  chartArea: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    height: 130,
  },
  chartCol: { width: 42, alignItems: "center", justifyContent: "flex-end" },
  barGroup: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", height: 100 },
  barIncome: { width: 12, borderRadius: 8, backgroundColor: colors.warning, opacity: 0.95 },
  barExpense: { width: 12, borderRadius: 8, backgroundColor: colors.danger, opacity: 0.95 },
  chartLabel: { marginTop: 8, color: colors.textMuted, fontSize: 12, fontWeight: "700" },

  chartLegendRow: { marginTop: 12, flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendSwatchIncome: { width: 12, height: 12, borderRadius: 4, backgroundColor: colors.warning },
  legendSwatchExpense: { width: 12, height: 12, borderRadius: 4, backgroundColor: colors.danger },
  legendText2: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  loadingInline: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  categoryDonutRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
  },
  categoryDonutWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  categoryList: {
    flex: 1,
    maxHeight: 200,
  },
  categoryListContent: {
    gap: 10,
    justifyContent: "center",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadgeText: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: "900",
  },
  categoryName: { color: colors.text, fontSize: 12, fontWeight: "800" },
  categoryAmount: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: "700" },
  categoryPct: { color: colors.text, fontSize: 12, fontWeight: "900" },
  rateGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  rateCard: {
    width: "48%",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  rateTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rateIcon: {
    height: 22,
    paddingHorizontal: 8,
    minWidth: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  rateIconAltin: {
    height: 22,
    paddingHorizontal: 8,
    minWidth: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  rateIconText: {
    color: colors.warning,
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
  rateIconTextAltin: {
    color: colors.success,
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
  rateCode: { color: colors.textMuted, fontSize: 12, fontWeight: "800", flexShrink: 1 },
  rateValue: { marginTop: 8, color: colors.text, fontSize: 16, fontWeight: "900" },
  rateChangeUp: { marginTop: 4, color: colors.success, fontSize: 12, fontWeight: "800" },
  rateChangeDown: { marginTop: 4, color: colors.danger, fontSize: 12, fontWeight: "800" },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning,
  },
  accountIconText: { color: colors.onAccent, fontSize: 16, fontWeight: "900" },
  accountName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  accountSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
  accountBalance: { color: colors.text, fontSize: 16, fontWeight: "900" },
  accountCurrency: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: "700" },
  accountCarousel: { marginTop: 10, paddingRight: 16, gap: 12 },
  accountCardH: {
    width: 240,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  accountBadgeText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  updateBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  updateBtnText: { color: colors.warning, fontSize: 11, fontWeight: "900" },
  chatFab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: "hidden",
  },
  chatIcon: { alignItems: "center", justifyContent: "center" },
  chatBubble: {
    width: 22,
    height: 18,
    borderRadius: 8,
    backgroundColor: colors.onAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  chatDotRow: { flexDirection: "row", gap: 4 },
  chatDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  chatTail: {
    width: 6,
    height: 6,
    backgroundColor: colors.onAccent,
    transform: [{ rotate: "45deg" }],
    marginTop: -2,
    marginLeft: 7,
    borderBottomRightRadius: 2,
  },
  chatFabGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.warning,
    opacity: 0.35,
    top: -30,
    right: -30,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: mode === "light" ? "rgba(15,23,42,0.35)" : "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "50%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 12 },  input: { backgroundColor: colors.surfaceAlt, color: colors.text, padding: 14, borderRadius: 12, marginBottom: 10 },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  currencyRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  currencyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
  },
  currencyBtnActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  currencyBtnText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },
  currencyBtnTextActive: { color: colors.onAccent },

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
  errorText: { color: colors.danger, fontSize: 12, fontWeight: "800", marginTop: 8 },
  segmentWrap: {
    marginTop: 12,
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentBtnActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: colors.text },
  graphKpiRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  graphKpiCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  graphKpiWide: {
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  graphKpiLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  graphKpiValue: { color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 6 },
  karRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
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
    marginTop: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chartTitle: { color: colors.text, fontSize: 12, fontWeight: "900", marginBottom: 6 },
  chartHint: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  chartEmpty: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  chartList: { gap: 10, marginTop: 6 },
  chartRow: { gap: 6 },
  chartRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chartRowLabel: { color: colors.text, fontSize: 12, fontWeight: "800", flex: 1, marginRight: 8 },
  chartRowValue: { fontSize: 12, fontWeight: "900" },
  chartBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  chartBarFill: { height: "100%", borderRadius: 999 },
  chartBarFillUp: { backgroundColor: colors.success },
  chartBarFillDown: { backgroundColor: colors.danger },
  chipGrid: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    width: "48%",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipPos: { backgroundColor: colors.success },
  chipNeg: { backgroundColor: colors.danger },
  chipLabel: { color: colors.onAccent, fontSize: 11, fontWeight: "900" },
  chipValue: { color: colors.onAccent, fontSize: 12, fontWeight: "800", marginTop: 6 },
  graphListHeader: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  graphHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  graphListTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  graphCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  graphCountText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  graphLink: { color: colors.warning, fontSize: 12, fontWeight: "900" },
  graphDetailCarousel: { marginTop: 8, paddingRight: 16, gap: 12 },
  graphDetailCard: {
    width: 260,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  graphDetailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  graphDetailTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "900" },
  graphMetricRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  graphMetricPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  graphMetricLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800" },
  graphMetricValue: { color: colors.text, fontSize: 12, fontWeight: "900", marginTop: 4 },
  kzUp: { color: colors.success },
  kzDown: { color: colors.danger },
});


