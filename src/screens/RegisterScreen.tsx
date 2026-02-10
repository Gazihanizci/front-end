import React, { useState } from "react";
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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";

// 👇 MessageBox import
import MessageBox from "../components/MessageBox";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

type MsgType = "success" | "error" | "info";

export default function RegisterScreen({ navigation }: Props) {
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
  const [nextRoute, setNextRoute] = useState<"Login" | null>(null);

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
      await api.post("/api/auth/register", {
        ad: ad.trim(),
        soyad: soyad.trim(),
        email: email.trim(),
        parola,
        telefon: telefon.trim() || null,
      });

      setNextRoute("Login");
      showMsg("success", "Kayıt tamamlandı");
    } catch (err: any) {
      showMsg(
        "error",
        err?.response?.data?.message || "Kayıt başarısız"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Kayıt Ol</Text>

        <TextInput
          style={styles.input}
          placeholder="Ad"
          placeholderTextColor="#9ca3af"
          onChangeText={setAd}
        />
        <TextInput
          style={styles.input}
          placeholder="Soyad"
          placeholderTextColor="#9ca3af"
          onChangeText={setSoyad}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          onChangeText={setParola}
        />
        <TextInput
          style={styles.input}
          placeholder="Telefon (opsiyonel)"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          onChangeText={setTelefon}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Kayıt Ol</Text>
          )}
        </TouchableOpacity>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0b0f1a",
  },
  title: {
    fontSize: 28,
    color: "#fff",
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#facc15",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    fontWeight: "700",
    color: "#000",
  },
  linkText: {
    color: "#93c5fd",
    textAlign: "center",
    marginTop: 16,
    fontWeight: "600",
  },
});
