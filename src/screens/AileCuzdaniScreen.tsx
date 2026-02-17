
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
import * as Progress from "react-native-progress";
import Svg, { Circle, G } from "react-native-svg";
import api from "../config/api";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";
import {
  getStatus,
  requestPermission,
  PermissionStatus,
} from "../services/familyPermissionApi";

type Props = NativeStackScreenProps<RootStackParamList, "AileCuzdani">;

type AylikAnaliz = {
  yilAy: string;
  aylikGelir: number;
  aylikGider: number;
};

type CategorySummaryItem = {
  kategoriId: number;
  kategoriAd: string;
  tip: "GIDER" | "GELIR";
  toplamTutar: number;
};

type MemberSummaryItem = {
  uyeId: number;
  ad: string;
  soyad?: string;
  toplamTutar: number;
};
type UyeKategoriDagilimItem = {
  kullaniciId: number;
  adSoyad: string;
  kategoriId: number;
  kategoriAd: string;
  tip: "GELIR" | "GIDER";
  toplamTutar: number | string;
};
type MemberInfo = {
  kullaniciId: number;
  adSoyad: string;
};

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
  kategoriOzet: {
    kategoriId: number;
    kategoriAd: string;
    tip: "GELIR" | "GIDER";
    toplamTutar: number | string;
  }[];
  uyeKategoriDagilim: UyeKategoriDagilimItem[];
};

const formatTRY = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getCurrentYM = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const toNum = (v: any) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const splitName = (full: string) => {
  const clean = String(full || "").trim();
  if (!clean) return { ad: "Üye", soyad: "" };
  const parts = clean.split(" ").filter(Boolean);
  return {
    ad: parts[0] ?? clean,
    soyad: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
};

export default function AileCuzdaniScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [analiz, setAnaliz] = useState<AylikAnaliz | null>(null);
  const [loadingAnaliz, setLoadingAnaliz] = useState(true);

  const [categorySummary, setCategorySummary] = useState<CategorySummaryItem[]>([]);
  const [loadingCategorySummary, setLoadingCategorySummary] = useState(true);

  const [memberIncome, setMemberIncome] = useState<MemberSummaryItem[]>([]);
  const [memberExpense, setMemberExpense] = useState<MemberSummaryItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberList, setMemberList] = useState<MemberInfo[]>([]);
  const [memberCategoryRaw, setMemberCategoryRaw] = useState<UyeKategoriDagilimItem[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("NONE");
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);

  const fetchPermissionStatus = useCallback(async () => {
    setPermissionLoading(true);
    setPermissionError(null);
    try {
      const res = await getStatus();
      setPermissionStatus(res.status);
      return res.status;
    } catch (err: any) {
      console.log("İzin durumu hata:", err?.response?.data || err?.message);
      setPermissionError("İzin durumu alınamadı.");
      setPermissionStatus("NONE");
      return "NONE" as PermissionStatus;
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  const sendPermissionRequest = useCallback(async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    setPermissionError(null);
    try {
      const res = await requestPermission();
      setPermissionStatus(res.status === "APPROVED" ? "APPROVED" : "PENDING");
    } catch (err: any) {
      const status = err?.response?.status;
      console.log("İzin isteği hata:", status, err?.response?.data || err?.message);
      if (status === 409) {
        setPermissionStatus("PENDING");
      } else {
        setPermissionError("İzin isteği gönderilemedi.");
      }
    } finally {
      setPermissionBusy(false);
    }
  }, [permissionBusy]);

  const fetchFamilyWalletMonthly = useCallback(async () => {
    setLoadingAnaliz(true);
    setLoadingCategorySummary(true);
    setLoadingMembers(true);

    try {
      const yilAy = getCurrentYM();

      const res = await api.get<FamilyWalletResponse>("/api/familywallet/monthly", {
        params: { yilAy },
      });

      const data = res.data;

      const aileGelir = toNum(data.aileToplamGelir);
      const aileGider = toNum(data.aileToplamGider);
      setAnaliz({ yilAy: data.yilAy, aylikGelir: aileGelir, aylikGider: aileGider });

      const cats: CategorySummaryItem[] = (data.kategoriOzet || []).map((x) => ({
        kategoriId: Number(x.kategoriId),
        kategoriAd: String(x.kategoriAd ?? ""),
        tip: x.tip === "GELIR" ? "GELIR" : "GIDER",
        toplamTutar: toNum(x.toplamTutar),
      }));
      setCategorySummary(cats);

      const members = data.uyelerAylik || [];
      setMemberList(
        members.map((m) => ({
          kullaniciId: Number(m.kullaniciId),
          adSoyad: String(m.adSoyad ?? ""),
        }))
      );

      const incomeMembers: MemberSummaryItem[] = members
        .map((m) => {
          const nm = splitName(m.adSoyad);
          return {
            uyeId: Number(m.kullaniciId),
            ad: nm.ad,
            soyad: nm.soyad,
            toplamTutar: toNum(m.aylikGelir),
          };
        })
        .filter((x) => x.toplamTutar > 0)
        .sort((a, b) => b.toplamTutar - a.toplamTutar);

      const expenseMembers: MemberSummaryItem[] = members
        .map((m) => {
          const nm = splitName(m.adSoyad);
          return {
            uyeId: Number(m.kullaniciId),
            ad: nm.ad,
            soyad: nm.soyad,
            toplamTutar: toNum(m.aylikGider),
          };
        })
        .filter((x) => x.toplamTutar > 0)
        .sort((a, b) => b.toplamTutar - a.toplamTutar);

      setMemberIncome(incomeMembers);
      setMemberExpense(expenseMembers);
      setMemberCategoryRaw(data.uyeKategoriDagilim || []);
    } catch (err: any) {
      console.log("FamilyWallet çekme hata:", err?.response?.data || err?.message);
      setAnaliz(null);
      setCategorySummary([]);
      setMemberIncome([]);
      setMemberExpense([]);
      setMemberList([]);
      setMemberCategoryRaw([]);
    } finally {
      setLoadingAnaliz(false);
      setLoadingCategorySummary(false);
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissionStatus();
  }, [fetchPermissionStatus]);

  useEffect(() => {
    if (permissionLoading) return;
    if (permissionStatus === "APPROVED") {
      fetchFamilyWalletMonthly();
      return;
    }
    setLoadingAnaliz(false);
    setLoadingCategorySummary(false);
    setLoadingMembers(false);
  }, [fetchFamilyWalletMonthly, permissionLoading, permissionStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const status = await fetchPermissionStatus();
      if (status === "APPROVED") {
        await fetchFamilyWalletMonthly();
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchFamilyWalletMonthly, fetchPermissionStatus]);

  const totalIncome = analiz?.aylikGelir ?? 0;
  const totalExpense = analiz?.aylikGider ?? 0;
  const total = totalIncome + totalExpense;
  const incomePct = total === 0 ? 0 : Math.round((totalIncome / total) * 100);
  const expensePct = total === 0 ? 0 : Math.round((totalExpense / total) * 100);

  const giderItems = useMemo(
    () =>
      categorySummary
        .filter((x) => x.tip === "GIDER")
        .sort((a, b) => b.toplamTutar - a.toplamTutar),
    [categorySummary]
  );
  const categoryExpenseTotal = useMemo(
    () => giderItems.reduce((sum, x) => sum + (Number(x.toplamTutar) || 0), 0),
    [giderItems]
  );

  const memberIncomeTotal = useMemo(
    () => memberIncome.reduce((sum, x) => sum + (Number(x.toplamTutar) || 0), 0),
    [memberIncome]
  );
  const memberExpenseTotal = useMemo(
    () => memberExpense.reduce((sum, x) => sum + (Number(x.toplamTutar) || 0), 0),
    [memberExpense]
  );
  const ringSize = 170;
  const ringStroke = 18;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const expensePalette = useMemo(
    () =>
      mode === "light"
        ? ["#fecdd3", "#fed7aa", "#fde68a", "#bbf7d0", "#bae6fd", "#ddd6fe"]
        : ["#fb7185", "#f97316", "#facc15", "#22c55e", "#38bdf8", "#a78bfa"],
    [mode]
  );
  const memberPalette = useMemo(
    () =>
      mode === "light"
        ? ["#bae6fd", "#bbf7d0", "#fde68a", "#fecdd3", "#ddd6fe", "#fed7aa"]
        : ["#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a78bfa", "#f97316"],
    [mode]
  );
  const canShowWallet = permissionStatus === "APPROVED";

  const memberCategoryGroups = useMemo(() => {
    const map = new Map<
      number,
      {
        kullaniciId: number;
        adSoyad: string;
        total: number;
        categories: { kategoriId: number; kategoriAd: string; toplamTutar: number }[];
      }
    >();

    memberList.forEach((m) => {
      map.set(m.kullaniciId, {
        kullaniciId: m.kullaniciId,
        adSoyad: m.adSoyad,
        total: 0,
        categories: [],
      });
    });

    const onlyExpense = (memberCategoryRaw || []).filter((x) => x.tip === "GIDER");
    onlyExpense.forEach((item) => {
      const uid = Number(item.kullaniciId);
      const amount = toNum(item.toplamTutar);
      const existing =
        map.get(uid) ??
        ({
          kullaniciId: uid,
          adSoyad: String(item.adSoyad ?? "Üye"),
          total: 0,
          categories: [],
        } as {
          kullaniciId: number;
          adSoyad: string;
          total: number;
          categories: { kategoriId: number; kategoriAd: string; toplamTutar: number }[];
        });

      const catId = Number(item.kategoriId);
      const catName = String(item.kategoriAd ?? "");
      const idx = existing.categories.findIndex((c) => c.kategoriId === catId);
      if (idx >= 0) {
        existing.categories[idx] = {
          ...existing.categories[idx],
          toplamTutar: existing.categories[idx].toplamTutar + amount,
        };
      } else {
        existing.categories.push({ kategoriId: catId, kategoriAd: catName, toplamTutar: amount });
      }
      existing.total += amount;
      map.set(uid, existing);
    });

    return Array.from(map.values()).map((m) => ({
      ...m,
      categories: m.categories.sort((a, b) => b.toplamTutar - a.toplamTutar),
    }));
  }, [memberCategoryRaw, memberList]);

  const memberCategoryHasExpense = useMemo(
    () => memberCategoryRaw.some((x) => x.tip === "GIDER"),
    [memberCategoryRaw]
  );

  const renderMemberCategoryCard = useCallback(
    ({
      item,
    }: {
      item: {
        kullaniciId: number;
        adSoyad: string;
        total: number;
        categories: { kategoriId: number; kategoriAd: string; toplamTutar: number }[];
      };
    }) => {
      const total = item.total || 0;
      return (
        <View style={styles.memberCard}>
          <Text style={styles.memberCardTitle} numberOfLines={1}>
            {item.adSoyad || "Üye"}
          </Text>
          <View style={styles.memberCardContent}>
            <View style={styles.memberDonutWrap}>
              <Svg width={ringSize} height={ringSize}>
                <G rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`}>
                  {(() => {
                    const maxR = ringRadius;
                    const barStroke = 10;
                    const gap = 4;
                    const maxBars = 6;
                    const raw = item.categories.length ? item.categories : [];
                    const top = raw.slice(0, maxBars);
                    const rest = raw.slice(maxBars);
                    const otherSum = rest.reduce((s, x) => s + (Number(x.toplamTutar) || 0), 0);
                    const bars =
                      otherSum > 0
                        ? [...top, { kategoriId: -999, kategoriAd: "Diğer", toplamTutar: otherSum }]
                        : top;
                    return bars.map((c, index) => {
                      const pct = total ? c.toplamTutar / total : 0;
                      const r = maxR - index * (barStroke + gap);
                      const circ = 2 * Math.PI * r;
                      if (r <= 0) return null;
                      return (
                        <React.Fragment key={`${item.kullaniciId}-${c.kategoriId}-${index}`}>
                          <Circle
                            cx={ringSize / 2}
                            cy={ringSize / 2}
                            r={r}
                            stroke={colors.divider}
                            strokeWidth={barStroke}
                            fill="transparent"
                          />
                          <Circle
                            cx={ringSize / 2}
                            cy={ringSize / 2}
                            r={r}
                            stroke={expensePalette[index % expensePalette.length]}
                            strokeWidth={barStroke}
                            strokeDasharray={`${circ * pct} ${circ - circ * pct}`}
                            strokeDashoffset={0}
                            strokeLinecap="round"
                            fill="transparent"
                          />
                        </React.Fragment>
                      );
                    });
                  })()}
                </G>
              </Svg>
              <View style={styles.donutCenter}>
                <Text style={styles.donutCenterTitle}>Toplam Gider</Text>
                <Text style={styles.donutCenterSub}>TL {formatTRY(total)}</Text>
              </View>
            </View>

            <ScrollView
              style={styles.memberCategoryList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.memberCategoryListContent}
            >
              {(item.categories.length
                ? item.categories
                : [{ kategoriId: -1, kategoriAd: "Gider yok", toplamTutar: 0 }]
              ).map((c, idx) => (
                <View key={`${item.kullaniciId}-${c.kategoriId}-${idx}`} style={styles.memberCategoryRow}>
                  <View
                    style={[
                      styles.memberCategoryDot,
                      { backgroundColor: expensePalette[idx % expensePalette.length] },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberCategoryName} numberOfLines={1}>
                      {c.kategoriAd || "Gider yok"}
                    </Text>
                    <Text style={styles.memberCategoryAmount}>TL {formatTRY(c.toplamTutar)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      );
    },
    [colors.divider, expensePalette, ringRadius, ringSize, styles]
  );
  return (
    <View style={styles.container}>
      <View style={styles.bgCircleOne} />
      <View style={styles.bgCircleTwo} />
      <View style={styles.bgRing} />
      <ScreenHeader
        title="Aile Cüzdanı"
        subtitle="Aile bütçesi özeti"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => navigation.goBack()}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />
        }
      >
        {permissionLoading ? (
          <View style={styles.permissionCard}>
            <View style={styles.loadingInline}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.loadingText}>İzin kontrol ediliyor...</Text>
            </View>
          </View>
        ) : !canShowWallet ? (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Aile Cüzdanı İzni</Text>
            {permissionError ? (
              <Text style={styles.permissionError}>{permissionError}</Text>
            ) : permissionStatus === "PENDING" ? (
              <Text style={styles.permissionSub}>İsteğin beklemede.</Text>
            ) : (
              <Text style={styles.permissionSub}>
                Aile cüzdanını görüntülemek için izin almalısın.
              </Text>
            )}

            {(permissionStatus === "NONE" || permissionStatus === "REJECTED") && (
              <TouchableOpacity
                style={[styles.permissionBtn, permissionBusy && { opacity: 0.6 }]}
                onPress={sendPermissionRequest}
                activeOpacity={0.85}
                disabled={permissionBusy}
              >
                <Text style={styles.permissionBtnText}>
                  {permissionBusy ? "Gönderiliyor..." : "İzin İste"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroTitle}>Aile Harcamaları</Text>
              <Text style={styles.heroSub}>Bu ay genel görünüm</Text>
            </View>
            <View style={styles.heroChip}>
              <Ionicons name="people-outline" size={14} color={colors.chipText} />
              <Text style={styles.heroChipText}>Aile</Text>
            </View>
          </View>

          {loadingAnaliz ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : (
            <View style={styles.donutRow}>
              <View style={styles.donutWrap}>
                <Progress.Circle
                  size={ringSize}
                  thickness={ringStroke}
                  progress={incomePct / 100}
                  color={colors.success}
                  unfilledColor={colors.danger}
                  borderWidth={0}
                  showsText={false}
                />
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterTitle}>Net</Text>
                  <Text style={styles.donutCenterSub}>TL {formatTRY(totalIncome - totalExpense)}</Text>
                </View>
              </View>

              <View style={styles.kpiCol}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Toplam Gelir</Text>
                  <Text style={styles.kpiValue}>TL {formatTRY(totalIncome)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Toplam Gider</Text>
                  <Text style={styles.kpiValueDanger}>TL {formatTRY(totalExpense)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Üye Gelir Dağılımı</Text>
              <Text style={styles.cardSubtitle}>Aileye katkı</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{memberIncome.length}</Text>
            </View>
          </View>

          {loadingMembers ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : memberIncome.length === 0 ? (
            <Text style={styles.emptyText}>Üye gelir verisi yok</Text>
          ) : (
            <View style={styles.categoryDonutRow}>
              <View style={styles.categoryDonutWrap}>
                <Svg width={ringSize} height={ringSize}>
                  <G rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`}>
                    {memberIncome.reduce(
                      (acc: { offset: number; nodes: React.ReactNode[] }, item, index) => {
                        const pct = memberIncomeTotal ? item.toplamTutar / memberIncomeTotal : 0;
                        const segLen = ringCircumference * pct;
                        if (segLen > 0) {
                          acc.nodes.push(
                            <Circle
                              key={`${item.uyeId}-${index}`}
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={ringRadius}
                              stroke={memberPalette[index % memberPalette.length]}
                              strokeWidth={ringStroke}
                              strokeDasharray={`${segLen} ${ringCircumference - segLen}`}
                              strokeDashoffset={-acc.offset}
                              strokeLinecap="round"
                              fill="transparent"
                            />
                          );
                        }
                        acc.offset += segLen;
                        return acc;
                      },
                      { offset: 0, nodes: [] }
                    ).nodes}
                  </G>
                </Svg>
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterTitle}>Toplam Gelir</Text>
                  <Text style={styles.donutCenterSub}>TL {formatTRY(memberIncomeTotal)}</Text>
                </View>
              </View>

              <View style={styles.categoryList}>
                {memberIncome.slice(0, 5).map((item, index) => (
                  <View key={item.uyeId} style={styles.categoryRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: memberPalette[index % memberPalette.length] },
                      ]}
                    >
                      <Text style={styles.categoryBadgeText}>{item.ad?.[0]?.toUpperCase() ?? "?"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {`${item.ad} ${item.soyad ?? ""}`.trim()}
                      </Text>
                      <Text style={styles.categoryAmount}>TL {formatTRY(item.toplamTutar)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Üye Gider Dağılımı</Text>
              <Text style={styles.cardSubtitle}>Aile harcamaları</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{memberExpense.length}</Text>
            </View>
          </View>

          {loadingMembers ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : memberExpense.length === 0 ? (
            <Text style={styles.emptyText}>Üye gider verisi yok</Text>
          ) : (
            <View style={styles.categoryDonutRow}>
              <View style={styles.categoryDonutWrap}>
                <Svg width={ringSize} height={ringSize}>
                  <G rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`}>
                    {memberExpense.reduce(
                      (acc: { offset: number; nodes: React.ReactNode[] }, item, index) => {
                        const pct = memberExpenseTotal ? item.toplamTutar / memberExpenseTotal : 0;
                        const segLen = ringCircumference * pct;
                        if (segLen > 0) {
                          acc.nodes.push(
                            <Circle
                              key={`${item.uyeId}-${index}`}
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={ringRadius}
                              stroke={memberPalette[index % memberPalette.length]}
                              strokeWidth={ringStroke}
                              strokeDasharray={`${segLen} ${ringCircumference - segLen}`}
                              strokeDashoffset={-acc.offset}
                              strokeLinecap="round"
                              fill="transparent"
                            />
                          );
                        }
                        acc.offset += segLen;
                        return acc;
                      },
                      { offset: 0, nodes: [] }
                    ).nodes}
                  </G>
                </Svg>
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterTitle}>Toplam Gider</Text>
                  <Text style={styles.donutCenterSub}>TL {formatTRY(memberExpenseTotal)}</Text>
                </View>
              </View>

              <View style={styles.categoryList}>
                {memberExpense.slice(0, 5).map((item, index) => (
                  <View key={item.uyeId} style={styles.categoryRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: memberPalette[index % memberPalette.length] },
                      ]}
                    >
                      <Text style={styles.categoryBadgeText}>{item.ad?.[0]?.toUpperCase() ?? "?"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {`${item.ad} ${item.soyad ?? ""}`.trim()}
                      </Text>
                      <Text style={styles.categoryAmount}>TL {formatTRY(item.toplamTutar)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Gider Dağılımı</Text>
              <Text style={styles.cardSubtitle}>Kategorilere göre</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{giderItems.length}</Text>
            </View>
          </View>

          {loadingCategorySummary ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={colors.warning} />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : giderItems.length === 0 ? (
            <Text style={styles.emptyText}>Bu ay gider verisi yok</Text>
          ) : (
            <View style={styles.categoryDonutRow}>
              <View style={styles.categoryDonutWrap}>
                <Svg width={ringSize} height={ringSize}>
                  <G rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`}>
                    {giderItems.reduce(
                      (acc: { offset: number; nodes: React.ReactNode[] }, item, index) => {
                        const pct = categoryExpenseTotal ? item.toplamTutar / categoryExpenseTotal : 0;
                        const segLen = ringCircumference * pct;
                        if (segLen > 0) {
                          acc.nodes.push(
                            <Circle
                              key={`${item.kategoriId}-${index}`}
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
                        acc.offset += segLen;
                        return acc;
                      },
                      { offset: 0, nodes: [] }
                    ).nodes}
                  </G>
                </Svg>

                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterTitle}>Toplam Gider</Text>
                  <Text style={styles.donutCenterSub}>TL {formatTRY(categoryExpenseTotal)}</Text>
                </View>
              </View>

              <ScrollView
                style={styles.giderCategoryList}
                contentContainerStyle={styles.giderCategoryListContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {giderItems.map((item, index) => (
                  <View key={item.kategoriId} style={styles.categoryRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: expensePalette[index % expensePalette.length] },
                      ]}
                    >
                      <Text style={styles.categoryBadgeText}>
                        {item.kategoriAd?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {item.kategoriAd}
                      </Text>
                      <Text style={styles.categoryAmount}>TL {formatTRY(item.toplamTutar)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.memberSection}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Üye Harcama Kategorileri</Text>
              <Text style={styles.cardSubtitle}>Kişi bazlı gider dağılımı</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{memberCategoryGroups.length}</Text>
            </View>
          </View>

          {!memberCategoryHasExpense ? (
            <Text style={styles.emptyText}>Bu ay üye harcaması yok</Text>
          ) : (
            <FlatList
              data={memberCategoryGroups.filter((m) => (m.total || 0) > 0)}
              keyExtractor={(x) => String(x.kullaniciId)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.memberScrollContent}
              renderItem={renderMemberCategoryCard}
            />
          )}
        </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    bgCircleOne: {
      position: "absolute",
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: colors.accentSoft,
      top: -120,
      left: -80,
    },
    bgCircleTwo: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: colors.headerGlowA,
      top: 120,
      right: -90,
    },
    bgRing: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 1,
      borderColor: colors.divider,
      bottom: -40,
      left: 30,
    },
    content: { paddingBottom: 28 },

    heroCard: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: "transparent",
      borderRadius: 18,
      padding: 16,
    },
    heroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    heroTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
    heroSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
    heroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.warning,
    },
    heroChipText: { color: colors.chipText, fontSize: 11, fontWeight: "900" },

    donutRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    donutWrap: {
      width: 170,
      height: 170,
      alignItems: "center",
      justifyContent: "center",
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
    donutCenterTitle: { color: colors.text, fontWeight: "800", fontSize: 13 },
    donutCenterSub: { color: colors.textMuted, marginTop: 4, fontSize: 12, fontWeight: "700" },

    kpiCol: { flex: 1, gap: 10 },
    kpiCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    kpiLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
    kpiValue: { color: colors.success, fontSize: 15, fontWeight: "900", marginTop: 6 },
    kpiValueDanger: { color: colors.danger, fontSize: 15, fontWeight: "900", marginTop: 6 },

    card: {
      backgroundColor: "transparent",
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 18,
      padding: 16,
    },
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
    cardSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
    sectionBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    sectionBadgeText: { color: colors.text, fontSize: 12, fontWeight: "900" },

    categoryDonutRow: { marginTop: 12, flexDirection: "row", gap: 12 },
    categoryDonutWrap: {
      width: 170,
      height: 170,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    categoryList: { flex: 1, gap: 10, justifyContent: "center" },
    giderCategoryList: { flex: 1, maxHeight: 170 },
    giderCategoryListContent: { gap: 10, paddingVertical: 2 },
    categoryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    categoryBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryBadgeText: { color: colors.onAccent, fontSize: 12, fontWeight: "900" },
    categoryName: { color: colors.text, fontSize: 12, fontWeight: "800" },
    categoryAmount: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: "700" },

    memberSection: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberScrollContent: { paddingTop: 12, paddingBottom: 6 },
    memberCard: {
      width: 260,
      height: 360,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    memberCardTitle: { color: colors.text, fontSize: 13, fontWeight: "900", marginBottom: 10 },
    memberCardContent: { alignItems: "stretch" },
    memberDonutWrap: {
      width: 170,
      height: 170,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    memberCategoryList: { width: "100%", height: 120, marginTop: 6 },
    memberCategoryListContent: { paddingBottom: 6 },
    memberCategoryRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    memberCategoryDot: { width: 8, height: 8, borderRadius: 8 },
    memberCategoryName: { color: colors.text, fontSize: 12, fontWeight: "800" },
    memberCategoryAmount: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: "700" },

    loadingInline: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    emptyText: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 10 },
    permissionCard: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    permissionTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 6 },
    permissionSub: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    permissionError: { color: colors.danger, fontSize: 12, fontWeight: "800", marginBottom: 8 },
    permissionBtn: {
      marginTop: 12,
      backgroundColor: colors.warning,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    permissionBtnText: { color: colors.onAccent, fontSize: 14, fontWeight: "900" },
  });



