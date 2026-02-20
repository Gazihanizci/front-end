import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderRow = (props: {
    title: string;
    subtitle?: string;
    onPress?: () => void;
    right?: React.ReactNode;
  }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={props.onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{props.title}</Text>
        {props.subtitle ? <Text style={styles.rowSub}>{props.subtitle}</Text> : null}
      </View>
      {props.right ?? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Ayarlar"
        subtitle="Tercihlerini duzenle"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Gorunum</Text>

        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Tema Modu</Text>
            <Text style={styles.cardSub}>Koyu veya acik gorunum</Text>
          </View>
          <View style={styles.themeButtons}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setMode("dark")}
              style={[styles.themeButton, mode === "dark" && styles.themeButtonActive]}
            >
              <Text style={[styles.themeButtonText, mode === "dark" && styles.themeButtonTextActive]}>
                Koyu
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setMode("light")}
              style={[styles.themeButton, mode === "light" && styles.themeButtonActive]}
            >
              <Text style={[styles.themeButtonText, mode === "light" && styles.themeButtonTextActive]}>
                Acik
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Hesap</Text>
        {renderRow({ title: "Profil Bilgileri", subtitle: "Ad, e-posta ve hesap detaylari" })}
        {renderRow({ title: "Guvenlik", subtitle: "Parola ve oturum yonetimi" })}

        <Text style={styles.sectionTitle}>Bildirimler</Text>
        {renderRow({ title: "Bildirim Tercihleri", subtitle: "Izin istekleri ve ozetler" })}

        <Text style={styles.sectionTitle}>Yardim</Text>
        {renderRow({ title: "Sik Sorulan Sorular" })}
        {renderRow({ title: "Bize Yazin" })}
        {renderRow({ title: "Hakkinda", subtitle: "Surum ve yasal bilgiler" })}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 14 },
    content: { paddingHorizontal: 16, paddingBottom: 28 },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
      marginTop: 16,
      marginBottom: 8,
      letterSpacing: 0.6,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
    themeButtons: { flexDirection: "row", gap: 8 },
    themeButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
    },
    themeButtonActive: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    themeButtonText: { color: colors.text, fontSize: 12, fontWeight: "800" },
    themeButtonTextActive: { color: colors.onAccent },
  });
