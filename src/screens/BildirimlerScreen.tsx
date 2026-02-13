import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";

type Props = NativeStackScreenProps<RootStackParamList, "Bildirimler">;

export default function BildirimlerScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Bildirimler"
        subtitle="Guncel bildirimler"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color="#e5e7eb" />}
            onPress={() => navigation.goBack()}
          />
        }
      />

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Bildirimler</Text>
          <Text style={styles.subtitle}>Bu sayfayi istersen API ile baglayabiliriz.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f1a" },
  content: { padding: 16 },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  title: { color: "#e5e7eb", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  subtitle: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
});
