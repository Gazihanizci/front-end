import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import api from "../config/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { saveProfile, saveToken } from "../utils/authStorage";
import MessageBox from "../components/MessageBox";
import { ThemeColors, useTheme } from "../theme/theme";
type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type MsgType = "success" | "error" | "info";
type AuthResponse = {
  mesaj: string;
  kullaniciId: number;
  email: string;
  accessToken: string;
  tokenType: "Bearer";
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  //UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [loading, setLoading] = useState(false);

  const [msgVisible, setMsgVisible] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState<MsgType>("info");
  const [nextRoute, setNextRoute] = useState<"Home" | null>(null);

  // âœ… kart büyüme anim
  const cardAnim = useRef(new Animated.Value(0)).current; // 0 kapalı, 1 açık
  const [collapsedH, setCollapsedH] = useState<number | null>(null);
  const [expandedH, setExpandedH] = useState<number | null>(null);

  // âœ… şifre alanı anim
  const passAnim = useRef(new Animated.Value(0)).current;

  const showMsg = (type: MsgType, text: string) => {
    setMsgType(type);
    setMsgText(text);
    setMsgVisible(true);
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

  const emailValid = useMemo(() => {
    const e = email.trim();
    return e.length >= 5 && e.includes("@") && e.includes(".");
  }, [email]);

  // âœ… TEK useEffect: hem şifre hem kart büyüsün
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    Animated.parallel([
      Animated.timing(passAnim, {
        toValue: emailValid ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: emailValid ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // height animasyonu
      }),
    ]).start();
  }, [emailValid, passAnim, cardAnim]);

  const handleMsgClose = () => {
    setMsgVisible(false);
    if (nextRoute) {
      setNextRoute(null);
      navigation.replace(nextRoute);
    }
  };

  // âœ… 4. ADIM: card height hesapla
  const canAnimateCard = collapsedH !== null && expandedH !== null;

  const cardHeight = canAnimateCard
    ? cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [collapsedH!, expandedH!],
      })
    : undefined;

  const passStyle = {
    opacity: passAnim,
    transform: [
      {
        translateY: passAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  const handleLogin = async () => {
    if (loading) return;
    if (!emailValid || !parola.trim()) {
      showMsg("error", "Email ve şifre zorunlu");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<AuthResponse>("/api/auth/login", {
        email: email.trim(),
        parola: parola.trim(),
      });

      const token = res?.data?.accessToken;
      if (!token) {
        showMsg("error", "Token alinmadi");
        return;
      }
      await saveToken(token);
      if (res?.data?.kullaniciId && res?.data?.email) {
        await saveProfile({ kullaniciId: res.data.kullaniciId, email: res.data.email });
      }
      setNextRoute("Home");
      showMsg("success", "Giriş başarılı");
    } catch (err: any) {
      showMsg("error", err?.response?.data?.message || "Email veya şifre hatalı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgCircleOne} />
      <View style={styles.bgCircleTwo} />
      <View style={styles.bgRing} />
      {/* ÜST LOGO/HEAD */}
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>Güvenli Giriş</Text>
        </View>
        <Text style={styles.brand}>CÜZDAN</Text>
        <Text style={styles.subtitle}>Devam etmek için giriş yap</Text>
      </View>

      {/* âœ… 4. ADIM: FORM KART Animated.View + height */}
      <Animated.View
        style={[
          styles.card,
          canAnimateCard && { height: cardHeight, overflow: "hidden" },
        ]}
      >
        {/* âœ… 5. ADIM: Ölçüm (KAPALI) */}
        <View
          style={styles.measure}
          onLayout={(e) => {
            if (collapsedH === null) setCollapsedH(e.nativeEvent.layout.height);
          }}
        >
          <Text style={styles.title}>Giriş Yap</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email adresini gir"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          {/* ölçüm için küçük boşluk */}
          <View style={{ height: 16 }} />
        </View>

        {/* âœ… 5. ADIM: Ölçüm (AÇIK) */}
        <View
          style={styles.measure}
          onLayout={(e) => {
            if (expandedH === null) setExpandedH(e.nativeEvent.layout.height);
          }}
        >
          <Text style={styles.title}>Giriş Yap</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email adresini gir"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <View style={{ marginTop: 6 }}>
            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              placeholder="Parolanı gir"
              placeholderTextColor={colors.textMuted}
              value={parola}
              onChangeText={setParola}
              secureTextEntry
            />

            <View style={[styles.button, { opacity: 0.95 }]}>
              <Text style={styles.buttonText}>Giriş Yap</Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={styles.linkText}>Hesabın yok mu? Kayıt Ol</Text>
          </View>
        </View>

        {/* âœ… GÖRÜNEN GERÇEK UI */}
        <Text style={styles.title}>Giriş Yap</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email adresini gir"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />

        <Animated.View
          style={[styles.animatedBlock, passStyle]}
          pointerEvents={emailValid ? "auto" : "none"}
        >
          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="Parolanı gir"
            placeholderTextColor={colors.textMuted}
            value={parola}
            onChangeText={setParola}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[
              styles.button,
              (!emailValid || !parola || loading) && { opacity: 0.6 },
            ]}
            onPress={handleLogin}
            disabled={!emailValid || !parola || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.buttonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

      </Animated.View>

      <TouchableOpacity
        onPress={() => navigation.navigate("Register")}
        style={{ marginTop: 14 }}
      >
        <Text style={styles.linkText}>Hesabın yok mu? Kayıt Ol</Text>
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
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
    justifyContent: "center",
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
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.borderStrong,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  // âœ… ölçüm viewâ€™ları görünmesin
  measure: {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: -1,
    pointerEvents: "none",
  },

  title: {
    fontSize: 18,
    color: colors.text,
    fontWeight: "900",
    marginBottom: 12,
  },

  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },

  animatedBlock: {
    marginTop: 6,
  },

  button: {
    backgroundColor: colors.warning,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    fontWeight: "900",
    color: colors.onAccent,
  },

  linkText: {
    color: colors.accent,
    textAlign: "center",
    fontWeight: "800",
  },
});



