import axios from "axios";
import { OPENAI_API_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL } from "../config/ai";
import { INTENTS, INTENT_DESCRIPTIONS, IntentId } from "./chatIntents";

type IntentResult = {
  intent: IntentId;
  confidence: number;
  reason?: string;
};

const aiClient = axios.create({
  baseURL: OPENAI_API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

const getApiKey = () => OPENAI_API_KEY?.trim() || "";

const buildSystemPrompt = () => {
  const intentLines = INTENTS.map((id) => `- ${id}: ${INTENT_DESCRIPTIONS[id]}`).join("\n");
  return [
    "You are a strict intent classifier for a finance assistant.",
    "Return only JSON with keys: intent, confidence, reason.",
    "If the message doesn't match any intent, return intent=UNKNOWN with confidence<=0.4.",
    "Intents:",
    intentLines,
  ].join("\n");
};

const safeJsonParse = (raw: string): IntentResult | null => {
  try {
    const parsed = JSON.parse(raw);
    const intent = typeof parsed?.intent === "string" ? parsed.intent.trim() : "UNKNOWN";
    const confidence = Number(parsed?.confidence);
    const reason = typeof parsed?.reason === "string" ? parsed.reason : undefined;
    const normalizedIntent = (INTENTS as readonly string[]).includes(intent) ? intent : "UNKNOWN";
    return {
      intent: normalizedIntent as IntentId,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      reason,
    };
  } catch {
    return null;
  }
};

export async function detectIntentWithOpenAI(message: string): Promise<IntentResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return detectIntentLocal(message);
  }
  const res = await aiClient.post(
    "/chat/completions",
    {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: message },
      ],
      temperature: 0,
      max_tokens: 120,
      response_format: { type: "json_object" },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const content = res?.data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return { intent: "UNKNOWN", confidence: 0 };
  }

  const parsed = safeJsonParse(content);
  return parsed ?? { intent: "UNKNOWN", confidence: 0 };
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasAny = (text: string, list: string[]) => list.some((p) => text.includes(p));

export function detectIntentLocal(message: string): IntentResult {
  const t = normalize(message);
  if (!t) return { intent: "UNKNOWN", confidence: 0 };

  if (hasAny(t, ["usd", "dolar", "dolar kaç", "usdtry"])) return { intent: "USDTRY", confidence: 0.7 };
  if (hasAny(t, ["eur", "euro", "eurtry"])) return { intent: "EURTRY", confidence: 0.7 };
  if (hasAny(t, ["gbp", "sterlin", "gbptry"])) return { intent: "GBPTRY", confidence: 0.7 };
  if (hasAny(t, ["xau", "altın", "altin", "gram altın", "xauusd"])) return { intent: "XAUUSD", confidence: 0.6 };
  if (hasAny(t, ["xag", "gümüş", "gumus", "xagusd"])) return { intent: "XAGUSD", confidence: 0.6 };
  if (hasAny(t, ["btc", "bitcoin", "btcusd"])) return { intent: "BTCUSD", confidence: 0.7 };
  if (hasAny(t, ["eth", "ethereum", "ethusd"])) return { intent: "ETHUSD", confidence: 0.7 };

  if (hasAny(t, ["bu ay", "gelir", "toplam gelir"]) && !t.includes("geçen ay")) {
    return { intent: "THIS_MONTH_INCOME", confidence: 0.7 };
  }
  if (hasAny(t, ["bu ay", "gider", "harcadım", "harcama", "masraf"]) && !t.includes("geçen ay")) {
    return { intent: "THIS_MONTH_EXPENSE", confidence: 0.7 };
  }
  if (hasAny(t, ["geçen ay", "gelir"])) return { intent: "LAST_MONTH_INCOME", confidence: 0.7 };
  if (hasAny(t, ["geçen ay", "gider", "harcadım", "harcama", "masraf"])) {
    return { intent: "LAST_MONTH_EXPENSE", confidence: 0.7 };
  }
  if (hasAny(t, ["kıyas", "karşılaştır", "bu ay vs geçen ay"])) {
    return { intent: "MONTH_COMPARISON", confidence: 0.6 };
  }

  if (hasAny(t, ["bu ay", "en çok", "kategori"])) return { intent: "TOP_CATEGORY_THIS_MONTH", confidence: 0.6 };
  if (hasAny(t, ["geçen ay", "en çok", "kategori"])) return { intent: "TOP_CATEGORY_LAST_MONTH", confidence: 0.6 };
  if (hasAny(t, ["bu ay", "kategori", "kırılım", "dağılım"])) {
    return { intent: "CATEGORY_BREAKDOWN_THIS_MONTH", confidence: 0.6 };
  }
  if (hasAny(t, ["geçen ay", "kategori", "kırılım", "dağılım"])) {
    return { intent: "CATEGORY_BREAKDOWN_LAST_MONTH", confidence: 0.6 };
  }

  if (hasAny(t, ["yatırım", "portföy", "kar", "zarar", "kâr", "özet"])) {
    return { intent: "INVESTMENT_SUMMARY", confidence: 0.6 };
  }

  return { intent: "UNKNOWN", confidence: 0.2 };
}
