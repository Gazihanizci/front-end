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
import api from "../config/api";

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

type FxAssistantItem = {
  date: string;
  symbol: string;
  forecast: Forecast;
  risk: "LOW" | "MED" | "HIGH";
  insight: string;
};

const SUGGESTIONS: string[] = [
  "USDTRY",
  "EURTRY",
  "GBPTRY",
  "XAUUSD (altın)",
  "XAGUSD (gümüş)",
  "BTCUSD",
  "ETHUSD",
  "Geçen ay harcama açıklaması",
  "Bu ay toplam gelir",
  "Bu ay toplam gider",
  "Geçen ay toplam gelir",
  "Geçen ay toplam gider",
  "Bu ay vs geçen ay kıyas",
  "Bu ay en çok gider",
  "Geçen ay en çok gider",
  "Bu ay kategori kırılımı",
  "Geçen ay kategori kırılımı",
  "Yatırım özeti",
  "Yatırım grafiği (HESAP)",
  "Yatırım grafiği (VARLIK)",
];
const ENDPOINT = "http://192.168.234.156:8000/predict";

export default function ChatScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const [fxData, setFxData] = useState<FxAssistantItem[]>([]);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

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
  }, [fetchFxData]);

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

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-u`, role: "user", text, time: nowTime() },
    ]);
    setInputText("");
    const lowered = text.toLowerCase();

    const getAnalizFor = async (key: string) => {
      const analizList = await fetchMonthlyAnaliz();
      return pickByYM(analizList, key);
    };

    const replyWithText = (reply: string) => {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: "assistant", text: reply, time: nowTime() },
      ]);
    };

    if (lowered.includes("geçen ay harcama")) {
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

    if (lowered.includes("bu ay toplam gelir")) {
      const key = currentMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Bu ay (${key}) toplam gelir ${formatTRY(analiz.aylikGelir)} TL.`
          : `Bu ay (${key}) için gelir verisi yok.`
      );
    }

    if (lowered.includes("bu ay toplam gider")) {
      const key = currentMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Bu ay (${key}) toplam gider ${formatTRY(analiz.aylikGider)} TL.`
          : `Bu ay (${key}) için gider verisi yok.`
      );
    }

    if (lowered.includes("geçen ay toplam gelir")) {
      const key = lastMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Geçen ay (${key}) toplam gelir ${formatTRY(analiz.aylikGelir)} TL.`
          : `Geçen ay (${key}) için gelir verisi yok.`
      );
    }

    if (lowered.includes("geçen ay toplam gider")) {
      const key = lastMonthKey();
      const analiz = await getAnalizFor(key);
      return replyWithText(
        analiz
          ? `Geçen ay (${key}) toplam gider ${formatTRY(analiz.aylikGider)} TL.`
          : `Geçen ay (${key}) için gider verisi yok.`
      );
    }

    if (lowered.includes("bu ay vs geçen ay kıyas") || lowered.includes("kıyas")) {
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

    if (lowered.includes("bu ay en çok gider")) {
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

    if (lowered.includes("geçen ay en çok gider")) {
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

    if (lowered.includes("bu ay kategori") || lowered.includes("kategori kırılımı bu ay")) {
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

    if (lowered.includes("geçen ay kategori") || lowered.includes("kategori kırılımı geçen ay")) {
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

    if (lowered.includes("yatırım")) {
      const groupBy = lowered.includes("varlık") ? "VARLIK" : "HESAP";
      const data = await fetchYatirimGraph(groupBy);
      if (!data) {
        return replyWithText("Yatırım verisi alınamadı.");
      }
      const totalMaliyet = formatTRY(Number(data.toplamMaliyet) || 0);
      const totalGuncel = formatTRY(Number(data.toplamGuncelDeger) || 0);
      const totalKarZarar = formatTRY(Number(data.toplamKarZarar) || 0);
      const points = Array.isArray(data.points) ? data.points : [];
      const top3 = points.slice(0, 3).map((p: any, i: number) => {
        const label = String(p.label ?? "");
        const kz = formatTRY(Number(p.karZarar) || 0);
        return `${i + 1}) ${label} ${kz} TL`;
      });
      const detail = top3.length > 0 ? `\nÖne çıkanlar:\n${top3.join("\n")}` : "";
      return replyWithText(
        `Yatırım özeti (${groupBy}): Maliyet ${totalMaliyet} TL, Güncel ${totalGuncel} TL, K/Z ${totalKarZarar} TL.${detail}`
      );
    }

    const data = await fetchFxData();
    if (data && data.length > 0) {
      const filtered = selectedSymbol ? data.filter((x) => x.symbol === selectedSymbol) : data;
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
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-a`, role: "assistant", text: `${lines}${insight}`, time: nowTime() },
        ]);
      }
    }
  }, [
    inputText,
    fetchFxData,
    selectedSymbol,
    fetchMonthlySummary,
    fetchMonthlyAnaliz,
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
        right={<HeaderAction label="Yenile" onPress={fetchFxData} />}
      />

      <View style={styles.heroWrap}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />
        <Text style={styles.heroTitle}>Hazır sorular</Text>
        <Text style={styles.heroSubtitle}>
          Aşağıdan bir enstrüman seç. “Bunlar hakkında bilgi almak istiyorum” diye sorabilirsin.
        </Text>
        <View style={styles.heroStatRow}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>Takip</Text>
            <Text style={styles.heroStatValue}>7 enstrüman</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>İpucu</Text>
            <Text style={styles.heroStatValue}>Detay iste</Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Enstrüman Seç</Text>
          <Text style={styles.sectionHint}>Bilgi almak için dokun</Text>
        </View>

        <View style={styles.chipGrid}>
          {SUGGESTIONS.map((label) => (
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
                setInputText(buildPrompt(symbol));
              }}
            >
              <Text style={styles.chipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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

        {fxLoading || fxError ? (
          <View style={styles.stateBox}>
            {fxLoading ? <ActivityIndicator /> : null}
            {fxLoading ? <Text style={styles.stateText}>Yükleniyor...</Text> : null}
            {fxError ? <Text style={styles.errorText}>Hata: {fxError}</Text> : null}
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
        <Text style={styles.inputHint}>
          Seçtiğin enstrüman için güncel özet ve açıklama isteyebilirsin.
        </Text>
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
