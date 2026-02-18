import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import api from "../config/api";
import { saveProfile, setTokens } from "../utils/authStorage";
import MessageBox from "../components/MessageBox";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyCode">;

type MsgType = "success" | "error" | "info";
type VerifyResponse = {
  mesaj: string;
  kullaniciId: number;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
};

export default function VerifyCodeScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const email = route.params.email;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgVisible, setMsgVisible] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState<MsgType>("info");
  const [nextRoute, setNextRoute] = useState<"Home" | null>(null);

  const showMsg = (type: MsgType, text: string) => {
    setMsgType(type);
    setMsgText(text);
    setMsgVisible(true);
  };

  const handleMsgClose = () => {
    setMsgVisible(false);
    if (nextRoute) {
      setNextRoute(null);
      navigation.replace(nextRoute);
    }
  };

  const getTitleByType = (type: MsgType) => {
    switch (type) {
      case "success":
        return "Başarılı";
      case "error":
        return "Hata";
      default:
        return "Bilgi";
    }
  };

  const handleVerify = async () => {
    if (loading) return;
    if (code.length !== 6) {
      showMsg("error", "6 haneli doğrulama kodunu girin");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<VerifyResponse>("/api/auth/verify-email", {
        email: email.trim(),
        code: code.trim(),
      });

      const token = res?.data?.accessToken;
      const refreshToken = res?.data?.refreshToken;
      if (!token) {
        showMsg("error", "Token alınmadı");
        return;
      }
      await setTokens({ accessToken: token, refreshToken: refreshToken || null });
      if (res?.data?.kullaniciId && res?.data?.email) {
        await saveProfile({ kullaniciId: res.data.kullaniciId, email: res.data.email });
      }
      setNextRoute("Home");
      showMsg("success", "Email doğrulandı");
    } catch (err: any) {
      showMsg("error", err?.response?.data?.message || "Doğrulama başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <View style={styles.bgCircleOne} />
        <View style={styles.bgCircleTwo} />
        <View style={styles.bgRing} />

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Doğrulama</Text>
          </View>
          <Text style={styles.title}>Email Doğrulama</Text>
          <Text style={styles.subtitle}>Kodu {email} adresine gönderdik</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            style={styles.otpInput}
            placeholder="6 haneli kod"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            textAlign="center"
            autoFocus
          />

          <TouchableOpacity
            style={[styles.button, (code.length !== 6 || loading) && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={code.length !== 6 || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.buttonText}>Doğrula</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.replace("Login")}>
          <Text style={styles.linkText}>Giriş ekranına dön</Text>
        </TouchableOpacity>

        <MessageBox
          visible={msgVisible}
          title={getTitleByType(msgType)}
          type={msgType}
          message={msgText}
          confirmText="Tamam"
          onClose={handleMsgClose}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
      backgroundColor: colors.background,
    },
    bgCircleOne: {
      position: "absolute",
      width: 360,
      height: 360,
      borderRadius: 180,
      backgroundColor: colors.accentSoft,
      top: -140,
      left: -90,
    },
    bgCircleTwo: {
      position: "absolute",
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: colors.headerGlowA,
      bottom: -120,
      right: -80,
    },
    bgRing: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 1,
      borderColor: colors.divider,
      top: 120,
      right: -60,
    },
    hero: {
      alignItems: "center",
      marginBottom: 16,
    },
    heroBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    heroBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
    title: {
      fontSize: 26,
      color: colors.text,
      textAlign: "center",
      marginBottom: 6,
      fontWeight: "900",
      letterSpacing: 0.6,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.borderStrong,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
      marginBottom: 14,
    },
    otpInput: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      padding: 14,
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 20,
      letterSpacing: 6,
    },
    button: {
      backgroundColor: colors.warning,
      padding: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 6,
    },
    buttonText: {
      fontWeight: "700",
      color: colors.onAccent,
    },
    linkText: {
      color: colors.accent,
      textAlign: "center",
      marginTop: 16,
      fontWeight: "600",
    },
  });
