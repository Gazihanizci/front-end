import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { RootStackParamList } from "../../App";
import api from "../config/api";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Islemler">;

type IslemRaw = {
  islemId?: number;
  id?: number;
  tutar?: number | string;
  aciklama?: string | null;
  kategoriAd?: string;
  kategoriAdiSnapshot?: string; // âœ… backend'den gelen
  hesapAdi?: string;
  tip?: "GELIR" | "GIDER" | string;
  islemTarihi?: string;
  tarih?: string;
  createdAt?: string;
  paraBirimi?: string;
};

const formatTRY = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR");
};

const toNumber = (value: number | string | undefined | null) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value.replace(",", "."));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
};

export default function IslemlerScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<IslemRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "7D" | "30D">("ALL");

  // pagination
  const [page, setPage] = useState(0);
  const size = 20;
  const [hasMore, setHasMore] = useState(true);

  // âœ… StrictMode/dev double-effect kilidi
  const didInit = useRef(false);

  // âœ… onEndReached bazen gereksiz tetiklenir: momentum guard
  const onEndReachedCalledDuringMomentum = useRef(false);

  const normalize = useCallback((i: any): IslemRaw => {
    // backend IslemResponse alanları:
    // islemId, kategoriAdiSnapshot, tutar, paraBirimi, islemTarihi, aciklama, createdAt ...
    return {
      islemId: i.islemId ?? i.id,
      id: i.id ?? i.islemId,
      tutar: i.tutar,
      aciklama: i.aciklama,
      kategoriAdiSnapshot: i.kategoriAdiSnapshot,
      kategoriAd: i.kategoriAd, // varsa
      islemTarihi: i.islemTarihi ?? i.tarih,
      tarih: i.tarih,
      createdAt: i.createdAt,
      paraBirimi: i.paraBirimi ?? "TL",
      tip: i.tip, // backend'de yoksa undefined kalır
      hesapAdi: i.hesapAdi,
    };
  }, []);

  const fetchPage = useCallback(
    async (mode: "initial" | "refresh" | "more") => {
      try {
        if (mode === "initial") {
          setLoading(true);
          setError(null);
          setPage(0);
          setHasMore(true);
        }
        if (mode === "refresh") {
          setRefreshing(true);
          setError(null);
          setPage(0);
          setHasMore(true);
        }
        if (mode === "more") {
          if (loadingMore || loading || refreshing) return;
          if (!hasMore) return;
          setLoadingMore(true);
        }

        const nextPage = mode === "more" ? page + 1 : 0;

        // âœ… DİKKAT:
        // baseURL "...:8080/api" ise: "/islemler/my"
        // baseURL "...:8080" ise: "/api/islemler/my"
        const res = await api.get("/api/islemler/my", {
          params: { page: nextPage, size, sort: "islemTarihi,desc" },
        });

        const data = res.data;

        // âœ… Page -> content
        const contentRaw: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
          ? data.content
          : [];

        const content = contentRaw.map(normalize);

        // sayfa bilgileri
        const currentNumber =
          typeof data?.number === "number" ? data.number : nextPage;
        const totalPages =
          typeof data?.totalPages === "number" ? data.totalPages : currentNumber + 1;

        setHasMore(currentNumber + 1 < totalPages);
        setPage(currentNumber);

        if (mode === "more") {
          setItems((prev) => [...prev, ...content]);
        } else {
          setItems(content);
        }
      } catch (err: any) {
        console.log("İşlemler çekme hata:", err?.response?.data || err?.message);
        setError("İşlemler yüklenemedi");
        if (mode !== "more") setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [page, hasMore, loadingMore, loading, refreshing, normalize]
  );

  // âœ… sadece 1 kez initial fetch (loop bitti)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    fetchPage("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderItem = useCallback(({ item }: { item: IslemRaw }) => {
    const title =
      item.kategoriAdiSnapshot?.trim() ||
      item.kategoriAd?.trim() ||
      item.aciklama?.trim() ||
      "İşlem";

    const dateValue = item.islemTarihi || item.tarih || item.createdAt;
    const dateText = formatDate(dateValue);

    const tip = String(item.tip || "").toUpperCase();
    const tipLabel = tip === "GELIR" ? "Gelir" : tip === "GIDER" ? "Gider" : "";

    const subtitleParts = [item.hesapAdi, tipLabel].filter(Boolean);
    const subtitle =
      subtitleParts.join(" â€¢ ") || (item.aciklama?.trim() ? String(item.aciklama).trim() : "Detay");

    const amountNum = toNumber(item.tutar);
    const currency = item.paraBirimi || "TL";

    // tip yoksa nötr
    const amountColor =
      tip === "GIDER" ? colors.danger : tip === "GELIR" ? colors.warning : colors.text;
    const badgeBg =
      tip === "GIDER"
        ? colors.danger
        : tip === "GELIR"
        ? colors.warning
        : colors.accentSoft;
    const badgeText = title?.[0]?.toUpperCase() || "?";

    return (
      <View style={styles.card}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
            <View style={styles.dot} />
            <Text style={styles.dateText} numberOfLines={1}>
              {dateText}
            </Text>
          </View>
        </View>

        <View style={styles.amountPill}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {formatTRY(Math.abs(amountNum))} {currency}
          </Text>
        </View>
      </View>
    );
  }, []);

  const listEmpty = useMemo(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>İşlem bulunamadı</Text>
      </View>
    );
  }, [loading]);

  const filteredItems = useMemo(() => {
    if (dateFilter === "ALL") return items;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const withinRange = (dt?: Date) => {
      if (!dt || Number.isNaN(dt.getTime())) return false;
      if (dateFilter === "TODAY") return dt >= startOfToday;
      if (dateFilter === "7D") return dt >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (dateFilter === "30D") return dt >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return true;
    };

    return items.filter((item) => {
      const dateValue = item.islemTarihi || item.tarih || item.createdAt;
      const dt = dateValue ? new Date(dateValue) : undefined;
      return withinRange(dt);
    });
  }, [items, dateFilter]);

  return (
<View style={styles.container}>
  <ScreenHeader
    title="İşlemler"
    subtitle="Tüm işlemler"
    left={
      <HeaderAction
        label="Geri"
        icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
        onPress={() => navigation.goBack()}
      />
    }
  />

  {loading ? (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={colors.warning} />
      <Text style={styles.loadingText}>Yükleniyor...</Text>
    </View>
  ) : (
    <>
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryTitle}>Tüm işlemler</Text>
          <Text style={styles.summarySub}>{filteredItems.length} kayıt</Text>
        </View>

        <View style={styles.summaryChip}>
          <Ionicons name="time-outline" size={14} color={colors.text} />
          <Text style={styles.summaryChipText}>
            {dateFilter === "ALL"
              ? "Tümü"
              : dateFilter === "TODAY"
              ? "Bugün"
              : dateFilter === "7D"
              ? "7 gün"
              : "30 gün"}
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, dateFilter === "ALL" && styles.filterChipActive]}
          onPress={() => setDateFilter("ALL")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, dateFilter === "ALL" && styles.filterTextActive]}>
            Tümü
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, dateFilter === "TODAY" && styles.filterChipActive]}
          onPress={() => setDateFilter("TODAY")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, dateFilter === "TODAY" && styles.filterTextActive]}>
            Bugün
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, dateFilter === "7D" && styles.filterChipActive]}
          onPress={() => setDateFilter("7D")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, dateFilter === "7D" && styles.filterTextActive]}>
            7 gün
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, dateFilter === "30D" && styles.filterChipActive]}
          onPress={() => setDateFilter("30D")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, dateFilter === "30D" && styles.filterTextActive]}>
            30 gün
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item, index) => String(item.islemId ?? item.id ?? index)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPage("refresh")}
            tintColor={colors.warning}
          />
        }
        onEndReachedThreshold={0.2}
        onMomentumScrollBegin={() => {
          onEndReachedCalledDuringMomentum.current = false;
        }}
        onEndReached={() => {
          if (onEndReachedCalledDuringMomentum.current) return;
          onEndReachedCalledDuringMomentum.current = true;
          fetchPage("more");
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 14 }}>
              <ActivityIndicator color={colors.warning} />
            </View>
          ) : null
        }
      />
    </>
  )}
</View>

  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  screenTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  summarySub: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  summaryChipText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.accentSoft,
  },
  filterChipActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: colors.onAccent },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onAccent, fontSize: 14, fontWeight: "900" },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  subtitle: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  dot: { width: 4, height: 4, borderRadius: 4, backgroundColor: colors.textMuted },
  dateText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  amountPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  amount: { fontSize: 14, fontWeight: "900" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
});




