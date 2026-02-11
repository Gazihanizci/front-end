import React, { useEffect, useState, useCallback }from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import Ionicons from "react-native-vector-icons/Ionicons";
import Feather from "react-native-vector-icons/Feather";
import api from "../config/api";
import { clearProfile, clearToken } from "../utils/authStorage";
import { resetToLogin } from "../navigation/navigationRef";
import MessageBox from "../components/MessageBox";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";


type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

type MenuItem = {
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
  color?: string;
};
type UserInfo = {
  kullaniciId: number;
  ad: string;
  soyad: string;
  email: string;
  aileId: number | null;
};


export default function MenuScreen({ navigation }: Props) {
  const [logoutVisible, setLogoutVisible] = useState(false);

  const handleLogout = () => {
    setLogoutVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutVisible(false);
    await clearToken();
    await clearProfile();
    resetToLogin();
  };
  const menuItems: MenuItem[] = [
    
   {
    title: "Aile Hesabı",
    icon: <Ionicons name="storefront-outline" size={22} color="#38bdf8" />,
    onPress: () => navigation.navigate("FamilyAccount"),
  },
    
    { title: "Hesaplar", icon: <Ionicons name="document-text-outline" size={22} color="#38bdf8" /> },
    {
      title: "İşlemler",
      icon: <Ionicons name="time-outline" size={22} color="#38bdf8" />,
      onPress: () => navigation.navigate("Islemler"),
    },
    { title: "Kategoriler", icon: <Ionicons name="pricetag-outline" size={22} color="#38bdf8" />,onPress: () => navigation.navigate("Categories"), },

    { title: "Sabit Ödemeler", icon: <Ionicons name="calendar-outline" size={22} color="#38bdf8" /> },
    {
      title: "Taksit Odemeleri",
      icon: <Ionicons name="card-outline" size={22} color="#38bdf8" />,
      onPress: () => navigation.navigate("TaksitOdeme"),
    },
    {
      title: "Aile Cüzdanı",
      icon: <Ionicons name="book-outline" size={22} color="#38bdf8" />,
      onPress: () => navigation.navigate("AileCuzdani"),
    },
    {
      title: "Raporlar",
      icon: <Ionicons name="pie-chart-outline" size={22} color="#38bdf8" />,
      onPress: () => navigation.navigate("Raporlar"),
    },
    { title: "Arşiv / Silinen", icon: <Ionicons name="archive-outline" size={22} color="#38bdf8" /> },
   
    { title: "Notlar", icon: <Ionicons name="clipboard-outline" size={22} color="#facc15" /> },
    { title: "Ayarlar", icon: <Ionicons name="settings-outline" size={22} color="#38bdf8" /> },
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
        right={
          <HeaderAction
            icon={<Ionicons name="close" size={16} color="#e5e7eb" />}
            onPress={() => navigation.goBack()}
          />
        }
      />

      {/* MENU LIST */}
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
        <Text style={styles.profileEmail}>
          {loadingUserInfo ? "..." : userInfo?.email ?? "-"}
        </Text>
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

        {/* ✅ Aile Hesabı badge */}
        {isFamily && !loadingUserInfo && (
          <View style={[styles.badge, userInfo?.aileId ? styles.badgeActive : styles.badgeMuted]}>
 <Text style={styles.badgeText}>
  {aileDurum}
</Text>

          </View>
        )}

        {/* ✅ sağ ok */}
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>
    );
  })}

  <View style={styles.divider} />

  {/* ALT MENÜ */}
  <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
    <View style={styles.iconBox}>
      <Ionicons name="notifications-outline" size={22} color="#e5e7eb" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.menuText}>Bildirimler</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
  </TouchableOpacity>

  <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
    <View style={styles.iconBox}>
      <Ionicons name="settings-outline" size={22} color="#e5e7eb" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.menuText}>Ayarlar</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
  </TouchableOpacity>

  <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
    <View style={styles.iconBox}>
      <Ionicons name="help-circle-outline" size={22} color="#e5e7eb" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.menuText}>Yardım</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
  </TouchableOpacity>

  <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
    <View style={styles.iconBox}>
      <Feather name="message-circle" size={22} color="#e5e7eb" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.menuText}>Bize Yazın</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
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
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f1a",
    paddingTop: 14,
  },

  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  screenTitle: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "900",
  },

  profileCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
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
    backgroundColor: "#facc15",
  },
  avatarText: { color: "#0b0f1a", fontSize: 18, fontWeight: "900" },
  profileName: { color: "#e5e7eb", fontSize: 18, fontWeight: "900" },
  profileEmail: { color: "#94a3b8", fontSize: 12, marginTop: 2, fontWeight: "700" },

  /* =========================
     MENU LIST
     ========================= */
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },

  // Kart görünümlü menu item
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },

  // ikon kutusu
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(56,189,248,0.10)",
  },

  menuText: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.18)",
    marginVertical: 16,
  },

  /* =========================
     BADGE (Aile Hesabı)
     ========================= */
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
  },

  badgeActive: {
    backgroundColor: "#facc15",
    borderColor: "rgba(250,204,21,0.55)",
  },

  badgeMuted: {
    backgroundColor: "#94a3b8",
    borderColor: "rgba(148,163,184,0.55)",
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0b0f1a",
  },

  logoutBtn: {
    backgroundColor: "#1f2933",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.6)",
    marginBottom: 16,
  },
  logoutText: {
    color: "#fb7185",
    fontSize: 15,
    fontWeight: "800",
  },

});

