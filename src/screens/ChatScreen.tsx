import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, ThemeMode, useTheme } from "../theme/theme";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import api, { BASE_URL } from "../config/api";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
};

type Forecast = {
  h1: number;
  h3: number;
  h7: number;
};

type MarketLatestResponse = {
  ok: boolean;
  ts: number;
  source?: string;
  data: Record<string, { value: number }>;
};

type FxAssistantItem = {
  date: string;
  symbol: string;
  forecast: Forecast;
  risk: "LOW" | "MED" | "HIGH";
  insight: string;
};

const MARKET_SYMBOLS: string[] = [
  "USDTRY (ABD Doları / TL)",
  "EURTRY (Euro / TL)",
  "GBPTRY (Sterlin / TL)",
  "XAUUSD (Altın / USD)",
  "XAGUSD (Gümüş / USD)",
  "BTCUSD (Bitcoin / USD)",
  "ETHUSD (Ethereum / USD)",
];
const MONTHLY_SUMMARY_QUESTIONS: string[] = [
  "Bu ay toplam gelir",
  "Bu ay toplam gider",
  "Geçen ay toplam gelir",
  "Geçen ay toplam gider",
  "Bu ay vs geçen ay kıyas",
  "Geçen ay harcama açıklaması",
];
const CATEGORY_QUESTIONS: string[] = [
  "Bu ay en çok gider",
  "Geçen ay en çok gider",
  "Bu ay kategori kırılımı",
  "Geçen ay kategori kırılımı",
];
const INVESTMENT_QUESTIONS: string[] = ["Yatırım kâr/zarar özeti"];
const QUESTION_GROUPS: {
  id: "market" | "summary" | "category" | "investment";
  title: string;
  subtitle: string;
  items: string[];
}[] = [
  { id: "market", title: "Piyasa", subtitle: "Döviz / Altın / Kripto", items: MARKET_SYMBOLS },
  { id: "summary", title: "Aylık Özet", subtitle: "Gelir ve Gider Soruları", items: MONTHLY_SUMMARY_QUESTIONS },
  { id: "category", title: "Kategoriler", subtitle: "Gider Dağılımı", items: CATEGORY_QUESTIONS },
  { id: "investment", title: "Yatırımlar", subtitle: "Portföy ve Grafik", items: INVESTMENT_QUESTIONS },
];
const ENDPOINT = "http://192.168.234.156:8000/predict";

export default function ChatScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const [fxData, setFxData] = useState<FxAssistantItem[]>([]);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<MarketLatestResponse["data"] | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<
    "market" | "summary" | "category" | "investment" | null
  >(null);
  const scrollRef = useRef<ScrollView | null>(null);

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

  const fetchMarketLatest = useCallback(async () => {
    setMarketLoading(true);
    setMarketError(null);
    try {
      const res = await api.get(`${marketBaseUrl}/api/market/latest`);
      const payload: MarketLatestResponse = res.data;
      if (payload?.ok && payload?.data) {
        setMarketData(payload.data);
        return payload.data;
      } else {
        throw new Error("Market verisi alınamadı");
      }
    } catch (err: any) {
      setMarketError(err?.message || "Market isteği başarısız");
      return null;
    } finally {
      setMarketLoading(false);
    }
  }, [marketBaseUrl]);

  const fetchFxData = useCallback(async () => {
    setFxLoading(true);
    setFxError(null);
    try {
      const res = await fetch(ENDPOINT);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as FxAssistantItem[];
      if (!Array.isArray(json)) {
        throw new Error("Unexpected response format");
      }
      setFxData(json);
      return json;
    } catch (err: any) {
      setFxError(err?.message || "Request failed");
      return null;
    } finally {
      setFxLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFxData();
    fetchMarketLatest();
  }, [fetchFxData, fetchMarketLatest]);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages]);

  const format6 = (v: number) => Number(v).toFixed(6);
  const formatTRY = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const normalizeText = useCallback((text: string) => {
    const cleaned = text
      .toLowerCase()
      .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const synonyms: Array<[RegExp, string]> = [
      [/\bgelirlerim\b/g, "gelir"],
      [/\bgiderlerim\b/g, "gider"],
      [/\bharcamalarım\b/g, "gider"],
      [/\bharcamalarim\b/g, "gider"],
      [/\bharcama\b/g, "gider"],
      [/\bmasraf\b/g, "gider"],
      [/\bmasraflar\b/g, "gider"],
      [/\bödeme\b/g, "gider"],
      [/\bödemeler\b/g, "gider"],
      [/\bne kadar\b/g, "kaç"],
      [/\bne oldu\b/g, "kaç"],
    ];
    return synonyms.reduce((acc, [rx, repl]) => acc.replace(rx, repl), cleaned);
  }, []);
  const detectIntent = useCallback((text: string) => {
    const t = normalizeText(text);
    const rules: Array<{
      id:
        | "LAST_MONTH_SPEND_EXPLAIN"
        | "MONTHLY_INCOME_CURRENT"
        | "MONTHLY_EXPENSE_CURRENT"
        | "MONTHLY_INCOME_LAST"
        | "MONTHLY_EXPENSE_LAST"
        | "MONTHLY_COMPARE"
        | "TOP_EXPENSE_CURRENT"
        | "TOP_EXPENSE_LAST"
        | "CATEGORY_CURRENT"
        | "CATEGORY_LAST"
        | "INVESTMENT_SUMMARY"
        | "MARKET_RATES";
      keywords: string[];
      regex?: RegExp[];
      score?: number;
    }> = [
      { id: "LAST_MONTH_SPEND_EXPLAIN", keywords: ["geçen ay", "gider"], regex: [/açıklama|detay/] },
      { id: "MONTHLY_INCOME_CURRENT", keywords: ["bu ay", "gelir"], regex: [/toplam|kaç/] },
      { id: "MONTHLY_EXPENSE_CURRENT", keywords: ["bu ay", "gider"], regex: [/toplam|kaç/] },
      { id: "MONTHLY_INCOME_LAST", keywords: ["geçen ay", "gelir"], regex: [/toplam|kaç/] },
      { id: "MONTHLY_EXPENSE_LAST", keywords: ["geçen ay", "gider"], regex: [/toplam|kaç/] },
      { id: "MONTHLY_COMPARE", keywords: ["bu ay", "geçen ay"], regex: [/kıyas|karşılaştır|fark/] },
      { id: "TOP_EXPENSE_CURRENT", keywords: ["bu ay", "en", "gider"], regex: [/yüksek|çok|en çok/] },
      { id: "TOP_EXPENSE_LAST", keywords: ["geçen ay", "en", "gider"], regex: [/yüksek|çok|en çok/] },
      { id: "CATEGORY_CURRENT", keywords: ["bu ay", "kategori"], regex: [/kırılım|dağılım/] },
      { id: "CATEGORY_LAST", keywords: ["geçen ay", "kategori"], regex: [/kırılım|dağılım/] },
      { id: "INVESTMENT_SUMMARY", keywords: ["yatırım"], regex: [/kar|zarar|k\/z|özeti|özet/] },
      {
        id: "MARKET_RATES",
        keywords: ["anlık", "canlı", "güncel", "şu an", "spot", "anlık kur", "güncel kur"],
      },
    ];

    let best: { id: (typeof rules)[number]["id"]; score: number } | null = null;
    for (const r of rules) {
      let score = r.score ?? 0;
      let keywordHit = false;
      for (const k of r.keywords) {
        if (t.includes(k)) {
          score += 2;
          keywordHit = true;
        }
      }
      if (keywordHit || r.keywords.length === 0) {
        for (const rx of r.regex ?? []) {
          if (rx.test(t)) score += 2;
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { id: r.id, score };
      }
    }
    return best?.id ?? null;
  }, [normalizeText]);
  const inferPredictSymbol = useCallback((text: string) => {
    const t = normalizeText(text);
    if (t.includes("xagusd") || t.includes("xag")) return "XAGUSD";
    if (t.includes("xauusd") || t.includes("xau") || t.includes("altın") || t.includes("gram"))
      return "XAUUSD";
    if (t.includes("bitcoin") || t.includes("btc")) return "BTCUSD";
    if (t.includes("ethereum") || t.includes("eth")) return "ETHUSD";
    if (t.includes("euro") || t.includes("eur")) return "EURTRY";
    if (t.includes("sterlin") || t.includes("gbp")) return "GBPTRY";
    if (t.includes("usd") || t.includes("dolar")) return "USDTRY";
    return null;
  }, [normalizeText]);
  const getRateFrom = useCallback((data: MarketLatestResponse["data"] | null, keys: string[]) => {
    if (!data) return undefined;
    const coerceNumber = (v: any) => {
      if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
      if (typeof v === "string") {
        const n = Number(v.replace(",", "."));
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };
    for (const k of keys) {
      const entry: any = (data as any)[k];
      const raw = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
      const val = coerceNumber(raw);
      if (Number.isFinite(val)) return val;
    }
    return undefined;
  }, []);
  const getSymbolRateFrom = useCallback(
    (data: MarketLatestResponse["data"] | null, symbol: string | null) => {
      if (!symbol) return undefined;
      const normalized = symbol.toUpperCase();
      return getRateFrom(data, [
        normalized,
        normalized.replace(/([A-Z]{3})([A-Z]{3})/, "$1/$2"),
        normalized.replace(/([A-Z]{3})([A-Z]{3})/, "$1_$2"),
      ]);
    },
    [getRateFrom]
  );
  const normalizeSymbol = (label: string) => label.split(" ")[0].trim();
  const buildPrompt = (symbol: string) => `${symbol} hakkında bilgi almak istiyorum.`;
  const nowTime = () =>
    new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const lastMonthKey = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };
  const currentMonthKey = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };
  const fetchMonthlySummary = useCallback(async (yilAy: string) => {
    const res = await api.get("/api/categorysummary/monthly", { params: { yilAy } });
    const arr = Array.isArray(res.data) ? res.data : [];
    return arr.map((x: any) => ({
      kategoriAd: String(x.kategoriAd ?? ""),
      tip: x.tip === "GELIR" ? "GELIR" : "GIDER",
      toplamTutar: Number(x.toplamTutar) || 0,
    }));
  }, []);
  const fetchMonthlyAnaliz = useCallback(async () => {
    const res = await api.get("/api/aylik-analiz");
    const arr = Array.isArray(res.data) ? res.data : [];
    return arr.map((x: any) => ({
      yilAy: String(x.yilAy),
      aylikGelir: Number(x.aylikGelir) || 0,
      aylikGider: Number(x.aylikGider) || 0,
    }));
  }, []);
  const fetchYatirimGraph = useCallback(async (groupBy: "HESAP" | "VARLIK") => {
    const res = await api.get("/api/yatirim/graph", { params: { groupBy } });
    return res.data ?? null;
  }, []);
  const pickByYM = (
    list: { yilAy: string; aylikGelir: number; aylikGider: number }[],
    key: string
  ) => list.find((x) => String(x.yilAy).slice(0, 7) === key) ?? null;

  const pushUserMessage = useCallback(
    (text: string) => {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-u`, role: "user", text, time: nowTime() },
      ]);
    },
    [nowTime]
  );
  const replyWithText = useCallback(
    (reply: string) => {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: "assistant", text: reply, time: nowTime() },
      ]);
    },
    [nowTime]
  );
  const sendPredictForSymbol = useCallback(
    async (symbol: string, userText?: string) => {
      if (userText) {
        pushUserMessage(userText);
      }
      const data = await fetchFxData();
      if (data && data.length > 0) {
        const filtered = data.filter((x) => x.symbol === symbol);
        if (filtered.length > 0) {
          const lines = filtered
            .slice(0, 3)
            .map(
              (x) =>
                `${x.symbol} (${x.date}) | Risk: ${x.risk} | H1 ${format6(
                  x.forecast?.h1
                )} · H3 ${format6(x.forecast?.h3)} · H7 ${format6(x.forecast?.h7)}`
            )
            .join("\n");
          const insight = filtered[0]?.insight ? `\n\n${filtered[0].insight}` : "";
          replyWithText(`${lines}${insight}`);
          return;
        }
      }
      replyWithText("Tahmin verisi bulunamadı. Biraz sonra tekrar dener misin?");
    },
    [fetchFxData, pushUserMessage, replyWithText]
  );

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    pushUserMessage(text);
    setInputText("");
    const lowered = text.toLowerCase();
    const hasAny = (patterns: string[]) => patterns.some((p) => lowered.includes(p));
    const intent = detectIntent(text);

    const getAnalizFor = async (key: string) => {
      const analizList = await fetchMonthlyAnaliz();
      return pickByYM(analizList, key);
    };

    if (intent === "LAST_MONTH_SPEND_EXPLAIN" || lowered.includes("geçen ay harcama")) {
      try {
        const lastKey = lastMonthKey();
        const currentKey = currentMonthKey();
        const [lastSummary, currentSummary, analizList] = await Promise.all([
          fetchMonthlySummary(lastKey),
          fetchMonthlySummary(currentKey),
          fetchMonthlyAnaliz(),
        ]);
        const lastExpenses = lastSummary.filter((x) => x.tip === "GIDER");
        const currentExpenses = currentSummary.filter((x) => x.tip === "GIDER");

        const lastTotal = lastExpenses.reduce((s, x) => s + (Number(x.toplamTutar) || 0), 0);
        const currentTotal = currentExpenses.reduce((s, x) => s + (Number(x.toplamTutar) || 0), 0);

        const sortByAmount = (arr: typeof lastExpenses) =>
          [...arr].sort((a, b) => b.toplamTutar - a.toplamTutar);
        const lastTop3 = sortByAmount(lastExpenses).slice(0, 3);
        const currentTop3 = sortByAmount(currentExpenses).slice(0, 3);

        const change = currentTotal - lastTotal;
        const changePct = lastTotal > 0 ? (change / lastTotal) * 100 : null;

        const listLine = (arr: typeof lastExpenses) =>
          arr.length === 0
            ? "Veri yok."
            : arr
                .map((x, i) => `${i + 1}) ${x.kategoriAd} ${formatTRY(x.toplamTutar)} TL`)
                .join("\n");

        const lastAnaliz = pickByYM(analizList, lastKey);
        const currentAnaliz = pickByYM(analizList, currentKey);

        const analizLine = (label: string, a: typeof lastAnaliz) =>
          a
            ? `${label} Gelir: ${formatTRY(a.aylikGelir)} TL, Gider: ${formatTRY(
                a.aylikGider
              )} TL`
            : `${label} Gelir/Gider verisi yok.`;

        const reply =
          lastExpenses.length === 0
            ? `${lastKey} için gider bulunamadı.`
            : `Geçen ay (${lastKey}) toplam giderin ${formatTRY(
                lastTotal
              )} TL. En büyük 3 kalem: ${listLine(lastTop3)}.\n` +
              `Bu ay (${currentKey}) toplam giderin ${formatTRY(
                currentTotal
              )} TL. En büyük 3 kalem: ${listLine(currentTop3)}.\n` +
              `Aylık değişim: ${formatTRY(change)} TL${
                changePct !== null ? ` (%${changePct.toFixed(1)})` : ""
              }.\n` +
              `${analizLine("Geçen ay", lastAnaliz)}\n${analizLine("Bu ay", currentAnaliz)}.`;
        replyWithText(reply);
      } catch (err: any) {
        replyWithText("Geçen ay harcama verisi alınamadı.");
      }
      return;
    }

    if (
      intent === "MARKET_RATES" &&
      hasAny(["anlık", "canlı", "güncel", "şu an", "spot", "anlık kur", "güncel kur"])
    ) {
      const latest = await fetchMarketLatest();
      const data = latest ?? marketData;
      const rateItems = [
        { key: "USD/TRY", labels: ["dolar", "usd"], keys: ["USDTRY", "USD/TRY", "USD_TRY"] },
        { key: "EUR/TRY", labels: ["euro", "eur"], keys: ["EURTRY", "EUR/TRY", "EUR_TRY"] },
        { key: "GBP/TRY", labels: ["sterlin", "gbp"], keys: ["GBPTRY", "GBP/TRY", "GBP_TRY"] },
        { key: "JPY/TRY", labels: ["yen", "jpy", "japon"], keys: ["JPYTRY", "JPY/TRY", "JPY_TRY"] },
        { key: "CHF/TRY", labels: ["frank", "chf", "isviçre", "isvicre"], keys: ["CHFTRY", "CHF/TRY", "CHF_TRY"] },
        { key: "CAD/TRY", labels: ["kanada", "cad"], keys: ["CADTRY", "CAD/TRY", "CAD_TRY"] },
        { key: "AUD/TRY", labels: ["avustralya", "aud"], keys: ["AUDTRY", "AUD/TRY", "AUD_TRY"] },
        { key: "NZD/TRY", labels: ["yeni zelanda", "nzd"], keys: ["NZDTRY", "NZD/TRY", "NZD_TRY"] },
        { key: "SEK/TRY", labels: ["isvec", "isveç", "sek"], keys: ["SEKTRY", "SEK/TRY", "SEK_TRY"] },
        { key: "NOK/TRY", labels: ["norvec", "norveç", "nok"], keys: ["NOKTRY", "NOK/TRY", "NOK_TRY"] },
        { key: "DKK/TRY", labels: ["danimarka", "dkk"], keys: ["DKKTRY", "DKK/TRY", "DKK_TRY"] },
        { key: "PLN/TRY", labels: ["polonya", "pln", "zloti", "zloty"], keys: ["PLNTRY", "PLN/TRY", "PLN_TRY"] },
        {
          key: "Gram Altın",
          labels: ["altın", "gram"],
          keys: ["GRAM_ALTIN_TRY", "GRAM_ALTIN", "GRAM/TRY", "XAU_TRY", "XAUTRY"],
        },
      ];

      const wantsSpecific = rateItems.some((r) => r.labels.some((l) => lowered.includes(l)));
      const list = rateItems
        .filter((r) => (wantsSpecific ? r.labels.some((l) => lowered.includes(l)) : true))
        .map((r) => {
          const val = getRateFrom(data, r.keys);
          return Number.isFinite(val) ? `${r.key}: ₺ ${formatTRY(val as number)}` : null;
        })
        .filter(Boolean) as string[];

      if (list.length === 0) {
        return replyWithText("Kur verileri şu an alınamadı. Biraz sonra tekrar dener misin?");
      }
      return replyWithText(list.join("\n"));
    }

    if (intent === "MONTHLY_INCOME_CURRENT" || hasAny(["bu ay toplam gelir", "bu ayki gelir"])) {
      const key = currentMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Bu ay (${key}) toplam gelir ${formatTRY(analiz.aylikGelir)} TL.`
          : `Bu ay (${key}) için gelir verisi yok.`
      );
    }

    if (intent === "MONTHLY_EXPENSE_CURRENT" || hasAny(["bu ay toplam gider", "bu ayki gider"])) {
      const key = currentMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Bu ay (${key}) toplam gider ${formatTRY(analiz.aylikGider)} TL.`
          : `Bu ay (${key}) için gider verisi yok.`
      );
    }

    if (intent === "MONTHLY_INCOME_LAST" || lowered.includes("geçen ay toplam gelir")) {
      const key = lastMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Geçen ay (${key}) toplam gelir ${formatTRY(analiz.aylikGelir)} TL.`
          : `Geçen ay (${key}) için gelir verisi yok.`
      );
    }

    if (intent === "MONTHLY_EXPENSE_LAST" || lowered.includes("geçen ay toplam gider")) {
      const key = lastMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Geçen ay (${key}) toplam gider ${formatTRY(analiz.aylikGider)} TL.`
          : `Geçen ay (${key}) için gider verisi yok.`
      );
    }

    if (intent === "MONTHLY_COMPARE" || lowered.includes("bu ay vs geçen ay kıyas") || lowered.includes("kıyas")) {
      const lastKey = lastMonthKey();
      const currentKey = currentMonthKey();
      const [lastAnaliz, currentAnaliz] = await Promise.all([
        getAnalizFor(lastKey),
        getAnalizFor(currentKey),
      ]);
      if (!lastAnaliz || !currentAnaliz) {
        return replyWithText("Kıyas için yeterli veri yok.");
      }
      const gelirDiff = currentAnaliz.aylikGelir - lastAnaliz.aylikGelir;
      const giderDiff = currentAnaliz.aylikGider - lastAnaliz.aylikGider;
      return replyWithText(
        `Gelir kıyas: Bu ay ${formatTRY(currentAnaliz.aylikGelir)} TL, geçen ay ${formatTRY(
          lastAnaliz.aylikGelir
        )} TL (fark ${formatTRY(gelirDiff)} TL).\n` +
          `Gider kıyas: Bu ay ${formatTRY(currentAnaliz.aylikGider)} TL, geçen ay ${formatTRY(
            lastAnaliz.aylikGider
          )} TL (fark ${formatTRY(giderDiff)} TL).`
      );
    }

    if (intent === "TOP_EXPENSE_CURRENT" || lowered.includes("bu ay en çok gider")) {
      const key = currentMonthKey();
      const summary = await fetchMonthlySummary(key);
      const expenses = summary.filter((x) => x.tip === "GIDER");
      const top = [...expenses].sort((a, b) => b.toplamTutar - a.toplamTutar)[0];
      return replyWithText(
        top
          ? `Bu ay (${key}) en yüksek gider: ${top.kategoriAd} (${formatTRY(top.toplamTutar)} TL).`
          : `Bu ay (${key}) için gider verisi yok.`
      );
    }

    if (intent === "TOP_EXPENSE_LAST" || lowered.includes("geçen ay en çok gider")) {
      const key = lastMonthKey();
      const summary = await fetchMonthlySummary(key);
      const expenses = summary.filter((x) => x.tip === "GIDER");
      const top = [...expenses].sort((a, b) => b.toplamTutar - a.toplamTutar)[0];
      return replyWithText(
        top
          ? `Geçen ay (${key}) en yüksek gider: ${top.kategoriAd} (${formatTRY(top.toplamTutar)} TL).`
          : `Geçen ay (${key}) için gider verisi yok.`
      );
    }

    if (intent === "CATEGORY_CURRENT" || lowered.includes("kategori kırılımı bu ay")) {
      const key = currentMonthKey();
      const summary = await fetchMonthlySummary(key);
      const expenses = summary.filter((x) => x.tip === "GIDER");
      const top5 = [...expenses].sort((a, b) => b.toplamTutar - a.toplamTutar).slice(0, 5);
      return replyWithText(
        top5.length > 0
          ? `Bu ay (${key}) kategori kırılımı (top 5 gider):\n${top5
              .map((x, i) => `${i + 1}) ${x.kategoriAd} ${formatTRY(x.toplamTutar)} TL`)
              .join("\n")}`
          : `Bu ay (${key}) için kategori verisi yok.`
      );
    }

    if (intent === "CATEGORY_LAST" || lowered.includes("kategori kırılımı geçen ay")) {
      const key = lastMonthKey();
      const summary = await fetchMonthlySummary(key);
      const expenses = summary.filter((x) => x.tip === "GIDER");
      const top5 = [...expenses].sort((a, b) => b.toplamTutar - a.toplamTutar).slice(0, 5);
      return replyWithText(
        top5.length > 0
          ? `Geçen ay (${key}) kategori kırılımı (top 5 gider):\n${top5
              .map((x, i) => `${i + 1}) ${x.kategoriAd} ${formatTRY(x.toplamTutar)} TL`)
              .join("\n")}`
          : `Geçen ay (${key}) için kategori verisi yok.`
      );
    }

    if (intent === "INVESTMENT_SUMMARY" || lowered.includes("yatırım")) {
      const data = await fetchYatirimGraph("HESAP");
      if (!data) {
        return replyWithText("Yatırım verisi alınamadı.");
      }
      const points = Array.isArray(data.points) ? data.points : [];
      const sumKz = points.reduce((s: number, p: any) => s + (Number(p.karZarar) || 0), 0);
      const detailLines = points.map((p: any, i: number) => {
        const label = String(p.label ?? "Hesap");
        const kz = formatTRY(Number(p.karZarar) || 0);
        return `${i + 1}) ${label} ${kz} TL`;
      });
      const detail = detailLines.length ? `\nHesap bazlı K/Z:\n${detailLines.join("\n")}` : "";
      return replyWithText(`Toplam K/Z: ${formatTRY(sumKz)} TL.${detail}`);
    }

    const inferred = inferPredictSymbol(text);
    const predictSymbol = inferred ?? selectedSymbol;
    if (predictSymbol) {
      return sendPredictForSymbol(predictSymbol);
    }

    const data = await fetchFxData();
    if (data && data.length > 0) {
      const filterSymbol = inferred ?? selectedSymbol;
      const filtered = filterSymbol ? data.filter((x) => x.symbol === filterSymbol) : data;
      if (filtered.length > 0) {
        const lines = filtered
          .slice(0, 3)
          .map(
            (x) =>
              `${x.symbol} (${x.date}) | Risk: ${x.risk} | H1 ${format6(
                x.forecast?.h1
              )} · H3 ${format6(x.forecast?.h3)} · H7 ${format6(x.forecast?.h7)}`
          )
          .join("\n");
        const insight = filtered[0]?.insight ? `\n\n${filtered[0].insight}` : "";
        replyWithText(`${lines}${insight}`);
      }
    }
  }, [
    inputText,
    pushUserMessage,
    replyWithText,
    sendPredictForSymbol,
    fetchFxData,
    fetchMarketLatest,
    selectedSymbol,
    fetchMonthlySummary,
    fetchMonthlyAnaliz,
    getRateFrom,
    detectIntent,
    normalizeText,
    inferPredictSymbol,
    getSymbolRateFrom,
    marketData,
    sendPredictForSymbol,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <ScreenHeader
        title="SOHBET"
        subtitle="Piyasa Asistanı"
        left={<HeaderAction label="Geri" onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))} />}
        right={<HeaderAction label="Yenile" onPress={() => { fetchFxData(); fetchMarketLatest(); }} />}
      />

      <View style={styles.heroWrap}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />
        <Text style={styles.heroTitle}>Hazır sorular</Text>
        <Text style={styles.heroSubtitle}>
          Önce bir konu seç. Sonra uygun başlıklar gelir.
        </Text>
        <View style={styles.heroStatRow}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>Konu</Text>
            <Text style={styles.heroStatValue}>
              {selectedGroup
                ? QUESTION_GROUPS.find((g) => g.id === selectedGroup)?.title
                : "Seçilmedi"}
            </Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>İpucu</Text>
            <Text style={styles.heroStatValue}>Kısa sor</Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!selectedGroup ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Soru ile başla</Text>
              <Text style={styles.sectionHint}>Bir konu seç</Text>
            </View>
            <View style={styles.groupGrid}>
              {QUESTION_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={styles.groupCard}
                  activeOpacity={0.85}
                  onPress={() => setSelectedGroup(group.id)}
                >
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {QUESTION_GROUPS.find((g) => g.id === selectedGroup)?.title}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedGroup(null);
                  setSelectedSymbol(null);
                  setInputText("");
                }}
              >
                <Text style={styles.sectionLink}>Değistir</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chipGrid}>
              {QUESTION_GROUPS.find((g) => g.id === selectedGroup)?.items.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.chip,
                    selectedSymbol === normalizeSymbol(label) && styles.chipActive,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (label.includes("Geçen ay harcama")) {
                      setSelectedSymbol(null);
                      setInputText("Geçen ay harcama açıklaması istiyorum.");
                      return;
                    }
                    if (
                      label.includes("toplam gelir") ||
                      label.includes("toplam gider") ||
                      label.includes("kıyas") ||
                      label.includes("en çok gider") ||
                      label.includes("kategori") ||
                      label.includes("Yatırım") ||
                      label.includes("yatırım")
                    ) {
                      setSelectedSymbol(null);
                      setInputText(label);
                      return;
                    }
                    const symbol = normalizeSymbol(label);
                    setSelectedSymbol(symbol);
                    if (selectedGroup === "market") {
                      setInputText("");
                      sendPredictForSymbol(symbol, buildPrompt(symbol));
                      return;
                    }
                    setInputText(buildPrompt(symbol));
                  }}
                >
                  <Text style={styles.chipText}>{label}</Text>
                </TouchableOpacity>
              )) ?? null}
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sohbet</Text>
          <Text style={styles.sectionHint}>Mesajların burada görünür</Text>
        </View>

        <View style={styles.threadWrap}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.role === "user" ? styles.messageRowUser : styles.messageRowAssistant,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  msg.role === "user" ? styles.messageBubbleUser : styles.messageBubbleAssistant,
                ]}
              >
                <Text
                  style={[
                    styles.messageLabel,
                    msg.role === "user" ? styles.messageLabelUser : styles.messageLabelAssistant,
                  ]}
                >
                  {msg.role === "user" ? "Sen" : "Asistan"}
                </Text>
                <Text
                  style={[
                    styles.messageText,
                    msg.role === "user" ? styles.messageTextUser : styles.messageTextAssistant,
                  ]}
                >
                  {msg.text}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    msg.role === "user" ? styles.messageTimeUser : styles.messageTimeAssistant,
                  ]}
                >
                  {msg.time}
                </Text>
              </View>
            </View>
          ))}
          {messages.length === 0 ? (
            <Text style={styles.emptyChatText}>Henüz mesaj yok.</Text>
          ) : null}
        </View>

        {fxLoading || fxError || marketLoading || marketError ? (
          <View style={styles.stateBox}>
            {fxLoading || marketLoading ? <ActivityIndicator /> : null}
            {fxLoading || marketLoading ? <Text style={styles.stateText}>Yükleniyor...</Text> : null}
            {fxError ? <Text style={styles.errorText}>Hata: {fxError}</Text> : null}
            {marketError ? <Text style={styles.errorText}>Hata: {marketError}</Text> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.inputBar}>
        <View style={styles.inputWrap}>
          <TextInput
            placeholder="Örn: Bunlar hakkında bilgi almak istiyorum."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendBtn} activeOpacity={0.85} onPress={sendMessage}>
            <Text style={styles.sendBtnText}>Gönder</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors, mode: ThemeMode) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    heroWrap: {
      marginHorizontal: 16,
      marginTop: 6,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    heroGlowA: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.accentSoft,
      top: -120,
      right: -60,
    },
    heroGlowB: {
      position: "absolute",
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: colors.headerGlowA,
      bottom: -90,
      left: -60,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    heroSubtitle: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
    },
    heroStatRow: {
      marginTop: 14,
      flexDirection: "row",
      gap: 12,
    },
    heroStatCard: {
      flex: 1,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroStatLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
    heroStatValue: { color: colors.text, fontSize: 13, fontWeight: "900", marginTop: 6 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
      gap: 10,
    },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
    sectionHint: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    sectionLink: { color: colors.warning, fontSize: 11, fontWeight: "900" },
    groupGrid: {
      marginTop: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    groupCard: {
      width: "48%",
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    groupTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
    groupSubtitle: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 6 },
    chipGrid: {
      marginTop: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: { color: colors.text, fontSize: 12, fontWeight: "800" },
    threadWrap: {
      marginTop: 10,
      gap: 12,
    },
    emptyChatText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    messageRow: {
      flexDirection: "row",
    },
    messageRowUser: {
      justifyContent: "flex-end",
    },
    messageRowAssistant: {
      justifyContent: "flex-start",
    },
    messageBubble: {
      maxWidth: "86%",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
    },
    messageBubbleUser: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
      borderTopRightRadius: 6,
    },
    messageBubbleAssistant: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderTopLeftRadius: 6,
    },
    messageText: { fontSize: 13, fontWeight: "700", lineHeight: 20 },
    messageTextUser: { color: colors.onAccent },
    messageTextAssistant: { color: colors.text },
    messageTime: { marginTop: 8, fontSize: 10, fontWeight: "700" },
    messageTimeUser: { color: "rgba(11,15,26,0.6)" },
    messageTimeAssistant: { color: colors.textMuted },
    messageLabel: { fontSize: 10, fontWeight: "900", marginBottom: 6, letterSpacing: 0.4 },
    messageLabelUser: { color: "rgba(11,15,26,0.8)" },
    messageLabelAssistant: { color: colors.textMuted },
    inputBar: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 20 : 12,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 12,
      fontWeight: "700",
    },
    sendBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    sendBtnText: { color: colors.onAccent, fontSize: 12, fontWeight: "900" },
    inputHint: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
    },
    stateBox: {
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    stateText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    errorText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  });
