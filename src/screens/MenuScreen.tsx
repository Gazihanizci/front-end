import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import Feather from "react-native-vector-icons/Feather";
import { RootStackParamList } from "../../App";
import api from "../config/api";
import MessageBox from "../components/MessageBox";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import { resetToLogin } from "../navigation/navigationRef";
import { clearProfile, clearTokens } from "../utils/authStorage";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

type MenuItem = {
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
};

type UserInfo = {
  kullaniciId: number;
  ad: string;
  soyad: string;
  email: string;
  aileId: number | null;
};

export default function MenuScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const handleLogout = () => {
    setLogoutVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutVisible(false);
    await clearTokens();
    await clearProfile();
    resetToLogin();
  };

  const menuItems: MenuItem[] = [
    {
      title: "Aile Hesabı",
      icon: <Ionicons name="storefront-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("FamilyAccount"),
    },
    {
      title: "Hesaplar",
      icon: <Ionicons name="document-text-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("Hesaplar"),
    },
    {
      title: "İşlemler",
      icon: <Ionicons name="time-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("Islemler"),
    },
    {
      title: "Kategoriler",
      icon: <Ionicons name="pricetag-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("Categories"),
    },
    {
      title: "Sabit Ödemeler",
      icon: <Ionicons name="calendar-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("SabitOdemeler"),
    },
    {
      title: "Taksit Odemeleri",
      icon: <Ionicons name="card-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("TaksitOdeme"),
    },
    {
      title: "Aile Cüzdanı",
      icon: <Ionicons name="book-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("AileCuzdani"),
    },
    {
      title: "Raporlar",
      icon: <Ionicons name="pie-chart-outline" size={22} color={colors.accent} />,
      onPress: () => navigation.navigate("Raporlar"),
    },
   
    {
      title: "Notlar",
      icon: <Ionicons name="clipboard-outline" size={22} color={colors.warning} />,
      onPress: () => navigation.navigate("Notlar"),
    },
  ];

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(true);

  const fetchUserInfo = useCallback(async () => {
    setLoadingUserInfo(true);
    try {
      const res = await api.get("/api/userinfo");
      setUserInfo(res.data);
    } catch (err) {
      console.log("Menu userinfo hata:", err);
      setUserInfo(null);
    } finally {
      setLoadingUserInfo(false);
    }
  }, []);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Menü"
        subtitle="Hızlı erişim"
        left={
          <HeaderAction
            label="Geri"
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <HeaderAction
            icon={<Ionicons name="close" size={16} color={colors.text} />}
            onPress={() => navigation.goBack()}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.listContainer}>
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userInfo?.ad?.[0] ? userInfo.ad[0].toUpperCase() : "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {loadingUserInfo
                  ? "Yükleniyor..."
                  : userInfo
                  ? `${userInfo.ad} ${userInfo.soyad}`
                  : "Kullanıcı"}
              </Text>
              <Text style={styles.profileEmail}>{loadingUserInfo ? "..." : userInfo?.email ?? "-"}</Text>
            </View>
            <View />
          </View>
        </View>

        {menuItems.map((item, index) => {
          const isFamily = item.title === "Aile Hesabı";
          const aileDurum = userInfo?.aileId ? "AKTİF" : "YOK";

          return (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={item.onPress}
            >
              <View style={styles.iconBox}>{item.icon}</View>

              <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>{item.title}</Text>
              </View>

              {isFamily && !loadingUserInfo && (
                <View style={[styles.badge, userInfo?.aileId ? styles.badgeActive : styles.badgeMuted]}>
                  <Text style={styles.badgeText}>{aileDurum}</Text>
                </View>
              )}

              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Bildirimler")}
        >
          <View style={styles.iconBox}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuText}>Bildirimler</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Settings")}
        >
          <View style={styles.iconBox}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuText}>Ayarlar</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={handleLogout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      <MessageBox
        visible={logoutVisible}
        title="Çıkış Yap"
        message="Çıkmak istediğinizden emin misiniz?"
        type="error"
        onClose={() => setLogoutVisible(false)}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={confirmLogout}
        confirmText="Çıkış Yap"
        cancelText="Vazgeç"
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 14,
    },

    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.warning,
    },
    avatarText: { color: colors.onAccent, fontSize: 18, fontWeight: "900" },
    profileName: { color: colors.text, fontSize: 18, fontWeight: "900" },
    profileEmail: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: "700" },

    listContainer: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
    },

    menuItem: {
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

    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      backgroundColor: colors.accentSoft,
    },

    menuText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },

    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 16,
    },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      marginRight: 8,
      borderWidth: 1,
    },
    badgeActive: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    badgeMuted: {
      backgroundColor: colors.textMuted,
      borderColor: colors.textMuted,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.onAccent,
    },

    logoutBtn: {
      backgroundColor: colors.logoutBg,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.danger,
      marginBottom: 16,
    },
    logoutText: {
      color: colors.danger,
      fontSize: 15,
      fontWeight: "800",
    },

  });
