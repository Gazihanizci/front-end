import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import MessageBox from "../components/MessageBox";
import { ThemeColors, useTheme } from "../theme/theme";
import { decreaseYatirim } from "../services/yatirimService";

type Props = NativeStackScreenProps<RootStackParamList, "YatirimAzalt">;

const parseNumberTR = (s: string) => {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

export default function YatirimAzaltScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { yatirimId, hesapAdi, varlikTuru } = route.params;

  const [amountText, setAmountText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msgVisible, setMsgVisible] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");
  const [pendingNavBack, setPendingNavBack] = useState(false);

  const handleDecrease = useCallback(async () => {
    const amount = parseNumberTR(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsgType("error");
      setMsgText("Düşülecek miktar 0'dan büyük olmalı.");
      setMsgVisible(true);
      return;
    }

    setSaving(true);
    try {
      const data = await decreaseYatirim(yatirimId, amount);
      setMsgType("success");
      setMsgText(`Yeni bakiye: ${data.adet}`);
      setMsgVisible(true);
      setPendingNavBack(true);
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
      setSaving(false);
    }
  }, [amountText, yatirimId]);

  const handleMsgClose = () => {
    setMsgVisible(false);
    if (pendingNavBack) {
      setPendingNavBack(false);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Home");
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Yatırım Azalt"
        subtitle="Hesaptan miktar düş"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
      />

      <View style={styles.card}>
        <Text style={styles.title}>{hesapAdi}</Text>
        <Text style={styles.subtitle}>{varlikTuru} hesabı</Text>

        <Text style={styles.label}>Düşülecek Miktar</Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="Örn: 200"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          style={styles.input}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
          onPress={handleDecrease}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryBtnText}>Düş</Text>
          )}
        </TouchableOpacity>
      </View>

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
    card: {
      margin: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { color: colors.text, fontSize: 16, fontWeight: "900" },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
    label: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginTop: 12, marginBottom: 6 },
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryBtn: {
      marginTop: 12,
      backgroundColor: colors.warning,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.onAccent, fontWeight: "900" },
  });
