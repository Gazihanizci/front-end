import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { generatePDF } from "react-native-html-to-pdf";
import RNFS from "react-native-fs";

type Props = NativeStackScreenProps<RootStackParamList, "Raporlar">;

type IslemRaw = {
  islemId?: number;
  id?: number;
  tutar?: number | string;
  aciklama?: string | null;
  kategoriAd?: string;
  kategoriAdiSnapshot?: string;
  hesapAdi?: string;
  tip?: "GELIR" | "GIDER" | string;
  islemTarihi?: string;
  tarih?: string;
  createdAt?: string;
  paraBirimi?: string;
};

const toNumber = (value: number | string | undefined | null) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value.replace(",", "."));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
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

const getMonthKey = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleString("tr-TR", { month: "long", year: "numeric" });
};

const monthLabelShort = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  const month = d.toLocaleString("tr-TR", { month: "short" });
  return `${month} ${d.getFullYear()}`;
};

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default function RaporlarScreen({ navigation }: Props) {
  const [items, setItems] = useState<IslemRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/islemler/my");
      const data = res.data;
      const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
      setItems(list);
      if (list.length > 0 && !activeMonth) {
        const firstMonth = getMonthKey(list[0]?.islemTarihi || list[0]?.tarih || list[0]?.createdAt);
        if (firstMonth) setActiveMonth(firstMonth);
      }
    } catch (err: any) {
      console.log("Raporlar islemler hata:", err?.response?.data || err?.message);
      setError("Islemler yuklenemedi");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeMonth]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const months = useMemo(() => {
    const year = new Date().getFullYear();
    const list: string[] = [];
    for (let m = 0; m < 12; m += 1) {
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      list.push(key);
    }
    return list;
  }, []);

  const monthItemsMap = useMemo(() => {
    const map = new Map<string, IslemRaw[]>();
    months.forEach((m) => map.set(m, []));
    items.forEach((i) => {
      const dateValue = i.islemTarihi || i.tarih || i.createdAt;
      const key = getMonthKey(dateValue);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return map;
  }, [items, months]);

  useEffect(() => {
    if (!activeMonth && months.length > 0) setActiveMonth(months[0]);
  }, [activeMonth, months]);

  const buildPdfHtml = useCallback((monthKey: string, rowsData: IslemRaw[]) => {
    const title = monthLabel(monthKey);
    const rows = rowsData
      .map((i) => {
        const dateValue = i.islemTarihi || i.tarih || i.createdAt;
        const dateText = formatDate(dateValue);
        const name =
          i.kategoriAdiSnapshot?.trim() ||
          i.kategoriAd?.trim() ||
          i.aciklama?.trim() ||
          "Islem";
        const amount = toNumber(i.tutar);
        const currency = i.paraBirimi || "TL";
        return `<tr>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(dateText)}</td>
          <td style="text-align:right;">${formatTRY(Math.abs(amount))} ${escapeHtml(currency)}</td>
        </tr>`;
      })
      .join("");

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 20px; margin: 0 0 8px; }
            .summary { margin: 12px 0 18px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; }
            th { background: #f1f5f9; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)} Raporu</h1>
          <table>
            <thead>
              <tr>
                <th>Islem</th>
                <th>Tarih</th>
                <th style="text-align:right;">Tutar</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="3">Bu ay icin islem yok.</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }, []);

  const downloadPdfForMonth = useCallback(async (monthKey: string, rowsData: IslemRaw[]) => {
    try {
      setDownloading(true);
      const fileName = `rapor-${monthKey}`;
      const html = buildPdfHtml(monthKey, rowsData);
      const result = await generatePDF({
        html,
        fileName,
        base64: false,
      });
      if (result?.filePath) {
        const targetPath = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;
        const exists = await RNFS.exists(targetPath);
        if (exists) {
          await RNFS.unlink(targetPath);
        }
        await RNFS.moveFile(result.filePath, targetPath);
        Alert.alert("PDF hazir", `Dosya kaydedildi: ${targetPath}`);
      } else {
        Alert.alert("PDF olusturulamadı", "Dosya yolu alinmadi.");
      }
    } catch (e: any) {
      console.log("PDF hata:", e?.message);
      Alert.alert("PDF olusturulamadı", "Lutfen tekrar deneyin.");
    } finally {
      setDownloading(false);
    }
  }, [buildPdfHtml]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Raporlar"
        subtitle="Ozet ve analiz"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color="#e5e7eb" />}
            onPress={() => navigation.goBack()}
          />
        }
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#facc15" />
          <Text style={styles.loadingText}>Yukleniyor...</Text>
        </View>
      ) : (
        <>
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Takvim</Text>
            <FlatList
              data={months}
              keyExtractor={(item) => item}
              numColumns={3}
              contentContainerStyle={styles.monthGrid}
              columnWrapperStyle={styles.monthRow}
              renderItem={({ item }) => {
                const active = item === activeMonth;
                const rowsData = monthItemsMap.get(item) ?? [];
                const count = rowsData.length;
                return (
                  <View
                    style={[
                      styles.monthCell,
                      active && styles.monthCellActive,
                      count === 0 && styles.monthCellEmpty,
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (count === 0) return;
                        setActiveMonth(item);
                      }}
                      activeOpacity={0.85}
                      style={styles.monthCellPress}
                      disabled={count === 0}
                    >
                      <Text
                        style={[
                          styles.monthLabel,
                          active && styles.monthLabelActive,
                          count === 0 && styles.monthLabelEmpty,
                        ]}
                      >
                        {monthLabelShort(item)}
                      </Text>
                      {count > 0 ? (
                        <Text style={styles.monthCount}>{count} islem</Text>
                      ) : (
                        <Text style={styles.monthEmptyText}>Bos</Text>
                      )}
                    </TouchableOpacity>
                    {count > 0 ? (
                      <TouchableOpacity
                        style={styles.monthDownload}
                        onPress={() => downloadPdfForMonth(item, rowsData)}
                        activeOpacity={0.8}
                        disabled={downloading}
                      >
                        <Ionicons name="download-outline" size={14} color="#0b0f1a" />
                        <Text style={styles.monthDownloadText}>PDF</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f1a",
    paddingTop: 8,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  errorText: {
    color: "#fb7185",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  section: { marginTop: 8 },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  monthGrid: { paddingHorizontal: 12, paddingBottom: 12 },
  monthRow: { justifyContent: "space-between" },
  monthCell: {
    flex: 1,
    margin: 6,
    minHeight: 98,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(148,163,184,0.08)",
    padding: 12,
    justifyContent: "space-between",
  },
  monthCellActive: {
    borderColor: "#facc15",
    shadowColor: "#facc15",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  monthCellEmpty: {
    backgroundColor: "transparent",
    borderStyle: "dashed",
    borderColor: "rgba(148,163,184,0.18)",
  },
  monthCellPress: { flex: 1 },
  monthLabel: { color: "#e2e8f0", fontSize: 12, fontWeight: "800" },
  monthLabelActive: { color: "#facc15" },
  monthLabelEmpty: { color: "#64748b" },
  monthCount: { color: "#94a3b8", fontSize: 11, fontWeight: "700", marginTop: 6 },
  monthEmptyText: { color: "#64748b", fontSize: 10, fontWeight: "700", marginTop: 6 },
  monthDownload: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#facc15",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  monthDownloadText: { color: "#0b0f1a", fontSize: 11, fontWeight: "800" },
});
