import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import api from "../config/api";
import { RootStackParamList } from "../../App";
import { ThemeColors, useTheme } from "../theme/theme";
import MessageBox from "../components/MessageBox";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

type MsgType = "success" | "error" | "info";

type RegisterResponse = {
  mesaj: string;
  message?: string;
  error?: string;
  kullaniciId: number;
  email: string;
  accessToken: null;
  refreshToken: null;
};

export default function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [telefon, setTelefon] = useState("");

  const [loading, setLoading] = useState(false);

  const [msgVisible, setMsgVisible] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState<MsgType>("info");

  const passwordChecks = useMemo(() => {
    const hasUpper = /[A-ZÇĞİÖŞÜ]/.test(parola);
    const hasNumber = /\d/.test(parola);
    const hasPunct = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(parola);
    const hasMinLen = parola.length >= 6;
    return {
      hasUpper,
      hasNumber,
      hasPunct,
      hasMinLen,
      allOk: hasUpper && hasNumber && hasPunct && hasMinLen,
    };
  }, [parola]);

  const showMsg = (type: MsgType, text: string) => {
    setMsgType(type);
    setMsgText(text);
    setMsgVisible(true);
  };

  const handleMsgClose = () => {
    setMsgVisible(false);
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

  const validate = () => {
    const e = email.trim();
    if (!ad.trim() || !soyad.trim() || !e || !parola) {
      showMsg("error", "Lütfen zorunlu alanları doldurun.");
      return false;
    }
    if (!e.includes("@") || !e.includes(".")) {
      showMsg("error", "Geçerli bir email girin.");
      return false;
    }
    if (!passwordChecks.allOk) {
      showMsg(
        "error",
        "Şifre en az 6 karakter olmalı; büyük harf, sayı ve noktalama içermeli."
      );
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        ad: ad.trim(),
        soyad: soyad.trim(),
        email: email.trim().toLowerCase(),
        parola,
        telefon: telefon.trim() ? telefon.trim() : null,
      };

      const res = await api.post<RegisterResponse>("/api/auth/register", payload, {
        timeout: 30000,
      });

      const serverMsg =
        res?.data?.mesaj ||
        res?.data?.message ||
        "Kayıt başarılı. Emailinize doğrulama kodu gönderildi.";
      showMsg("success", String(serverMsg));
    } catch (err: any) {
      const data = err?.response?.data;
      const status = err?.response?.status;

      const isTimeout =
        err?.code === "ECONNABORTED" ||
        String(err?.message || "").toLowerCase().includes("timeout");

      const isNetwork = err?.message === "Network Error" || !err?.response;

      if (isTimeout) {
        showMsg("error", "İstek zaman aşımına uğradı. Tekrar deneyin.");
        return;
      }
      if (isNetwork) {
        showMsg("error", "Sunucuya bağlanılamadı. Backend adresini kontrol edin.");
        return;
      }

      const serverMsg =
        data?.message ||
        data?.mesaj ||
        data?.error ||
        err?.message ||
        "Kayıt başarısız";

      // Backend sometimes returns success message with non-2xx status.
      if (data?.mesaj) {
        showMsg("success", String(data.mesaj));
        return;
      }

      const normalized = String(serverMsg).toLowerCase();
      const looksLikeSuccess =
        !!data?.kullaniciId ||
        !!data?.email ||
        normalized.includes("kayıt başarılı") ||
        normalized.includes("kayit basarili") ||
        normalized.includes("doğrulama") ||
        normalized.includes("dogrulama");

      if (status && status >= 500 && looksLikeSuccess) {
        showMsg("success", String(serverMsg));
      } else {
        showMsg("error", String(serverMsg));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Login"))}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={styles.backText}>Giriş</Text>
        </TouchableOpacity>
        <View style={styles.bgCircleOne} />
        <View style={styles.bgCircleTwo} />
        <View style={styles.bgRing} />

        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Yeni Hesap</Text>
              </View>
              <Text style={styles.title}>Kayıt Ol</Text>
              <Text style={styles.subtitle}>Hızlıca hesabını oluştur</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
              <TextInput
                style={styles.input}
                placeholder="Ad"
                placeholderTextColor={colors.textMuted}
                value={ad}
                onChangeText={setAd}
              />
              <TextInput
                style={styles.input}
                placeholder="Soyad"
                placeholderTextColor={colors.textMuted}
                value={soyad}
                onChangeText={setSoyad}
              />
              <Text style={styles.sectionTitle}>İletişim</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Şifre"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={parola}
                onChangeText={setParola}
              />
              <View style={styles.passwordRules}>
                <Text style={styles.rulesTitle}>Şifre Kriterleri</Text>
                <View style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleDot,
                      passwordChecks.hasUpper && styles.ruleDotOk,
                    ]}
                  />
                  <Text
                    style={[
                      styles.ruleText,
                      passwordChecks.hasUpper && styles.ruleTextOk,
                    ]}
                  >
                    Büyük harf içerir
                  </Text>
                </View>
                <View style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleDot,
                      passwordChecks.hasNumber && styles.ruleDotOk,
                    ]}
                  />
                  <Text
                    style={[
                      styles.ruleText,
                      passwordChecks.hasNumber && styles.ruleTextOk,
                    ]}
                  >
                    Sayı içerir
                  </Text>
                </View>
                <View style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleDot,
                      passwordChecks.hasPunct && styles.ruleDotOk,
                    ]}
                  />
                  <Text
                    style={[
                      styles.ruleText,
                      passwordChecks.hasPunct && styles.ruleTextOk,
                    ]}
                  >
                    Noktalama içerir
                  </Text>
                </View>
                <View style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleDot,
                      passwordChecks.hasMinLen && styles.ruleDotOk,
                    ]}
                  />
                  <Text
                    style={[
                      styles.ruleText,
                      passwordChecks.hasMinLen && styles.ruleTextOk,
                    ]}
                  >
                    En az 6 karakter
                  </Text>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Telefon (opsiyonel)"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={telefon}
                onChangeText={setTelefon}
              />

              <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={styles.buttonText}>Hesap Oluştur</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

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
      backgroundColor: colors.background,
    },
    keyboardWrap: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
      paddingBottom: 36,
    },
    backBtn: {
      position: "absolute",
      top: 16,
      left: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 10,
    },
    backText: { color: colors.text, fontSize: 12, fontWeight: "800" },
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
      fontSize: 28,
      fontWeight: "900",
      color: colors.text,
      textAlign: "center",
      marginBottom: 6,
      letterSpacing: 0.5,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 6,
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
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      marginBottom: 8,
      marginTop: 6,
      letterSpacing: 0.6,
    },
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      padding: 14,
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordRules: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rulesTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    ruleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    ruleDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.borderStrong,
    },
    ruleDotOk: {
      backgroundColor: colors.success,
      shadowColor: colors.success,
      shadowOpacity: 0.7,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      elevation: 3,
    },
    ruleText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    ruleTextOk: {
      color: colors.success,
    },
    button: {
      backgroundColor: colors.warning,
      padding: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 6,
    },
    buttonText: {
      fontWeight: "800",
      color: colors.onAccent,
    },
  });
