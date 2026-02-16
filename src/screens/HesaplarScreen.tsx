import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import api, { BASE_URL } from "../config/api";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import MessageBox from "../components/MessageBox";
import { ThemeColors, useTheme } from "../theme/theme";
import {
  changeYatirimAdet,
  createYatirim,
  YatirimCreateRequest,
  YatirimCreateResponse,
  YatirimVarlikTuru,
  getMyYatirimlar,
  increaseYatirim,
} from "../services/yatirimService";

type Props = NativeStackScreenProps<RootStackParamList, "Hesaplar">;

type MarketLatestResponse = {
  ok: boolean;
  ts: number;
  source?: string;
  data: Record<string, { value: number }>;
};

const formatTRY = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const parseNumberTR = (s: string) => {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

export default function HesaplarScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [userInfo, setUserInfo] = useState<{ aileId: number | null } | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketLatestResponse["data"] | null>(null);
  const [yatirimlar, setYatirimlar] = useState<YatirimCreateResponse[]>([]);
  const [yatirimLoading, setYatirimLoading] = useState(true);
  const [yatirimError, setYatirimError] = useState<string | null>(null);
  const [actionVisible, setActionVisible] = useState(false);
  const [actionType, setActionType] = useState<"ARTIR" | "AZALT">("AZALT");
  const [actionAmount, setActionAmount] = useState("");
  const [actionTarget, setActionTarget] = useState<YatirimCreateResponse | null>(null);
  const [actionSaving, setActionSaving] = useState(false);

  const [hesapAdi, setHesapAdi] = useState("");
  const [varlikTuru, setVarlikTuru] = useState<YatirimVarlikTuru>("USD");
  const [adetText, setAdetText] = useState("");
  const [ilkAlisText, setIlkAlisText] = useState("");
  const [saving, setSaving] = useState(false);

  const [msgVisible, setMsgVisible] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await api.get("/api/userinfo");
      setUserInfo({ aileId: res?.data?.aileId ?? null });
    } catch (e: any) {
      console.log("userinfo hata:", e?.response?.data || e?.message);
      setUserInfo(null);
    }
  }, []);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  const fetchMyYatirimlar = useCallback(async () => {
    setYatirimLoading(true);
    setYatirimError(null);
    try {
      const list = await getMyYatirimlar();
      setYatirimlar(list);
    } catch (e: any) {
      console.log("yatirim/mine hata:", e?.response?.data || e?.message);
      setYatirimError("Yatırım hesapları yüklenemedi.");
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

  const currentMarketPrice = useMemo(() => {
    if (varlikTuru === "TL") return undefined;
    if (varlikTuru === "USD") {
      return getRate(["USDTRY", "USD/TRY", "USD_TRY"]);
    }
    if (varlikTuru === "EUR") {
      return getRate(["EURTRY", "EUR/TRY", "EUR_TRY"]);
    }
    return getRate(["GRAM_ALTIN_TRY", "GRAM_ALTIN", "GRAM/TRY", "XAU_TRY", "XAUTRY"]);
  }, [getRate, varlikTuru]);

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
    fetchMarket();
  }, [fetchMarket]);

  useEffect(() => {
    fetchMyYatirimlar();
  }, [fetchMyYatirimlar]);
  useFocusEffect(
    useCallback(() => {
      fetchMyYatirimlar();
    }, [fetchMyYatirimlar])
  );

  const handleCreate = useCallback(async () => {
    const adet = parseNumberTR(adetText);
    const ilkAlisFiyati = parseNumberTR(ilkAlisText);
    const guncelFiyat =
      varlikTuru === "TL" ? Number(ilkAlisFiyati) : Number(currentMarketPrice);

    if (!userInfo?.aileId || !hesapAdi.trim() || !varlikTuru || !adetText.trim() || !ilkAlisText.trim()) {
      setMsgType("error");
      setMsgText("Tüm alanlar zorunlu.");
      setMsgVisible(true);
      return;
    }

    if (
      !Number.isFinite(adet) ||
      adet <= 0 ||
      !Number.isFinite(ilkAlisFiyati) ||
      ilkAlisFiyati <= 0 ||
      (varlikTuru !== "TL" && (!Number.isFinite(guncelFiyat) || guncelFiyat <= 0))
    ) {
      setMsgType("error");
      setMsgText(
        varlikTuru === "TL"
          ? "Sayısal alanlar 0'dan büyük olmalı."
          : "Sayısal alanlar 0'dan büyük olmalı ve güncel fiyat çekilebilmelidir."
      );
      setMsgVisible(true);
      return;
    }

    const payload: YatirimCreateRequest = {
      aileId: userInfo.aileId,
      hesapAdi: hesapAdi.trim(),
      varlikTuru,
      adet,
      ilkAlisFiyati,
      guncelFiyat,
    };

    setSaving(true);
    try {
      const data: YatirimCreateResponse = await createYatirim(payload);
      setMsgType("success");
      setMsgText("Yatırım hesabı oluşturuldu.");
      setMsgVisible(true);
      fetchMyYatirimlar();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data ||
        e?.message ||
        "Yatırım oluşturulamadı.";
      setMsgType("error");
      setMsgText(String(msg));
      setMsgVisible(true);
    } finally {
      setSaving(false);
    }
  }, [adetText, currentMarketPrice, hesapAdi, ilkAlisText, userInfo, varlikTuru]);

  const handleMsgClose = () => {
    setMsgVisible(false);
  };

  const openAction = (target: YatirimCreateResponse) => {
    setActionTarget(target);
    setActionAmount("");
    setActionType("AZALT");
    setActionVisible(true);
  };

  const handleActionSubmit = useCallback(async () => {
    if (!actionTarget) return;
    const amount = parseNumberTR(actionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsgType("error");
      setMsgText("Miktar 0'dan büyük olmalı.");
      setMsgVisible(true);
      return;
    }

    const actionMarketPrice = getMarketPriceFor(actionTarget.varlikTuru);
    if (actionType === "ARTIR") {
      if (!Number.isFinite(Number(actionMarketPrice)) || Number(actionMarketPrice) <= 0) {
        setMsgType("error");
        setMsgText("Alış fiyatı (güncel) alınamadı. Lütfen daha sonra tekrar deneyin.");
        setMsgVisible(true);
        return;
      }
    }

    const delta = actionType === "AZALT" ? -Math.abs(amount) : Math.abs(amount);
    setActionSaving(true);
    try {
      const data =
        actionType === "ARTIR"
          ? await increaseYatirim(
              actionTarget.yatirimId,
              Math.abs(amount),
              Number(actionMarketPrice)
            )
          : await changeYatirimAdet(actionTarget.yatirimId, delta);
      setMsgType("success");
      setMsgText(`Yeni bakiye: ${data.adet}`);
      setMsgVisible(true);
      setActionVisible(false);
      setActionTarget(null);
      setActionAmount("");
      fetchMyYatirimlar();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data ||
        e?.message ||
        "İşlem başarısız.";
      setMsgType("error");
      setMsgText(String(msg));
      setMsgVisible(true);
    } finally {
      setActionSaving(false);
    }
  }, [actionAmount, actionTarget, actionType, fetchMyYatirimlar, getMarketPriceFor]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Hesaplarım"
        subtitle="Yatırım hesabı oluştur"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => navigation.goBack()}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Yatırım Hesabı Oluştur</Text>

          <Text style={styles.label}>Hesap Adı</Text>
          <TextInput
            value={hesapAdi}
            onChangeText={setHesapAdi}
            placeholder="Örn: Dolar Yatırımı"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Varlık Türü</Text>
          <View style={styles.segmentRow}>
            {(["USD", "EUR", "ALTIN", "TL"] as YatirimVarlikTuru[]).map((t) => {
              const active = varlikTuru === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => setVarlikTuru(t)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Tutar</Text>
          <TextInput
            value={adetText}
            onChangeText={setAdetText}
            placeholder="Tutar Giriniz"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>İlk Alış Fiyatı</Text>
          <TextInput
            value={ilkAlisText}
            onChangeText={setIlkAlisText}
            placeholder="Örn: 30,00"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={styles.input}
          />

          {varlikTuru !== "TL" ? (
            <>
              <Text style={styles.label}>Güncel Fiyat</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>
                  {marketLoading
                    ? "Yükleniyor..."
                    : Number.isFinite(Number(currentMarketPrice))
                    ? formatTRY(Number(currentMarketPrice))
                    : "Veri yok"}
                </Text>
              </View>
            </>
          ) : null
          
          }

          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryBtnText}>Oluştur</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yatırım Hesaplarım</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{yatirimlar.length}</Text>
          </View>
        </View>

        {yatirimLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.warning} />
            <Text style={styles.muted}>Yükleniyor...</Text>
          </View>
        ) : yatirimError ? (
          <Text style={styles.error}>{yatirimError}</Text>
        ) : yatirimlar.length === 0 ? (
          <Text style={styles.muted}>Yatırım hesabı yok.</Text>
        ) : (
          yatirimlar.map((y) => {
            const isUp = Number(y.karZarar) >= 0;
            return (
              <View key={y.yatirimId} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{y.hesapAdi}</Text>
                  <Text style={styles.cardSub}>
                    {y.varlikTuru} • Tutar: {formatTRY(Number(y.adet))}
                  </Text>
                  <Text style={styles.cardSub}>
                    Güncel Değer: ₺ {formatTRY(Number(y.guncelDeger))}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.karZarar, isUp ? styles.karZararUp : styles.karZararDown]}>
                    {isUp ? "+" : "-"}₺ {formatTRY(Math.abs(Number(y.karZarar)))}
                  </Text>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openAction(y)}>
                    <Text style={styles.actionBtnText}>İşlemler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {actionVisible && (
        <View style={styles.actionOverlay}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionTitle}>İşlem</Text>
            <Text style={styles.actionSubtitle}>
              {actionTarget?.hesapAdi} • {actionTarget?.varlikTuru}
            </Text>

            <View style={styles.segmentRow}>
              {(["AZALT", "ARTIR"] as const).map((t) => {
                const active = actionType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => setActionType(t)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {t === "AZALT" ? "Düş" : "Ekle"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Miktar</Text>
            <TextInput
              value={actionAmount}
              onChangeText={setActionAmount}
              placeholder="Örn: 200"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />

            {actionTarget?.varlikTuru !== "TL" && (
              <>
                <Text style={styles.label}>Güncel Fiyat</Text>
                <View style={styles.readonlyBox}>
                  <Text style={styles.readonlyText}>
                    {marketLoading
                      ? "Yükleniyor..."
                      : Number.isFinite(Number(getMarketPriceFor(actionTarget?.varlikTuru)))
                      ? formatTRY(Number(getMarketPriceFor(actionTarget?.varlikTuru)))
                      : "Veri yok"}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, actionSaving && { opacity: 0.7 }]}
              onPress={handleActionSubmit}
              disabled={actionSaving}
            >
              {actionSaving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>{actionType === "AZALT" ? "Düş" : "Ekle"}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setActionVisible(false);
                setActionTarget(null);
              }}
              disabled={actionSaving}
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <MessageBox
        visible={msgVisible}
        title={msgType === "success" ? "Başarılı" : msgType === "error" ? "Hata" : "Bilgi"}
        message={msgText}
        type={msgType}
        onClose={handleMsgClose}
        confirmText="Tamam"
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingBottom: 24 },

    formCard: {
      marginTop: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 12 },
    label: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginTop: 8, marginBottom: 6 },
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    readonlyBox: {
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    readonlyText: { color: colors.text, fontSize: 13, fontWeight: "800" },
    segmentRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
    },
    segmentBtnActive: { backgroundColor: colors.warning, borderColor: colors.warning },
    segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
    segmentTextActive: { color: colors.onAccent },

    primaryBtn: {
      marginTop: 12,
      backgroundColor: colors.warning,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.onAccent, fontWeight: "900" },

    muted: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: 16, gap: 8 },

    sectionHeader: {
      marginTop: 6,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
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

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      gap: 10,
    },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
    cardSub: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: "700" },
    cardRight: { alignItems: "flex-end", gap: 8 },
    karZarar: { fontSize: 13, fontWeight: "900" },
    karZararUp: { color: colors.success },
    karZararDown: { color: colors.danger },

    actionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    actionBtnText: { color: colors.text, fontSize: 11, fontWeight: "800" },

    actionOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    actionSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
    actionSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 12, fontWeight: "700" },

    cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
    cancelText: { color: colors.textMuted, fontWeight: "800" },
  });
