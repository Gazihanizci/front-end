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
} from "react-native";
import api from "../config/api";
import { saveProfile, saveToken } from "../utils/authStorage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { ThemeColors, useTheme } from "../theme/theme";
import MessageBox from "../components/MessageBox";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

type MsgType = "success" | "error" | "info";
type AuthResponse = {
  mesaj: string;
  kullaniciId: number;
  email: string;
  accessToken: string;
  tokenType: "Bearer";
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

  // ✅ MessageBox state'leri
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
      navigation.navigate(nextRoute);
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

  const handleRegister = async () => {
    if (!ad || !soyad || !email || !parola) {
      showMsg("error", "Zorunlu alanları doldurun");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<AuthResponse>("/api/auth/register", {
        ad: ad.trim(),
        soyad: soyad.trim(),
        email: email.trim(),
        parola,
        telefon: telefon.trim() || null,
      });

      const token = res?.data?.accessToken;
      if (token) {
        await saveToken(token);
        if (res?.data?.kullaniciId && res?.data?.email) {
          await saveProfile({
            kullaniciId: res.data.kullaniciId,
            email: res.data.email,
          });
        }
      }

      setNextRoute("Home");
      showMsg("success", "Kayıt tamamlandı");
    } catch (err: any) {
      showMsg("error", err?.response?.data?.message || "Kayıt başarısız");
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
            <Text style={styles.heroBadgeText}>Yeni Hesap</Text>
          </View>
          <Text style={styles.title}>Kayıt Ol</Text>
          <Text style={styles.subtitle}>Kısa sürede hesabını oluştur</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Ad"
            placeholderTextColor={colors.textMuted}
            onChangeText={setAd}
          />
          <TextInput
            style={styles.input}
            placeholder="Soyad"
            placeholderTextColor={colors.textMuted}
            onChangeText={setSoyad}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            onChangeText={setParola}
          />
          <TextInput
            style={styles.input}
            placeholder="Telefon (opsiyonel)"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            onChangeText={setTelefon}
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.buttonText}>Kayıt Ol</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text style={styles.linkText}>Zaten hesabın var mı? Giriş Yap</Text>
        </TouchableOpacity>

        {/* ✅ MessageBox */}
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
      fontSize: 28,
      color: colors.text,
      textAlign: "center",
      marginBottom: 6,
      fontWeight: "900",
      letterSpacing: 0.6,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
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
    input: {
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      padding: 14,
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    button: {
      backgroundColor: colors.warning,
      padding: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 10,
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
