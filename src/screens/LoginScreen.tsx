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
import { saveUserId } from "../utils/authStorage";
import MessageBox from "../components/MessageBox";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type MsgType = "success" | "error" | "info";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  //UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [loading, setLoading] = useState(false);

  const [msgVisible, setMsgVisible] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState<MsgType>("info");
  const [nextRoute, setNextRoute] = useState<"Home" | null>(null);

  // ✅ kart büyüme anim
  const cardAnim = useRef(new Animated.Value(0)).current; // 0 kapalı, 1 açık
  const [collapsedH, setCollapsedH] = useState<number | null>(null);
  const [expandedH, setExpandedH] = useState<number | null>(null);

  // ✅ şifre alanı anim
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

  // ✅ TEK useEffect: hem şifre hem kart büyüsün
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

  // ✅ 4. ADIM: card height hesapla
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
      const res = await api.post("/api/auth/login", {
        email: email.trim(),
        parola: parola.trim(),
      });

      const userId = res?.data?.kullaniciId;
      if (userId == null) {
        showMsg("error", "Kullanıcı bilgisi alınamadı");
        return;
      }
      await saveUserId(userId);

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
      {/* ÜST LOGO/HEAD */}
      <View style={styles.hero}>
        <Text style={styles.brand}>CÜZDAN</Text>
        <Text style={styles.subtitle}>Devam etmek için giriş yap</Text>
      </View>

      {/* ✅ 4. ADIM: FORM KART Animated.View + height */}
      <Animated.View
        style={[
          styles.card,
          canAnimateCard && { height: cardHeight, overflow: "hidden" },
        ]}
      >
        {/* ✅ 5. ADIM: Ölçüm (KAPALI) */}
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
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          {/* ölçüm için küçük boşluk */}
          <View style={{ height: 16 }} />
        </View>

        {/* ✅ 5. ADIM: Ölçüm (AÇIK) */}
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
            placeholderTextColor="#64748b"
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
              placeholder="••••••••"
              placeholderTextColor="#64748b"
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

        {/* ✅ GÖRÜNEN GERÇEK UI */}
        <Text style={styles.title}>Giriş Yap</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email adresini gir"
          placeholderTextColor="#64748b"
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
            placeholder="••••••••"
            placeholderTextColor="#64748b"
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
              <ActivityIndicator color="#0b0f1a" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#0b0f1a",
    justifyContent: "center",
  },

  hero: {
    alignItems: "center",
    marginBottom: 16,
  },
  brand: {
    color: "#e5e7eb",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },

  // ✅ ölçüm view’ları görünmesin
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
    color: "#e5e7eb",
    fontWeight: "900",
    marginBottom: 12,
  },

  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: "#111827",
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    marginBottom: 12,
  },

  animatedBlock: {
    marginTop: 6,
  },

  button: {
    backgroundColor: "#facc15",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    fontWeight: "900",
    color: "#0b0f1a",
  },

  linkText: {
    color: "#93c5fd",
    textAlign: "center",
    fontWeight: "800",
  },
});
