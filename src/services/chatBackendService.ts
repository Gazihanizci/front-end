import axios from "axios";
import api, { BASE_URL } from "../config/api";
import { INTENT_LABELS, IntentId } from "./chatIntents";

const buildMarketBaseUrl = () => {
  const raw = String(BASE_URL || "").trim();
  const match = raw.match(/^(https?:)\/\/([^:/]+)/i);
  if (match) {
    return `${match[1]}//${match[2]}:8090`;
  }
  return "http://127.0.0.1:8090";
};

const marketBaseUrl = buildMarketBaseUrl();
const PREDICT_URL = "http://192.168.234.156:8000/predict";

type FxAssistantItem = {
  date: string;
  symbol: string;
  forecast: { h1: number; h3: number; h7: number };
  risk: "LOW" | "MED" | "HIGH";
  insight?: string;
};

const format6 = (v: number) => Number(v).toFixed(6);

const fetchPredictForSymbol = async (symbol: string) => {
  const res = await axios.get(PREDICT_URL, { timeout: 15000 });
  const list = Array.isArray(res?.data) ? (res.data as FxAssistantItem[]) : [];
  const filtered = list.filter((x) => String(x.symbol).toUpperCase() === symbol.toUpperCase());
  if (filtered.length === 0) return null;
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
  return `${lines}${insight}`;
};

const pickValue = (data: any) => {
  if (data == null) return null;
  if (typeof data === "number") return data;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    if ("message" in data) return data.message;
    if ("value" in data) return data.value;
    if ("result" in data) return data.result;
    if ("amount" in data) return data.amount;
  }
  return null;
};

const formatResponse = (intent: Exclude<IntentId, "UNKNOWN">, data: any) => {
  const label = INTENT_LABELS[intent];
  const value = pickValue(data);
  if (value == null) {
    return "Cevap alınamadı.";
  }
  if (typeof value === "string") return value;
  return `${label}: ${value}`;
};

export async function fetchIntentAnswer(intent: IntentId): Promise<string> {
  try {
    if (intent === "UNKNOWN") {
      return "Anlayamadım. Hazır sorulardan birini sorabilir misin?";
    }
    if (
      intent === "USDTRY" ||
      intent === "EURTRY" ||
      intent === "GBPTRY" ||
      intent === "XAUUSD" ||
      intent === "XAGUSD" ||
      intent === "BTCUSD" ||
      intent === "ETHUSD"
    ) {
      const symbolMap: Record<
        "USDTRY" | "EURTRY" | "GBPTRY" | "XAUUSD" | "XAGUSD" | "BTCUSD" | "ETHUSD",
        string
      > = {
        USDTRY: "USDTRY",
        EURTRY: "EURTRY",
        GBPTRY: "GBPTRY",
        XAUUSD: "XAUUSD",
        XAGUSD: "XAGUSD",
        BTCUSD: "BTCUSD",
        ETHUSD: "ETHUSD",
      };
      const reply = await fetchPredictForSymbol(symbolMap[intent]);
      return reply ?? "Tahmin verisi alınamadı.";
    }

    if (
      intent === "THIS_MONTH_INCOME" ||
      intent === "THIS_MONTH_EXPENSE" ||
      intent === "LAST_MONTH_INCOME" ||
      intent === "LAST_MONTH_EXPENSE" ||
      intent === "MONTH_COMPARISON"
    ) {
      const res = await api.get("/api/aylik-analiz");
      const list = Array.isArray(res?.data) ? res.data : [];
      const now = new Date();
      const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const currentKey = ym(now);
      const lastKey = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const pick = (key: string) => list.find((x: any) => String(x.yilAy).slice(0, 7) === key);
      const current = pick(currentKey);
      const last = pick(lastKey);
      if (intent === "THIS_MONTH_INCOME") {
        return current ? `Bu ay (${currentKey}) toplam gelir ${current.aylikGelir} TL.` : `Bu ay (${currentKey}) için gelir verisi yok.`;
      }
      if (intent === "THIS_MONTH_EXPENSE") {
        return current ? `Bu ay (${currentKey}) toplam gider ${current.aylikGider} TL.` : `Bu ay (${currentKey}) için gider verisi yok.`;
      }
      if (intent === "LAST_MONTH_INCOME") {
        return last ? `Geçen ay (${lastKey}) toplam gelir ${last.aylikGelir} TL.` : `Geçen ay (${lastKey}) için gelir verisi yok.`;
      }
      if (intent === "LAST_MONTH_EXPENSE") {
        return last ? `Geçen ay (${lastKey}) toplam gider ${last.aylikGider} TL.` : `Geçen ay (${lastKey}) için gider verisi yok.`;
      }
      if (intent === "MONTH_COMPARISON") {
        if (!current || !last) return "Kıyas için yeterli veri yok.";
        const gelirDiff = Number(current.aylikGelir || 0) - Number(last.aylikGelir || 0);
        const giderDiff = Number(current.aylikGider || 0) - Number(last.aylikGider || 0);
        return `Gelir kıyas: Bu ay ${current.aylikGelir} TL, geçen ay ${last.aylikGelir} TL (fark ${gelirDiff} TL).\nGider kıyas: Bu ay ${current.aylikGider} TL, geçen ay ${last.aylikGider} TL (fark ${giderDiff} TL).`;
      }
    }

    if (
      intent === "TOP_CATEGORY_THIS_MONTH" ||
      intent === "TOP_CATEGORY_LAST_MONTH" ||
      intent === "CATEGORY_BREAKDOWN_THIS_MONTH" ||
      intent === "CATEGORY_BREAKDOWN_LAST_MONTH"
    ) {
      const now = new Date();
      const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const currentKey = ym(now);
      const lastKey = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const key = intent.includes("LAST_MONTH") ? lastKey : currentKey;
      const res = await api.get("/api/categorysummary/monthly", { params: { yilAy: key } });
      const list = Array.isArray(res?.data) ? res.data : [];
      const expenses = list.filter((x: any) => x.tip === "GIDER");
      if (intent === "TOP_CATEGORY_THIS_MONTH" || intent === "TOP_CATEGORY_LAST_MONTH") {
        const top = [...expenses].sort((a, b) => Number(b.toplamTutar) - Number(a.toplamTutar))[0];
        return top
          ? `${key} en yüksek gider: ${top.kategoriAd} (${top.toplamTutar} TL).`
          : `${key} için gider verisi yok.`;
      }
      const top5 = [...expenses].sort((a, b) => Number(b.toplamTutar) - Number(a.toplamTutar)).slice(0, 5);
      return top5.length > 0
        ? `${key} kategori kırılımı (top 5 gider):\n${top5
            .map((x, i) => `${i + 1}) ${x.kategoriAd} ${x.toplamTutar} TL`)
            .join("\n")}`
        : `${key} için kategori verisi yok.`;
    }

    if (intent === "INVESTMENT_SUMMARY") {
      const res = await api.get("/api/yatirim/graph", { params: { groupBy: "HESAP" } });
      const data = res?.data;
      if (!data) return "Yatırım verisi alınamadı.";
      const points = Array.isArray(data.points) ? data.points : [];
      const sumKz = points.reduce((s: number, p: any) => s + (Number(p.karZarar) || 0), 0);
      const detailLines = points.map((p: any, i: number) => {
        const label = String(p.label ?? "Hesap");
        const kz = Number(p.karZarar) || 0;
        return `${i + 1}) ${label} ${kz} TL`;
      });
      const detail = detailLines.length ? `\nHesap bazlı K/Z:\n${detailLines.join("\n")}` : "";
      return `Toplam K/Z: ${sumKz} TL.${detail}`;
    }

    return "Cevap alınamadı.";
  } catch {
    return "Şu anda cevap veremiyorum. Biraz sonra tekrar dener misin?";
  }
}
