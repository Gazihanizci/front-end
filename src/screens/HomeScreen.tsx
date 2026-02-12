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

type Props = NativeStackScreenProps<RootStackParamList, "Home">;
export default function HomeScreen({ navigation }: Props) {
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

  // =========================
  // ✅ HELPERS
  // =========================
  const formatTRY = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
  const expensePalette = [
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
  ];
  const ringSize = 160;
  const ringStroke = 16;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const marketUpdatedAt = useMemo(() => {
    if (!marketTs) return null;
    return new Date(marketTs * 1000).toLocaleString("tr-TR");
  }, [marketTs]);

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
  // =========================
  // ✅ EFFECTS
  // =========================
  useEffect(() => {
    fetchAccounts();
    fetchSon6Ay();
    fetchUserInfo();
    fetchMarket();
    fetchCategorySummaryMonthly();
  }, [fetchAccounts, fetchSon6Ay, fetchUserInfo, fetchMarket, fetchCategorySummaryMonthly]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchAccounts(),
        fetchSon6Ay(),
        fetchUserInfo(),
        fetchMarket(),
        fetchCategorySummaryMonthly(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAccounts, fetchSon6Ay, fetchUserInfo, fetchMarket, fetchCategorySummaryMonthly]);

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
        left={<HeaderAction label="Menü" onPress={() => navigation.navigate("Menu")} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#facc15"
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
                color="#facc15"
                unfilledColor="#fb7185"
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
                <View style={[styles.legendDot, { backgroundColor: "#facc15" }]} />
                <Text style={styles.legendText}>Gelir {incomePct}%</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: "#fb7185" }]} />
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
              <Text style={{ color: "#94a3b8" }}>Yükleniyor...</Text>
            ) : months.length === 0 ? (
              <Text style={{ color: "#94a3b8" }}>Veri yok</Text>
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
            <Text style={{ color: "#94a3b8", marginTop: 10 }}>Yükleniyor...</Text>
          ) : giderItems.length === 0 ? (
            <Text style={{ color: "#94a3b8", marginTop: 10 }}>Bu ay gider verisi yok</Text>
          ) : (
            <View style={styles.categoryDonutRow}>
              <View style={styles.categoryDonutWrap}>
                <Svg width={ringSize} height={ringSize}>
                  <G rotation={-90} origin={`${ringSize / 2}, ${ringSize / 2}`}>
                    <Circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={ringRadius}
                      stroke="rgba(148,163,184,0.18)"
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

        {/* HESAPLARIM */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>HESAPLARIM</Text>
              <Text style={styles.cardSubtitle}>Banka ve nakit hesapların</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{accounts.length}</Text>
            </View>
          </View>

          {loadingAccount ? (
            <Text style={{ color: "#94a3b8", marginTop: 10 }}>Yükleniyor...</Text>
          ) : accounts.length === 0 ? (
            <Text style={{ color: "#94a3b8", marginTop: 10 }}>
              Hesap yok. + ile ekleyebilirsin.
            </Text>
          ) : (
            <View style={{ marginTop: 10, gap: 10 }}>
              {accounts.map((a) => (
                <TouchableOpacity key={a.id} style={styles.accountCard} activeOpacity={0.8}>
                  <View style={styles.accountIcon}>
                    <Text style={styles.accountIconText}>{a.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{a.name}</Text>
                    <Text style={styles.accountSub}>Bakiye</Text>
                  </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.accountBalance}>
                        {formatTRY(a.balance)}
                        {a.currency}
                      </Text>
                      <Text style={styles.accountCurrency}>{a.currency.trim()}</Text>
                      <TouchableOpacity
                        style={styles.updateBtn}
                        onPress={() => openBalanceModal(a)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.updateBtnText}>Güncelle</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </View>
      </ScrollView>
      {/* Floating Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
<View style={styles.sheet}>
  <Text style={styles.sheetTitle}>Hesap Oluştur</Text>

  <TextInput
    style={styles.input}
    placeholder="Hesap Adı (örn: Nakit Kasa)"
    placeholderTextColor="#9ca3af"
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
    placeholderTextColor="#9ca3af"
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
      <ActivityIndicator color="#000" />
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
              placeholderTextColor="#9ca3af"
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
                <ActivityIndicator color="#000" />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0f1a" },

  topBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: { color: "#cbd5e1", fontSize: 18 },
  topBarCenter: { alignItems: "center" },
  topTitle: { color: "#e5e7eb", fontSize: 18, fontWeight: "700" },
  topSub: { color: "#94a3b8", fontSize: 13, marginTop: 2 },
  icon: { color: "#e5e7eb", fontSize: 22 },

  card: {
    backgroundColor: "#0f172a",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#e5e7eb", fontSize: 14, fontWeight: "800", letterSpacing: 0.6 },
  cardSubtitle: { color: "#94a3b8", fontSize: 12, marginTop: 4, fontWeight: "700" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.18)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
  },
  sectionBadgeText: { color: "#e5e7eb", fontSize: 12, fontWeight: "900" },
  badge: {
    color: "#0b0f1a",
    backgroundColor: "#facc15",
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
    borderColor: "rgba(148,163,184,0.18)",
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
  donutCenterTitle: { color: "#e5e7eb", fontWeight: "800", fontSize: 14 },
  donutCenterSub: { color: "#94a3b8", marginTop: 4, fontSize: 12 },

  kpiLabel: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  kpiValue: { color: "#facc15", fontSize: 16, fontWeight: "800", marginTop: 2 },
  kpiValueDanger: { color: "#fb7185", fontSize: 16, fontWeight: "800", marginTop: 2 },

  legendRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  legendText: { color: "#cbd5e1", fontSize: 12 },

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
  barIncome: { width: 12, borderRadius: 8, backgroundColor: "#facc15", opacity: 0.95 },
  barExpense: { width: 12, borderRadius: 8, backgroundColor: "#fb7185", opacity: 0.95 },
  chartLabel: { marginTop: 8, color: "#64748b", fontSize: 12, fontWeight: "700" },

  chartLegendRow: { marginTop: 12, flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendSwatchIncome: { width: 12, height: 12, borderRadius: 4, backgroundColor: "#facc15" },
  legendSwatchExpense: { width: 12, height: 12, borderRadius: 4, backgroundColor: "#fb7185" },
  legendText2: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
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
    color: "#0b0f1a",
    fontSize: 12,
    fontWeight: "900",
  },
  categoryName: { color: "#e5e7eb", fontSize: 12, fontWeight: "800" },
  categoryAmount: { color: "#94a3b8", fontSize: 11, marginTop: 2, fontWeight: "700" },
  categoryPct: { color: "#e5e7eb", fontSize: 12, fontWeight: "900" },
  rateGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  rateCard: {
    width: "48%",
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
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
    backgroundColor: "rgba(250,204,21,0.15)",
  },
  rateIconAltin: {
    height: 22,
    paddingHorizontal: 8,
    minWidth: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  rateIconText: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
  rateIconTextAltin: {
    color: "#22c55e",
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
  rateCode: { color: "#cbd5e1", fontSize: 12, fontWeight: "800", flexShrink: 1 },
  rateValue: { marginTop: 8, color: "#e5e7eb", fontSize: 16, fontWeight: "900" },
  rateChangeUp: { marginTop: 4, color: "#22c55e", fontSize: 12, fontWeight: "800" },
  rateChangeDown: { marginTop: 4, color: "#fb7185", fontSize: 12, fontWeight: "800" },  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
  },
  accountIconText: { color: "#0b0f1a", fontSize: 16, fontWeight: "900" },
  accountName: { color: "#e5e7eb", fontSize: 15, fontWeight: "800" },
  accountSub: { color: "#94a3b8", fontSize: 12, marginTop: 4, fontWeight: "700" },
  accountBalance: { color: "#e5e7eb", fontSize: 16, fontWeight: "900" },
  accountCurrency: { color: "#94a3b8", fontSize: 12, marginTop: 2, fontWeight: "700" },
  updateBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(250,204,21,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.5)",
  },
  updateBtnText: { color: "#facc15", fontSize: 11, fontWeight: "900" },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 56,
    backgroundColor: "#facc15",
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { color: "#0b0f1a", fontSize: 28, fontWeight: "900", marginTop: -2 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    height: "50%",
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginBottom: 12 },  input: { backgroundColor: "#111827", color: "#fff", padding: 14, borderRadius: 12, marginBottom: 10 },
  inputLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "800", marginBottom: 8 },
  currencyRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  currencyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  currencyBtnActive: {
    backgroundColor: "#facc15",
    borderColor: "#facc15",
  },
  currencyBtnText: { color: "#cbd5e1", fontWeight: "800", fontSize: 12 },
  currencyBtnTextActive: { color: "#0b0f1a" },

  primaryBtn: {
    backgroundColor: "#facc15",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#0b0f1a", fontWeight: "900" },

  cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  cancelText: { color: "#94a3b8", fontWeight: "800" },

});

