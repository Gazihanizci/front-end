import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import MessageBox from "../components/MessageBox";
import { ThemeColors, useTheme } from "../theme/theme";

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
};

const toNumber = (value: number | string | undefined | null) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value.replace(",", "."));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
};

const toNum = (value: number | string | undefined | null) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
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
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const [items, setItems] = useState<IslemRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfMessageOpen, setPdfMessageOpen] = useState(false);
  const [pdfMessageText, setPdfMessageText] = useState("");
  const [pdfMessageType, setPdfMessageType] = useState<"success" | "error" | "info">("success");
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadMonth, setDownloadMonth] = useState<string | null>(null);
  const [familyMonthData, setFamilyMonthData] = useState<FamilyWalletResponse | null>(null);
  const [familyLoading, setFamilyLoading] = useState(false);

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
        setPdfMessageType("success");
        setPdfMessageText(`PDF kaydedildi: ${targetPath}`);
        setPdfMessageOpen(true);
      } else {
        setPdfMessageType("error");
        setPdfMessageText("PDF olusturulamadı. Dosya yolu alinmadi.");
        setPdfMessageOpen(true);
      }
    } catch (e: any) {
      console.log("PDF hata:", e?.message);
      setPdfMessageType("error");
      setPdfMessageText("PDF olusturulamadı. Lutfen tekrar deneyin.");
      setPdfMessageOpen(true);
    } finally {
      setDownloading(false);
    }
  }, [buildPdfHtml]);

  const buildFamilyPdfHtml = useCallback((monthKey: string, data: FamilyWalletResponse) => {
    const title = monthLabel(monthKey);
    const gelir = toNum(data.aileToplamGelir);
    const gider = toNum(data.aileToplamGider);
    const net = toNum(data.aileNet);

    const memberRows = (data.uyelerAylik || [])
      .map((m) => {
        return `<tr>
          <td>${escapeHtml(m.adSoyad ?? "-")}</td>
          <td style="text-align:right;">${formatTRY(Math.abs(toNum(m.aylikGelir)))}</td>
          <td style="text-align:right;">${formatTRY(Math.abs(toNum(m.aylikGider)))}</td>
          <td style="text-align:right;">${formatTRY(toNum(m.net))}</td>
        </tr>`;
      })
      .join("");

    const kategoriRows = (data.kategoriOzet || [])
      .map((k) => {
        return `<tr>
          <td>${escapeHtml(k.kategoriAd ?? "-")}</td>
          <td>${escapeHtml(k.tip ?? "-")}</td>
          <td style="text-align:right;">${formatTRY(Math.abs(toNum(k.toplamTutar)))}</td>
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
            h2 { font-size: 14px; margin: 16px 0 8px; }
            .summary { margin: 12px 0 18px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; }
            th { background: #f1f5f9; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)} Aile Raporu</h1>
          <div class="summary">
            <div>Toplam Gelir: ${formatTRY(gelir)}</div>
            <div>Toplam Gider: ${formatTRY(gider)}</div>
            <div>Net: ${formatTRY(net)}</div>
          </div>

          <h2>Üyeler (Gelir / Gider / Net)</h2>
          <table>
            <thead>
              <tr>
                <th>Üye</th>
                <th style="text-align:right;">Gelir</th>
                <th style="text-align:right;">Gider</th>
                <th style="text-align:right;">Net</th>
              </tr>
            </thead>
            <tbody>
              ${memberRows || `<tr><td colspan="4">Bu ay için üye verisi yok.</td></tr>`}
            </tbody>
          </table>

          <h2>Kategori Özeti</h2>
          <table>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Tip</th>
                <th style="text-align:right;">Tutar</th>
              </tr>
            </thead>
            <tbody>
              ${kategoriRows || `<tr><td colspan="3">Bu ay için kategori verisi yok.</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }, []);

  const buildMemberPdfHtml = useCallback(
    (monthKey: string, member: FamilyWalletResponse["uyelerAylik"][number]) => {
      const title = monthLabel(monthKey);
      const gelir = toNum(member.aylikGelir);
      const gider = toNum(member.aylikGider);
      const net = toNum(member.net);
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
            <h1>${escapeHtml(title)} Üye Raporu</h1>
            <div class="summary">
              <div>Üye: ${escapeHtml(member.adSoyad ?? "-")}</div>
              <div>Gelir: ${formatTRY(gelir)}</div>
              <div>Gider: ${formatTRY(gider)}</div>
              <div>Net: ${formatTRY(net)}</div>
            </div>
          </body>
        </html>
      `;
    },
    []
  );

  const downloadFamilyPdfForMonth = useCallback(
    async (monthKey: string) => {
      try {
        setDownloading(true);
        const res = await api.get<FamilyWalletResponse>("/api/familywallet/monthly", {
          params: { yilAy: monthKey },
        });
        const data = res.data;
        const fileName = `aile-rapor-${monthKey}`;
        const html = buildFamilyPdfHtml(monthKey, data);
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
          setPdfMessageType("success");
          setPdfMessageText(`Aile PDF kaydedildi: ${targetPath}`);
          setPdfMessageOpen(true);
        } else {
          setPdfMessageType("error");
          setPdfMessageText("Aile PDF olusturulamadı. Dosya yolu alinmadi.");
          setPdfMessageOpen(true);
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.response?.data?.detail ||
          e?.response?.data ||
          e?.message ||
          "Aile PDF olusturulamadı. Lutfen tekrar deneyin.";
        console.log("Aile PDF hata:", msg);
        setPdfMessageType("error");
        setPdfMessageText(String(msg));
        setPdfMessageOpen(true);
      } finally {
        setDownloading(false);
      }
    },
    [buildFamilyPdfHtml]
  );

  const downloadMemberPdfForMonth = useCallback(
    async (monthKey: string, member: FamilyWalletResponse["uyelerAylik"][number]) => {
      try {
        setDownloading(true);
        const safeName = String(member.adSoyad || "uye")
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase();
        const fileName = `uye-rapor-${monthKey}-${safeName}`;
        const html = buildMemberPdfHtml(monthKey, member);
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
          setPdfMessageType("success");
          setPdfMessageText(`Üye PDF kaydedildi: ${targetPath}`);
          setPdfMessageOpen(true);
        } else {
          setPdfMessageType("error");
          setPdfMessageText("Üye PDF olusturulamadı. Dosya yolu alinmadi.");
          setPdfMessageOpen(true);
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.response?.data?.detail ||
          e?.response?.data ||
          e?.message ||
          "Üye PDF olusturulamadı. Lutfen tekrar deneyin.";
        console.log("Üye PDF hata:", msg);
        setPdfMessageType("error");
        setPdfMessageText(String(msg));
        setPdfMessageOpen(true);
      } finally {
        setDownloading(false);
      }
    },
    [buildMemberPdfHtml]
  );

  const openDownloadModal = useCallback(
    async (monthKey: string) => {
      setDownloadMonth(monthKey);
      setDownloadModalVisible(true);
      setFamilyLoading(true);
      try {
        const res = await api.get<FamilyWalletResponse>("/api/familywallet/monthly", {
          params: { yilAy: monthKey },
        });
        setFamilyMonthData(res.data);
      } catch (e: any) {
        setFamilyMonthData(null);
      } finally {
        setFamilyLoading(false);
      }
    },
    []
  );

  return (
    <>
      <View style={styles.container}>
        <ScreenHeader
          title="Raporlar"
          subtitle="Ozet ve analiz"
          left={
            <HeaderAction
              label="Geri"
              icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
            />
          }
        />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.warning} />
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
                          openDownloadModal(item);
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
                    </View>
                  );
                }}
              />
            </View>
          </>
        )}
      </View>
      <MessageBox
        visible={pdfMessageOpen}
        title={pdfMessageType === "success" ? "PDF Hazir" : "Hata"}
        message={pdfMessageText}
        type={pdfMessageType === "success" ? "success" : "error"}
        onClose={() => setPdfMessageOpen(false)}
        confirmText="Tamam"
      />
      {downloadModalVisible && downloadMonth ? (
        <View style={styles.downloadSheet}>
          <View style={styles.downloadSheetCard}>
            <Text style={styles.downloadTitle}>PDF Seçimi</Text>
            <Text style={styles.downloadSub}>
              {monthLabel(downloadMonth)} için indirme seçeneğini seç.
            </Text>

            <TouchableOpacity
              style={[styles.downloadBtn, downloading && { opacity: 0.6 }]}
              onPress={() => downloadPdfForMonth(downloadMonth, monthItemsMap.get(downloadMonth) ?? [])}
              disabled={downloading}
            >
              <Ionicons name="download-outline" size={16} color={colors.onAccent} />
              <Text style={styles.downloadBtnText}>Bireysel PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadBtnAlt, downloading && { opacity: 0.6 }]}
              onPress={() => downloadFamilyPdfForMonth(downloadMonth)}
              disabled={downloading}
            >
              <Ionicons name="people-outline" size={16} color={colors.onAccent} />
              <Text style={styles.downloadBtnText}>Genel Aile PDF</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.downloadSectionTitle}>Aile Üyeleri</Text>
              {familyLoading ? (
                <Text style={styles.downloadSub}>Yükleniyor...</Text>
              ) : familyMonthData?.uyelerAylik?.length ? (
                familyMonthData.uyelerAylik.map((m) => (
                  <TouchableOpacity
                    key={m.kullaniciId}
                    style={[styles.memberDownloadRow, downloading && { opacity: 0.6 }]}
                    onPress={() => downloadMemberPdfForMonth(downloadMonth, m)}
                    disabled={downloading}
                  >
                    <Text style={styles.memberDownloadName}>{m.adSoyad}</Text>
                    <Ionicons name="download-outline" size={14} color={colors.onAccent} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.downloadSub}>Bu ay için aile verisi yok.</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.downloadClose}
              onPress={() => setDownloadModalVisible(false)}
            >
              <Text style={styles.downloadCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </>
  );
}

const createStyles = (colors: ThemeColors, mode: "dark" | "light") => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 8,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  section: { marginTop: 8 },
  sectionTitle: {
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    justifyContent: "space-between",
  },
  monthCellActive: {
    borderColor: colors.warning,
    shadowColor: colors.warning,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  monthCellEmpty: {
    backgroundColor: "transparent",
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  monthCellPress: { flex: 1 },
  monthLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  monthLabelActive: { color: colors.warning },
  monthLabelEmpty: { color: colors.textMuted },
  monthCount: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 6 },
  monthEmptyText: { color: colors.textMuted, fontSize: 10, fontWeight: "700", marginTop: 6 },
  monthDownload: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  monthDownloadAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  monthDownloadText: { color: colors.onAccent, fontSize: 11, fontWeight: "800" },
  downloadSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: mode === "light" ? "rgba(15,23,42,0.35)" : "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  downloadSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  downloadTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  downloadSub: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: "700" },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.warning,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  downloadBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  downloadBtnText: { color: colors.onAccent, fontSize: 13, fontWeight: "900" },
  downloadSectionTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  memberDownloadRow: {
    marginTop: 8,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberDownloadName: { color: colors.text, fontSize: 12, fontWeight: "800" },
  downloadClose: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  downloadCloseText: { color: colors.textMuted, fontWeight: "800" },
});



