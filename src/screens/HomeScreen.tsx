import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api, { BASE_URL } from "../config/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App"; // yolu projene göre kontrol et
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as Progress from "react-native-progress";
import Svg, { Circle, G } from "react-native-svg";
import notifee, { TriggerType, TimestampTrigger } from "@notifee/react-native";
import { ThemeColors, ThemeMode, useTheme } from "../theme/theme";
import { getAll as getSabitOdemeler, SabitOdemeResponse } from "../services/sabitOdemeApi";
import { getMyYatirimlar, YatirimCreateResponse, YatirimVarlikTuru } from "../services/yatirimService";

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
type FamilyWalletResponse = {
  aileId: number;
  yilAy: string;
  aileToplamGelir: number | string;
  aileToplamGider: number | string;
  aileNet: number | string;
  uyelerAylik: {
    kullaniciId: number;
    adSoyad: string;
    aylikGelir: number | string;
    aylikGider: number | string;
    net: number | string;
  }[];
};
type TaksitApiItem = {
  taksitId?: number;
  id?: number;
  taksitBasligi?: string;
  baslik?: string;
  baslangicTarihi?: string;
  baslamaTarihi?: string;
  taksitSayisi?: number | string;
  bittiMi?: boolean;
};
type ReminderItem = {
  id: string;
  title: string;
  dueDate: Date;
  type: "TAKSIT" | "SABIT";
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;
export default function HomeScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const screenWidth = Dimensions.get("window").width;
  const monthPagerRef = useRef<FlatList<AylikAnaliz>>(null);
  // =========================
  // ? STATE
  // =========================
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(true);

  const [son6Ay, setSon6Ay] = useState<AylikAnaliz[]>([]);
  const [loading6Ay, setLoading6Ay] = useState(true);

  const [analiz, setAnaliz] = useState<AylikAnaliz | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

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
  const graphGroupBy: GraphGroupBy = "HESAP";
  const [graphData, setGraphData] = useState<YatirimGraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphShowAll, setGraphShowAll] = useState(false);
  const [yatirimlar, setYatirimlar] = useState<YatirimCreateResponse[]>([]);
  const [yatirimLoading, setYatirimLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailType, setDetailType] = useState<"reminders" | "suggestions">("reminders");
  const [familyTopSpender, setFamilyTopSpender] = useState<{
    adSoyad: string;
    toplamTutar: number;
  } | null>(null);
  const [familyMonthly, setFamilyMonthly] = useState<FamilyWalletResponse | null>(null);
  const [familyMonthlyPrev, setFamilyMonthlyPrev] = useState<FamilyWalletResponse | null>(null);

  // =========================
  // ? HELPERS
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
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d: Date, diff: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + diff);
    return x;
  };
  const addMonthsClamped = (d: Date, diff: number) => {
    const y = d.getFullYear();
    const m = d.getMonth() + diff;
    const day = d.getDate();
    const lastDay = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, lastDay));
  };
  const formatYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const formatRateValue = (n?: number) =>
    Number.isFinite(n) ? `₺ ${formatTRY(n as number)}` : "-";
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

  const monthShort = (yilAy: string) => {
    const parts = String(yilAy).split("-");
    const m = Number(parts[1]); // 1..12
    const ayKisa = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];
    return ayKisa[(m || 1) - 1] ?? "Ay";
  };
  const getMonthKey = (yilAy: string) => String(yilAy).slice(0, 7);

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
  const monthLabelFrom = (yilAy: string) => {
    if (!yilAy) return "AYLIK";
    const m = Number(String(yilAy).split("-")[1]);
    const aylar = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
    return aylar[(m || 1) - 1] ?? "AYLIK";
  };

  // =========================
  // ? DERIVED (donut)
  // =========================
  const totalIncome = analiz?.aylikGelir ?? 0;
  const totalExpense = analiz?.aylikGider ?? 0;


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
            "#1e3a8a",
            "#0f766e",
            "#b45309",
            "#6b21a8",
            "#be123c",
            "#15803d",
            "#0e7490",
            "#a16207",
            "#4f46e5",
            "#374151",
          ]
        : [
            "#3b82f6",
            "#14b8a6",
            "#f59e0b",
            "#a855f7",
            "#f43f5e",
            "#22c55e",
            "#06b6d4",
            "#f97316",
            "#6366f1",
            "#94a3b8",
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
  const liveGraph = useMemo<YatirimGraphResponse | null>(() => {
    if (!marketData || yatirimlar.length === 0) return null;
    const agg = new Map<string, { toplamMaliyet: number; guncelDeger: number }>();
    for (const y of yatirimlar) {
      const key = y.hesapAdi;
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
  }, [marketData, yatirimlar, getMarketPriceFor]);

  const dataToShow = liveGraph ?? graphData;
  const graphPoints = dataToShow?.points ?? [];
  const graphVisiblePoints = graphShowAll ? graphPoints : graphPoints.slice(0, 10);
  const chartPoints = useMemo(
    () =>
      graphVisiblePoints.map((p) => ({
        label: p.label,
        karZarar: p.karZarar,
      })),
    [graphVisiblePoints]
  );
  const graphChartData = chartPoints.map((p) => toNum(p.karZarar));
  const graphMax = Math.max(0, ...graphChartData.map((v) => Math.abs(v)));
  const chipIntensity = (v: number) => {
    if (graphMax <= 0) return 0;
    return Math.min(1, Math.abs(v) / graphMax);
  };
  const totalMaliyet = toNum(dataToShow?.toplamMaliyet);
  const totalGuncel = toNum(dataToShow?.toplamGuncelDeger);
  const totalKarZarar = toNum(dataToShow?.toplamKarZarar);
  const karZararPositive = totalKarZarar >= 0;
  const suggestions = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    const pushUnique = (s: string) => {
      if (!s || seen.has(s)) return;
      seen.add(s);
      list.push(s);
    };
    const pick = (arr: string[]) => {
      if (!arr.length) return "";
      const idx = new Date().getMonth() % arr.length;
      return arr[idx];
    };

    const safeIncome = Number(totalIncome) || 0;
    const safeExpense = Number(totalExpense) || 0;

    if (safeIncome === 0 && safeExpense === 0) {
      pushUnique(
        pick([
          "Bu ay için henüz işlem yok. İlk hareketi ekleyerek özet oluşturabilirsin.",
          "Bu ayda veri bulunamadı. Bir gelir ya da gider ekleyerek başlayabilirsin.",
          "Şu an boş görünüyor. İşlem eklediğinde özet otomatik oluşacak.",
        ])
      );
      return list;
    }

    if (safeIncome > 0 && safeExpense > safeIncome) {
      pushUnique(
        pick([
          "Giderlerin gelirini geçti. En büyük kalemleri gözden geçirmeyi deneyebilirsin.",
          "Bu ay bütçe açığı var. Önceliksiz harcamaları azaltmayı düşünebilirsin.",
          "Giderler bu ay yüksek. Birkaç kalemde kısıntı iyi gelebilir.",
        ])
      );
    }

    const surplus = safeIncome - safeExpense;
    if (surplus > 0) {
      pushUnique(
        pick([
          `Bu ay ${formatTRY(surplus)} TL fazla var. Birikim için ayırabilirsin.`,
          `Ay sonunda ${formatTRY(surplus)} TL artıdasın. Borç kapatma için ayırmayı düşünebilirsin.`,
          `Bu ay ${formatTRY(surplus)} TL elinde kaldı. Hedef birikime aktarabilirsin.`,
        ])
      );
    }

    if (giderItems.length > 0 && categoryExpenseTotal > 0) {
      const top = giderItems[0];
      const pct = Math.round((top.toplamTutar / categoryExpenseTotal) * 100);
      if (pct >= 35) {
        pushUnique(
          pick([
            `Giderlerinin %${pct}'i ${top.kategoriAd} kategorisinde. Bu kalemi dengeleyebilirsin.`,
            `${top.kategoriAd} harcaması bu ay öne çıkıyor (%${pct}). Limit belirlemeyi deneyebilirsin.`,
            `En büyük pay ${top.kategoriAd} (%${pct}). Alternatifleri değerlendirebilirsin.`,
          ])
        );
      }
    }

    if (son6Ay.length >= 2) {
      const prev = son6Ay[son6Ay.length - 2];
      const cur = son6Ay[son6Ay.length - 1];
      const diff = (Number(cur?.aylikGider) || 0) - (Number(prev?.aylikGider) || 0);
      if (diff !== 0) {
        const pct =
          Number(prev?.aylikGider) > 0
            ? Math.round((diff / Number(prev.aylikGider)) * 100)
            : null;
        if (diff > 0) {
          pushUnique(
            pick([
              `Giderin geçen aya göre ${formatTRY(diff)} TL arttı${pct != null ? ` (%${pct})` : ""}.`,
              `Harcamalarda artış var: +${formatTRY(diff)} TL${pct != null ? ` (%${pct})` : ""}.`,
              `Bu ay giderlerin yükseldi: +${formatTRY(diff)} TL${pct != null ? ` (%${pct})` : ""}.`,
            ])
          );
        } else {
          pushUnique(
            pick([
              `Giderin geçen aya göre ${formatTRY(Math.abs(diff))} TL azaldı${
                pct != null ? ` (%${Math.abs(pct)})` : ""
              }.`,
              `Harcamalarda düşüş var: -${formatTRY(Math.abs(diff))} TL${
                pct != null ? ` (%${Math.abs(pct)})` : ""
              }.`,
              `Bu ay giderlerin azaldı: -${formatTRY(Math.abs(diff))} TL${
                pct != null ? ` (%${Math.abs(pct)})` : ""
              }.`,
            ])
          );
        }
      }
    }

    if (familyTopSpender?.toplamTutar) {
      pushUnique(
        pick([
          `Ailede bu ay en çok harcayan: ${familyTopSpender.adSoyad} (${formatTRY(
            familyTopSpender.toplamTutar
          )} TL).`,
          `${familyTopSpender.adSoyad} bu ay aile içinde en yüksek harcamayı yaptı (${formatTRY(
            familyTopSpender.toplamTutar
          )} TL).`,
          `Ailede en yüksek harcama: ${familyTopSpender.adSoyad} (${formatTRY(
            familyTopSpender.toplamTutar
          )} TL).`,
        ])
      );
    }

    if (familyMonthly) {
      const famGelir = toNum(familyMonthly.aileToplamGelir);
      const famGider = toNum(familyMonthly.aileToplamGider);
      const famNet = toNum(familyMonthly.aileNet);
      if (famGider > famGelir) {
        pushUnique(
          pick([
            "Ailede bu ay toplam gider, toplam geliri aştı.",
            "Aile bütçesinde bu ay giderler gelirin üzerinde.",
            "Ailede bu ay açık var. Harcamaları gözden geçirebilirsiniz.",
          ])
        );
      }
      if (famNet < 0) {
        pushUnique(
          pick([
            "Aile neti negatif. Ortak bütçeyi dengelemek için giderleri gözden geçir.",
            "Aile bütçesi eksiye düştü. Öncelikleri belirlemek işe yarayabilir.",
            "Aile neti negatif. Geçici bir kısıtlama düşünülebilir.",
          ])
        );
      }
    }

    if (familyMonthly && familyMonthlyPrev) {
      const curGider = toNum(familyMonthly.aileToplamGider);
      const prevGider = toNum(familyMonthlyPrev.aileToplamGider);
      const diff = curGider - prevGider;
      if (diff !== 0) {
        const pct = prevGider > 0 ? Math.round((diff / prevGider) * 100) : null;
        if (diff > 0) {
          pushUnique(
            pick([
              `Aile gideri geçen aya göre ${formatTRY(diff)} TL arttı${pct != null ? ` (%${pct})` : ""}.`,
              `Aile giderleri yükseldi: +${formatTRY(diff)} TL${pct != null ? ` (%${pct})` : ""}.`,
              `Ailede harcama artışı var: +${formatTRY(diff)} TL${pct != null ? ` (%${pct})` : ""}.`,
            ])
          );
        } else {
          pushUnique(
            pick([
              `Aile gideri geçen aya göre ${formatTRY(Math.abs(diff))} TL azaldı${
                pct != null ? ` (%${Math.abs(pct)})` : ""
              }.`,
              `Aile giderleri düştü: -${formatTRY(Math.abs(diff))} TL${
                pct != null ? ` (%${Math.abs(pct)})` : ""
              }.`,
              `Aile harcamaları geriledi: -${formatTRY(Math.abs(diff))} TL${
                pct != null ? ` (%${Math.abs(pct)})` : ""
              }.`,
            ])
          );
        }
      }
    }

    return list.slice(0, 5);
  }, [
    totalIncome,
    totalExpense,
    giderItems,
    categoryExpenseTotal,
    son6Ay,
    familyTopSpender,
    familyMonthly,
    familyMonthlyPrev,
  ]);
  const availableMonths = useMemo(() => son6Ay.map((x) => getMonthKey(x.yilAy)), [son6Ay]);
  const remindersUpcoming = useMemo(
    () => [...reminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    [reminders]
  );
  const remindersPreview = useMemo(() => remindersUpcoming.slice(0, 2), [remindersUpcoming]);
  const suggestionsPreview = useMemo(() => suggestions.slice(0, 2), [suggestions]);
  const openDetail = useCallback((type: "reminders" | "suggestions") => {
    setDetailType(type);
    setDetailModalVisible(true);
  }, []);

  useEffect(() => {
    if (son6Ay.length === 0) return;
    const currentKey = getCurrentYM();
    const latest = availableMonths[availableMonths.length - 1];
    const preferred = availableMonths.includes(currentKey) ? currentKey : latest;
    if (!selectedMonthKey || !availableMonths.includes(selectedMonthKey)) {
      setSelectedMonthKey(preferred);
    }
  }, [son6Ay, availableMonths, selectedMonthKey]);

  const monthViewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onMonthViewable = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: AylikAnaliz }> }) => {
      const first = viewableItems[0]?.item;
      if (first) {
        setSelectedMonthKey(getMonthKey(first.yilAy));
      }
    }
  ).current;

  useEffect(() => {
    if (!selectedMonthKey) return;
    const idx = availableMonths.indexOf(selectedMonthKey);
    if (idx >= 0) {
      monthPagerRef.current?.scrollToIndex({ index: idx, animated: false });
    }
  }, [selectedMonthKey, availableMonths]);

  useEffect(() => {
    const scheduleNotifications = async () => {
      try {
        await notifee.requestPermission();
        const channelId = await notifee.createChannel({
          id: "payments",
          name: "Ödeme Hatırlatıcıları",
        });
        for (const r of reminders) {
          const triggerDate = new Date(startOfDay(addDays(r.dueDate, -1)));
          triggerDate.setHours(9, 0, 0, 0);
          if (triggerDate.getTime() <= Date.now()) continue;
          const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: triggerDate.getTime(),
          };
          const notifId = `reminder-${r.id}`;
          await notifee.cancelNotification(notifId);
          await notifee.createTriggerNotification(
            {
              id: notifId,
              title: "Ödeme Hatırlatıcı",
              body: `${r.title} - ${formatYMD(r.dueDate)} tarihinde.`,
              android: { channelId },
            },
            trigger
          );
        }
      } catch (e) {
        console.log("Notifee planlama hata:", e);
      }
    };
    scheduleNotifications();
  }, [reminders]);

  // =========================
  // ? FETCH: ACCOUNTS
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
  // ? FETCH: LAST 6 MONTHS
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
    // Hata olursa mevcut veriyi koru; Son güncelleme boş kalmasın
  } finally {
    setMarketLoading(false);
  }
}, [marketBaseUrl]);
  const fetchCategorySummaryMonthly = useCallback(async (yilAy?: string) => {
  setLoadingCategorySummary(true);
  try {
    const key = yilAy || getCurrentYM();
    const res = await api.get("/api/categorysummary/monthly", {
      params: { yilAy: key },
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
    console.log("Yatirim graph hata:", err?.response?.data || err?.message);
    setGraphError("Yatırım grafiği yüklenemedi.");
    setGraphData(null);
  } finally {
    setGraphLoading(false);
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
  const fetchFamilyTopSpender = useCallback(async () => {
  if (!userInfo?.aileId) {
    setFamilyTopSpender(null);
    return;
  }
  try {
    const yilAy = getCurrentYM();
    const res = await api.get<FamilyWalletResponse>("/api/familywallet/monthly", {
      params: { yilAy },
    });
    const members = Array.isArray(res.data?.uyelerAylik) ? res.data.uyelerAylik : [];
    const top = members
      .map((m) => ({
        adSoyad: String(m.adSoyad ?? "Üye"),
        toplamTutar: toNum(m.aylikGider),
      }))
      .filter((x) => x.toplamTutar > 0)
      .sort((a, b) => b.toplamTutar - a.toplamTutar)[0];
    setFamilyTopSpender(top ?? null);
  } catch (err: any) {
    console.log("Family wallet hata:", err?.response?.data || err?.message);
    setFamilyTopSpender(null);
  }
}, [userInfo?.aileId]);
  const fetchFamilyMonthly = useCallback(async () => {
  if (!userInfo?.aileId) {
    setFamilyMonthly(null);
    setFamilyMonthlyPrev(null);
    return;
  }
  try {
    const nowKey = getCurrentYM();
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const [currentRes, prevRes] = await Promise.all([
      api.get<FamilyWalletResponse>("/api/familywallet/monthly", { params: { yilAy: nowKey } }),
      api.get<FamilyWalletResponse>("/api/familywallet/monthly", { params: { yilAy: prevKey } }),
    ]);
    setFamilyMonthly(currentRes.data ?? null);
    setFamilyMonthlyPrev(prevRes.data ?? null);
  } catch (err: any) {
    console.log("Family monthly hata:", err?.response?.data || err?.message);
    setFamilyMonthly(null);
    setFamilyMonthlyPrev(null);
  }
}, [userInfo?.aileId]);
  const fetchPaymentReminders = useCallback(async () => {
  try {
    const [taksitRes, sabitRes] = await Promise.all([
      api.get("/api/taksitler/my"),
      getSabitOdemeler(),
    ]);

    const taksitArr: TaksitApiItem[] = Array.isArray(taksitRes.data) ? taksitRes.data : [];
    const sabitArr: SabitOdemeResponse[] = Array.isArray(sabitRes) ? sabitRes : [];

    const today = startOfDay(new Date());

    const taksitReminders: ReminderItem[] = taksitArr
      .map((t) => {
        const id = Number(t.taksitId ?? t.id);
        const title = String(t.taksitBasligi ?? t.baslik ?? "Taksit");
        const startStr = String(t.baslangicTarihi ?? t.baslamaTarihi ?? "").slice(0, 10);
        const count = Math.max(0, Math.floor(toNum(t.taksitSayisi)));
        const done = Boolean(t.bittiMi);
        if (!id || !startStr || count <= 0 || done) return null;
        const base = new Date(`${startStr}T00:00:00`);
        if (Number.isNaN(base.getTime())) return null;

        const monthDiff =
          (today.getFullYear() - base.getFullYear()) * 12 + (today.getMonth() - base.getMonth());
        let idx = Math.max(0, monthDiff);
        let due = addMonthsClamped(base, idx);
        if (startOfDay(due) < today) {
          idx += 1;
          due = addMonthsClamped(base, idx);
        }
        if (idx >= count) return null;

        return {
          id: `taksit-${id}-${formatYMD(due)}`,
          title: `Taksit: ${title}`,
          dueDate: due,
          type: "TAKSIT" as const,
        };
      })
      .filter(Boolean) as ReminderItem[];

    const sabitReminders: ReminderItem[] = sabitArr
      .filter((s) => s && s.aktif)
      .map((s) => {
        const dueStr = String(s.sonOdemeGunu ?? "").slice(0, 10);
        if (!dueStr) return null;
        const due = new Date(`${dueStr}T00:00:00`);
        if (Number.isNaN(due.getTime())) return null;
        if (startOfDay(due) < today) return null;
        return {
          id: `sabit-${s.odemeId}-${formatYMD(due)}`,
          title: `Sabit Ödeme: ${s.odemeAdi}`,
          dueDate: due,
          type: "SABIT" as const,
        };
      })
      .filter(Boolean) as ReminderItem[];

    setReminders([...taksitReminders, ...sabitReminders]);
  } catch (err: any) {
    console.log("Hatirlatici listeleme hata:", err?.response?.data || err?.message);
    setReminders([]);
  }
}, []);
  // =========================
  // ? EFFECTS
  // =========================
  useEffect(() => {
    fetchAccounts();
    fetchSon6Ay();
    fetchUserInfo();
    fetchMarket();
    fetchYatirimGraph("HESAP");
    fetchMyYatirimlar();
    fetchPaymentReminders();
  }, [
    fetchAccounts,
    fetchSon6Ay,
    fetchUserInfo,
    fetchMarket,
    fetchYatirimGraph,
    fetchMyYatirimlar,
    fetchPaymentReminders,
  ]);
  useEffect(() => {
    fetchCategorySummaryMonthly(selectedMonthKey || getCurrentYM());
  }, [fetchCategorySummaryMonthly, selectedMonthKey]);
  useEffect(() => {
    fetchFamilyTopSpender();
    fetchFamilyMonthly();
  }, [fetchFamilyTopSpender, fetchFamilyMonthly]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchAccounts(),
        fetchSon6Ay(),
        fetchUserInfo(),
        fetchMarket(),
        fetchCategorySummaryMonthly(selectedMonthKey || getCurrentYM()),
        fetchYatirimGraph("HESAP"),
        fetchMyYatirimlar(),
        fetchPaymentReminders(),
        fetchFamilyTopSpender(),
        fetchFamilyMonthly(),
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
    fetchMyYatirimlar,
    fetchPaymentReminders,
    fetchFamilyTopSpender,
    fetchFamilyMonthly,
    selectedMonthKey,
  ]);

  // son6Ay gelince seçili aya göre analiz seç
  useEffect(() => {
    if (loading6Ay) return;
    if (!son6Ay.length) {
      setAnaliz(null);
      return;
    }
    const targetKey = selectedMonthKey || getMonthKey(son6Ay[son6Ay.length - 1].yilAy);
    const found = son6Ay.find((x) => getMonthKey(x.yilAy) === targetKey) || null;
    setAnaliz(found);
  }, [son6Ay, loading6Ay, selectedMonthKey]);

  // =========================
  // ? CHART (dynamic)
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
  // ? CREATE ACCOUNT
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
      console.log("Hesap Olusturma hata:", err?.response?.data || err?.message);
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
      console.log("Bakiye Güncelleme hata:", err?.response?.data || err?.message);
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

// ? Bu ay dahil son 6 ayı üretir, backend verisi yoksa 0 yazar

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
  // ? UI
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
            : "Kullanici"
        }
        right={<HeaderAction label="Menü" onPress={() => navigation.navigate("Menu")} />}
      />
      <View pointerEvents="none" style={styles.heroBackdrop}>
        <View style={styles.heroOrbPrimary} />
        <View style={styles.heroOrbSecondary} />
      </View>

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
        {son6Ay.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ color: colors.textMuted }}>Veri yok</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={monthPagerRef}
              data={son6Ay}
              keyExtractor={(item) => getMonthKey(item.yilAy)}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              snapToInterval={screenWidth}
              snapToAlignment="center"
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={Math.max(0, availableMonths.indexOf(selectedMonthKey || ""))}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              onViewableItemsChanged={onMonthViewable}
              viewabilityConfig={monthViewabilityConfig}
              renderItem={({ item }) => {
                const income = Number(item.aylikGelir) || 0;
                const expense = Number(item.aylikGider) || 0;
                const totalLocal = income + expense;
                const incomePctLocal = totalLocal === 0 ? 0 : Math.round((income / totalLocal) * 100);
                const expensePctLocal = totalLocal === 0 ? 0 : Math.round((expense / totalLocal) * 100);
                const label = monthLabelFrom(item.yilAy);
                return (
                  <View style={[styles.monthPagerItem, { width: screenWidth }]}>
                    <View style={[styles.monthPagerCard, { width: screenWidth - 32 }]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{label} GELİR / GİDER</Text>
                        <Text style={styles.badge}>{label}</Text>
                      </View>

                      <View style={styles.row}>
                        <View style={{ width: 160, height: 160 }}>
                          <Progress.Circle
                            size={160}
                            thickness={16}
                            progress={incomePctLocal / 100}
                            color={colors.warning}
                            unfilledColor={colors.danger}
                            borderWidth={0}
                            showsText={false}
                          />

                          <View style={styles.donutCenter}>
                            <Text style={styles.donutCenterTitle}>{label}</Text>
                            <Text style={styles.donutCenterSub}>
                              {loading6Ay ? "YÜKLENİYOR..." : totalLocal > 0 ? "GELİR / GİDER" : "VERİ YOK"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flex: 1, paddingLeft: 14 }}>
                          <Text style={styles.kpiLabel}>Aylik Gelir</Text>
                          <Text style={styles.kpiValue}>+ {formatTRY(income)} TL</Text>

                          <View style={{ height: 10 }} />

                          <Text style={styles.kpiLabel}>Aylik Gider</Text>
                          <Text style={styles.kpiValueDanger}>- {formatTRY(expense)} TL</Text>

                          <View style={{ height: 14 }} />

                          <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                            <Text style={styles.legendText}>Gelir {incomePctLocal}%</Text>
                          </View>
                          <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                            <Text style={styles.legendText}>Gider {expensePctLocal}%</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
            {son6Ay.length > 1 ? (
              <View style={styles.monthPagerIndicator}>
                <View style={styles.monthPagerDots}>
                  {son6Ay.map((m, idx) => {
                    const active = getMonthKey(m.yilAy) === selectedMonthKey;
                    return (
                      <View
                        key={`${m.yilAy}-${idx}`}
                        style={[styles.monthPagerDot, active && styles.monthPagerDotActive]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.monthPagerHint}>Kaydir</Text>
              </View>
            ) : null}
          </>
        )}

        {/* AKILLI ÖNERİLER */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.9}
          onPress={() => openDetail("suggestions")}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardTitle}>Akıllı Öneriler</Text>
            <View style={styles.sectionHeaderActions}>
              {suggestions.length > 2 ? (
                <TouchableOpacity onPress={() => openDetail("suggestions")} activeOpacity={0.8}>
                  <Text style={styles.sectionLink}>Detaylar</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{suggestions.length}</Text>
              </View>
            </View>
          </View>

          {suggestions.length === 0 ? (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>Şu an öneri yok.</Text>
          ) : (
            <View style={styles.suggestionList}>
              {suggestionsPreview.map((s, idx) => (
                <View key={`${idx}-${s.slice(0, 12)}`} style={styles.suggestionRow}>
                  <View style={styles.suggestionDot} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* 6 AYLIK KARSILASTIRMA */}
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

          <View style={styles.sectionDivider} />

          <TouchableOpacity
            style={styles.inlineSection}
            activeOpacity={0.9}
            onPress={() => openDetail("reminders")}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.cardTitle}>Yaklaşan Ödemeler</Text>
              <View style={styles.sectionHeaderActions}>
                {remindersUpcoming.length > 2 ? (
                  <TouchableOpacity onPress={() => openDetail("reminders")} activeOpacity={0.8}>
                    <Text style={styles.sectionLink}>Detaylar</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{remindersUpcoming.length}</Text>
                </View>
              </View>
            </View>

            {remindersUpcoming.length === 0 ? (
              <Text style={{ color: colors.textMuted, marginTop: 10 }}>Yaklaşan ödeme yok.</Text>
            ) : (
              <View style={styles.suggestionList}>
                {remindersPreview.map((r) => (
                  <View key={r.id} style={styles.suggestionRow}>
                    <View style={styles.suggestionDot} />
                    <Text style={styles.suggestionText}>
                      {r.title} • {formatYMD(r.dueDate)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
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
                          {item.kategoriAd?.[0]?.toUpperCase() ?? ""}
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
              <Text style={styles.cardTitle}>GÜNCEL KURLAR</Text>
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
                <Text style={styles.rateCode}>Gram Altin</Text>
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

        {/* YATIRIM GRAFIGI */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Yatırım Grafiği</Text>
              <Text style={styles.cardSubtitle}>Hesap bazlı kâr/zarar</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{graphGroupBy}</Text>
            </View>
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
                      const leftPct = v < 0 ? pct : 0;
                      const rightPct = v > 0 ? pct : 0;
                      const leftWidth = leftPct > 0 ? Math.max(6, Math.round(leftPct * 100)) : 0;
                      const rightWidth = rightPct > 0 ? Math.max(6, Math.round(rightPct * 100)) : 0;
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
                          <View style={styles.chartBarSplit}>
                            <View style={styles.chartBarSide}>
                              <View
                                style={[styles.chartBarFillNeg, { width: `${leftWidth}%` }]}
                              />
                            </View>
                            <View style={styles.chartBarZero} />
                            <View style={styles.chartBarSide}>
                              <View
                                style={[styles.chartBarFillPos, { width: `${rightWidth}%` }]}
                              />
                            </View>
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

      <Modal visible={detailModalVisible} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>
              {detailType === "reminders" ? "Yaklaşan Ödemeler" : "Akıllı Öneriler"}
            </Text>
            <Text style={styles.detailSub}>
              {detailType === "reminders"
                ? "Tüm ödeme detayları listesi"
                : "Üretilen tüm öneriler"}
            </Text>

            {detailType === "reminders" ? (
              remindersUpcoming.length === 0 ? (
                <Text style={styles.detailEmpty}>Yaklaşan ödeme yok.</Text>
              ) : (
                <View style={styles.detailList}>
                  {remindersUpcoming.map((r) => (
                    <View key={`detail-${r.id}`} style={styles.suggestionRow}>
                      <View style={styles.suggestionDot} />
                      <Text style={styles.suggestionText}>
                        {r.title} . {formatYMD(r.dueDate)}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            ) : suggestions.length === 0 ? (
              <Text style={styles.detailEmpty}>Şu an öneri yok.</Text>
            ) : (
              <View style={styles.detailList}>
                {suggestions.map((s, idx) => (
                  <View key={`detail-s-${idx}`} style={styles.suggestionRow}>
                    <View style={styles.suggestionDot} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.detailClose}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.detailCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Chat Button */}
      <TouchableOpacity
        style={[styles.chatFab, styles.chatFabActive]}
        onPress={() => navigation.navigate("Chat")}
        activeOpacity={0.9}
      >
        <View style={styles.chatFabGlow} />
        <View style={styles.chatAccent} />
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
        <Text style={styles.chatLabel}>Sohbet</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
<View style={styles.sheet}>
  <Text style={styles.sheetTitle}>Hesap Olustur</Text>

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
              {selectedAccount?.name ?? "Hesap"}
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
  screen: { flex: 1, backgroundColor: colors.background, position: "relative" },
  heroBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 220,
    overflow: "hidden",
  },
  heroOrbPrimary: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: colors.headerGlowA,
    top: -110,
    right: -60,
  },
  heroOrbSecondary: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: colors.headerGlowB,
    top: -70,
    left: -80,
  },

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
  monthPagerItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  monthPagerCard: {
        backgroundColor: colors.surface,
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
  sectionHeaderActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionLink: { color: colors.warning, fontSize: 12, fontWeight: "900" },
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
  monthPagerIndicator: {
    marginTop: 6,
    alignItems: "center",
    gap: 6,
  },
  monthPagerDots: { flexDirection: "row", gap: 6 },
  monthPagerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    opacity: 0.6,
  },
  monthPagerDotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: colors.warning,
    opacity: 1,
  },
  monthPagerHint: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },

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
  sectionDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginTop: 12,
  },
  inlineSection: {
    marginTop: 12,
  },
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
    right: 16,
    bottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    flexDirection: "row",
    gap: 8,
  },
  chatFabActive: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.2,
  },
  chatAccent: {
    width: 4,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  chatIcon: { alignItems: "center", justifyContent: "center" },
  chatBubble: {
    width: 20,
    height: 16,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    transform: [{ rotate: "45deg" }],
    marginTop: -3,
    marginLeft: 7,
    borderBottomRightRadius: 2,
  },
  chatFabGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    opacity: 0.5,
    top: -24,
    right: -24,
  },
  chatLabel: { color: colors.text, fontSize: 12, fontWeight: "800" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: mode === "light" ? "rgba(15,23,42,0.35)" : "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "70%",
  },
  detailTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  detailSub: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: "700" },
  detailList: { marginTop: 12, gap: 8 },
  detailEmpty: { color: colors.textMuted, fontSize: 12, marginTop: 12 },
  detailClose: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  detailCloseText: { color: colors.textMuted, fontWeight: "800" },
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
  chartBarSplit: {
    height: 10,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  chartBarSide: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  chartBarZero: {
    width: 2,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginHorizontal: 6,
  },
  chartBarFillPos: { height: "100%", borderRadius: 999, backgroundColor: colors.success },
  chartBarFillNeg: { height: "100%", borderRadius: 999, backgroundColor: colors.danger },
  suggestionList: { marginTop: 10, gap: 8 },
  suggestionRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  suggestionDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: colors.warning,
  },
  suggestionText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "800", lineHeight: 18 },
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

