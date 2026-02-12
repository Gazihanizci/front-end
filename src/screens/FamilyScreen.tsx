import React, { useCallback, useEffect, useState } from "react";
import api from "../config/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { getProfile } from "../utils/authStorage";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import MessageBox from "../components/MessageBox";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyAccount">;

type FamilyInfo = {
  aileId: number;
  aileAdi: string;
  aileUyeSayisi: number;
  aileSahibiKullaniciId: number;
  parolaVarMi?: boolean;
};

export default function FamilyAccountScreen({ navigation }: Props) {
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [familyInfo, setFamilyInfo] = useState<{
    aileId: number | null;
    aileSahibiKullaniciId: number | null;
    members: { id: number; ad: string; soyad: string; email: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "members">("info");
  const [members, setMembers] = useState<{ id: number; ad: string; soyad: string; email: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [loggedInUserId, setLoggedInUserId] = useState<number | null>(null);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [removeTargetId, setRemoveTargetId] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState<number | null>(null);
  const [leaveErrorVisible, setLeaveErrorVisible] = useState(false);
  const [leaveErrorText, setLeaveErrorText] = useState("");
  const [createErrorVisible, setCreateErrorVisible] = useState(false);
  const [createErrorText, setCreateErrorText] = useState("");


  // Modal states
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);

  // Form states (Create)
  const [aileAdi, setAileAdi] = useState("");
  const [parola, setParola] = useState("");
  const [parola2, setParola2] = useState("");

  // Form states (Join)
  const [joinAileId, setJoinAileId] = useState("");
  const [joinParola, setJoinParola] = useState("");
  const [joinError, setJoinError] = useState("");
  
  const [saving, setSaving] = useState(false);

  const hasFamily = familyInfo?.aileId != null;
  const familyOwnerUserId =
    familyInfo?.aileSahibiKullaniciId != null ? Number(familyInfo.aileSahibiKullaniciId) : null;




  const getMemberTitle = (member: { ad: string; soyad: string }) => {
    return `${member.ad} ${member.soyad}`.trim();
  };

  const getMemberSub = (member: { email: string }) => {
    return member.email;
  };

  useEffect(() => {
    let isActive = true;

    const fetchFamily = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/aileler/sahibiyim");
        if (isActive) setFamily(res.data ?? null);
      } catch (err: any) {
        if (!isActive) return;
        if (err?.response?.status === 404) setFamily(null);
        else console.log("Aile çekme hata:", err?.response?.data || err?.message);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchFamily();

    return () => {
      isActive = false;
    };
  }, []);

  const fetchFamilyInfo = useCallback(async () => {
    setMembersLoading(true);
    setMembersError("");
    try {
      const res = await api.get("/api/familyinfo");
      const data = res?.data;
      setFamilyInfo(data);
      setMembers(data?.members ?? []);
    } catch (err: any) {
      console.log("Aile bilgisi hata:", err?.response?.data || err?.message);
      setMembersError("�yeler y�klenemedi.");
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilyInfo();
  }, [fetchFamilyInfo]);

useEffect(() => {
  let active = true;

  const loadProfile = async () => {
    const profile = await getProfile();
    if (active && profile?.kullaniciId) {
      setLoggedInUserId(profile.kullaniciId);
      return;
    }
    try {
      const res = await api.get("/api/userinfo");
      if (active) setLoggedInUserId(res?.data?.kullaniciId ?? null);
    } catch {
      if (active) setLoggedInUserId(null);
    }
  };

  loadProfile();
  return () => {
    active = false;
  };
}, []);


  const removeMember = async (targetUserId: number) => {
    if (!familyInfo?.aileId) return;
    try {
      await api.post(`/api/aileler/${familyInfo.aileId}/uyeler/${targetUserId}/cikar`);
      await fetchFamilyInfo();
    } catch (err: any) {
      console.log("Aileden çıkarma hata:", err?.response?.data || err?.message);
    }
  };

  const openRemoveConfirm = (targetUserId: number) => {
    setRemoveTargetId(targetUserId);
    setRemoveConfirmVisible(true);
  };

  const closeRemoveConfirm = () => {
    setRemoveConfirmVisible(false);
    setRemoveTargetId(null);
  };

  const confirmRemove = async () => {
    if (removeTargetId == null) return;
    await removeMember(removeTargetId);
    closeRemoveConfirm();
  };



  // =========================
  // ✅ Actions
  // =========================
  const refetchFamily = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/aileler/sahibiyim");
      setFamily(res.data ?? null);
    } catch (err: any) {
      if (err?.response?.status === 404) setFamily(null);
      else console.log("Aile çekme hata:", err?.response?.data || err?.message);
    } finally {
      setLoading(false);
    }
  };



  const createFamily = async () => {
    if (saving) return;

    const ad = aileAdi.trim();
    const p1 = parola.trim();
    const p2 = parola2.trim();

    if (!ad) return;
    if (!p1 || !p2) return;
    if (p1.length < 4) return;
    if (p1 !== p2) return;

    setSaving(true);
    try {
      // ✅ aile + parola aynı anda
      await api.post("/api/aileler", {
        aileAdi: ad,
        parola: p1,
      });

      setAileAdi("");
      setParola("");
      setParola2("");
      setCreateModal(false);
      await refetchFamily();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data ||
        err?.message ||
        "Aile oluşturma başarısız.";
      console.log("Aile oluşturma hata:", msg);
      setCreateErrorText(String(msg));
      setCreateErrorVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const joinFamily = async () => {
    if (saving) return;

    const aileIdNum = Number(joinAileId.trim());
    const p = joinParola;
    const pTrimmed = joinParola.trim();

    if (!aileIdNum || aileIdNum <= 0) {
      setJoinError("Geçerli bir Aile ID gir.");
      return;
    }
    if (!pTrimmed) {
      setJoinError("Parola boş olamaz.");
      return;
    }

    setSaving(true);
    setJoinError("");
    try {
      // ✅ aileye katıl: aileId + parola
      await api.post("/api/ailekatil", {
        aileId: aileIdNum,
        parola: joinParola.trim(),
      });

      setJoinAileId("");
      setJoinParola("");
      setJoinModal(false);
      await refetchFamily();
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data ||
        err?.message;
      console.log("Aileye katılma hata:", status, apiMessage);
      if (status === 401) {
        setJoinError("Parola hatalı. Lütfen tekrar deneyin.");
      } else {
        setJoinError(
          typeof apiMessage === "string" && apiMessage.trim().length > 0
            ? apiMessage
            : "Katılma işlemi başarısız. Bilgileri kontrol et."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const leaveFamily = async (newOwnerUserId?: number) => {
    if (leaving || !familyInfo?.aileId) return;
    setLeaving(true);
    try {
      if (newOwnerUserId) {
        await api.post(
          `/api/aileler/${familyInfo.aileId}/sahiplik-devret/${newOwnerUserId}`
        );
      }
      await api.post(`/api/aileler/${familyInfo.aileId}/ayril`);
      await fetchFamilyInfo();
      await refetchFamily();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data ||
        err?.message ||
        "Aileden ayrılma başarısız.";
      console.log("Aileden ayrilma hata:", msg);
      setLeaveErrorText(String(msg));
      setLeaveErrorVisible(true);
    } finally {
      setLeaving(false);
    }
  };

  const startLeaveFlow = () => {
    if (!hasFamily || !familyInfo?.aileId) return;
    if (familyOwnerUserId != null && loggedInUserId != null && familyOwnerUserId === loggedInUserId) {
      const otherMembers = members.filter((m) => m.id !== loggedInUserId);
      if (otherMembers.length > 0) {
        setSelectedNewOwnerId(otherMembers[0]?.id ?? null);
        setTransferModalVisible(true);
        return;
      }
    }
    setLeaveConfirmVisible(true);
  };

  // =========================
  // ✅ UI
  // =========================
  return (
    <View style={styles.screen}>
      {/* TOP BAR */}
      <ScreenHeader
        title="Aile Hesabı"
        subtitle="Aile oluştur / aileye katıl"
        left={<HeaderAction label="Geri" onPress={() => navigation.goBack()} />}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {/* HERO */}
        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Aile Paneli</Text>
            <Text style={styles.heroSub}>Aile durumunu ve üyeleri buradan yönet.</Text>
          </View>
          <View style={[styles.heroBadge, hasFamily ? styles.heroBadgeActive : styles.heroBadgeMuted]}>
            <Text style={styles.heroBadgeText}>{hasFamily ? "AKTİF" : "YOK"}</Text>
          </View>
        </View>

        {/* QUICK STATS */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Aile ID</Text>
            <Text style={styles.statValue}>
              {familyInfo?.aileId != null ? `#${familyInfo.aileId}` : "-"}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Üye Sayısı</Text>
            <Text style={styles.statValue}>
              {familyInfo?.members ? familyInfo.members.length : "-"}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Durum</Text>
            <Text style={[styles.statValue, hasFamily ? styles.statValueActive : styles.statValueMuted]}>
              {hasFamily ? "Aktif" : "Yok"}
            </Text>
          </View>
        </View>

        {/* TABS */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "info" && styles.tabBtnActive]}
            onPress={() => setActiveTab("info")}
          >
            <Text style={[styles.tabText, activeTab === "info" && styles.tabTextActive]}>Bilgi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "members" && styles.tabBtnActive]}
            onPress={() => setActiveTab("members")}
          >
            <Text style={[styles.tabText, activeTab === "members" && styles.tabTextActive]}>Üyeler</Text>
          </TouchableOpacity>
        </View>

        {activeTab === "info" ? (
          <>
        {/* FAMILY INFO */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>AİLE BİLGİSİ</Text>
            {hasFamily ? (
              <Text style={styles.badge}>AKTİF</Text>
            ) : (
              <Text style={styles.badgeMuted}>YOK</Text>
            )}
          </View>

          {hasFamily ? (
            <Text style={{ color: "#94a3b8", marginTop: 10 }}>
              Aile Hesabınız aktif.
            </Text>
          ) : (
            <Text style={{ color: "#94a3b8", marginTop: 10 }}>
              Herhangi Bir Aile Hesabınız Bulunmamaktadır.
            </Text>
          )}


        </View>

        {/* ACTION CARDS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>İŞLEMLER</Text>

          <TouchableOpacity
            style={[styles.actionRow, hasFamily && { opacity: 0.5 }]}
            onPress={() => !hasFamily && setCreateModal(true)}
            disabled={hasFamily}
          >
            <View>
              <Text style={styles.actionTitle}>Aile Hesabı Oluştur</Text>
              <Text style={styles.actionSub}>
                {hasFamily ? "Zaten bir aile hesabın var" : "Aile adı ve parola belirleyerek oluştur"}
              </Text>
            </View>
            <Text style={styles.actionIcon}>＋</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, hasFamily && { opacity: 0.5 }]}
            onPress={() => {
              if (hasFamily) return;
              setJoinError("");
              setJoinModal(true);
            }}
            disabled={hasFamily}
          >
            <View>
              <Text style={styles.actionTitle}>Aileye Katıl</Text>
              <Text style={styles.actionSub}>Aile ID ve parola ile mevcut aileye dahil ol</Text>
            </View>
            <Text style={styles.actionIcon}>↗</Text>
          </TouchableOpacity>

          {hasFamily && (
            <TouchableOpacity
              style={[styles.actionRow, leaving && { opacity: 0.6 }]}
              onPress={startLeaveFlow}
              activeOpacity={0.8}
              disabled={leaving}
            >
              <View>
                <Text style={styles.actionTitle}>Aileden Çık</Text>
                <Text style={styles.actionSub}>Mevcut aile üyeliğini sonlandır</Text>
              </View>
              <Text style={styles.actionIcon}>←</Text>
            </TouchableOpacity>
          )}
        </View>
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
  <Text style={styles.cardTitle}>AİLE ÜYELERİ</Text>
  <Text style={styles.sectionSub}>{members.length} üye</Text>
</View>
            {!hasFamily ? (
              <Text style={{ color: "#94a3b8", marginTop: 10 }}>
                Önce bir aile hesabı oluştur ya da katıl.
              </Text>
            ) : membersLoading ? (
              <Text style={{ color: "#94a3b8", marginTop: 10 }}>Yükleniyor...</Text>
            ) : membersError ? (
              <Text style={{ color: "#f87171", marginTop: 10 }}>{membersError}</Text>
            ) : members.length === 0 ? (
              <Text style={{ color: "#94a3b8", marginTop: 10 }}>
                Üye bulunamadı.
              </Text>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                {members.map((member) => {
                  const title = getMemberTitle(member);
                  const sub = getMemberSub(member);
                  return (
                    <View key={member.id} style={styles.memberCard}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>{title.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{title}</Text>
                        {sub ? <Text style={styles.memberSub}>{sub}</Text> : null}
                        {loggedInUserId != null &&
                          familyOwnerUserId === loggedInUserId &&
                          member.id !== loggedInUserId && (
                            <TouchableOpacity
                              style={styles.removeBtn}
                              onPress={() => openRemoveConfirm(member.id)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.removeBtnText}>Aileden Çıkar</Text>
                            </TouchableOpacity>
                          )}

                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* CREATE MODAL (Aile adı + parola + tekrar parola) */}
      <Modal visible={createModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Aile Hesabı Oluştur</Text>

            <TextInput
              style={styles.input}
              placeholder="Aile Adı (örn: İzci Ailesi)"
              placeholderTextColor="#9ca3af"
              value={aileAdi}
              onChangeText={setAileAdi}
            />

            <TextInput
              style={styles.input}
              placeholder="Parola"
              placeholderTextColor="#9ca3af"
              value={parola}
              onChangeText={setParola}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Parola (tekrar)"
              placeholderTextColor="#9ca3af"
              value={parola2}
              onChangeText={setParola2}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={createFamily}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Oluştur</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                if (saving) return;
                setCreateModal(false);
              }}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* JOIN MODAL (Aile ID + Parola) */}
      <Modal visible={joinModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Aileye Katıl</Text>

            <Text style={styles.helperText}>Aile ID ve aile parolasını gir.</Text>

            <TextInput
              style={styles.input}
              placeholder="Aile ID (örn: 10)"
              placeholderTextColor="#9ca3af"
              value={joinAileId}
              onChangeText={setJoinAileId}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Aile Parolası"
              placeholderTextColor="#9ca3af"
              value={joinParola}
              onChangeText={(text) => {
                setJoinParola(text);
                if (joinError) setJoinError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              secureTextEntry
            />

            {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={joinFamily}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Katıl</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                if (saving) return;
                setJoinModal(false);
              }}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TRANSFER OWNERSHIP MODAL */}
      <Modal visible={transferModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Sahipliği Devret</Text>
            <Text style={styles.helperText}>Önce yeni aile sahibini seç.</Text>

            <ScrollView contentContainerStyle={{ gap: 10 }}>
              {members
                .filter((m) => m.id !== loggedInUserId)
                .map((m) => {
                  const selected = selectedNewOwnerId === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.memberPickRow,
                        selected && styles.memberPickRowActive,
                      ]}
                      onPress={() => setSelectedNewOwnerId(m.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.memberPickAvatar}>
                        <Text style={styles.memberPickAvatarText}>
                          {m.ad?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberPickName}>{`${m.ad} ${m.soyad}`.trim()}</Text>
                        <Text style={styles.memberPickSub}>{m.email}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, (!selectedNewOwnerId || leaving) && { opacity: 0.6 }]}
              onPress={async () => {
                if (!selectedNewOwnerId) return;
                setTransferModalVisible(false);
                await leaveFamily(selectedNewOwnerId);
              }}
              disabled={!selectedNewOwnerId || leaving}
            >
              {leaving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryBtnText}>Devret ve Çık</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setTransferModalVisible(false)}
              disabled={leaving}
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MessageBox
        visible={removeConfirmVisible}
        title="Aileden Çıkar"
        message="Bu üyeyi aileden çıkarmak istediğinize emin misiniz?"
        type="error"
        onClose={closeRemoveConfirm}
        onCancel={closeRemoveConfirm}
        onConfirm={confirmRemove}
        confirmText="Çıkar"
        cancelText="Vazgeç"
      />
      <MessageBox
        visible={leaveConfirmVisible}
        title="Aileden Çık"
        message="Çıkmak istediğinizden emin misiniz?"
        type="error"
        onClose={() => setLeaveConfirmVisible(false)}
        onCancel={() => setLeaveConfirmVisible(false)}
        onConfirm={async () => {
          setLeaveConfirmVisible(false);
          await leaveFamily();
        }}
        confirmText="Çık"
        cancelText="Vazgeç"
      />
      <MessageBox
        visible={leaveErrorVisible}
        title="Aileden Ayrılma Hatası"
        message={leaveErrorText || "Aileden ayrılma başarısız."}
        type="error"
        onClose={() => setLeaveErrorVisible(false)}
        confirmText="Tamam"
      />
      <MessageBox
        visible={createErrorVisible}
        title="Aile Oluşturma Hatası"
        message={createErrorText || "Aile oluşturma başarısız."}
        type="error"
        onClose={() => setCreateErrorVisible(false)}
        confirmText="Tamam"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0f1a" },

  topBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: { color: "#cbd5e1", fontSize: 18 },
  topBarCenter: { alignItems: "center" },
  topTitle: { color: "#e5e7eb", fontSize: 18, fontWeight: "700" },
  topSub: { color: "#94a3b8", fontSize: 13, marginTop: 2 },

  card: {
    backgroundColor: "#0f172a",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#e5e7eb", fontSize: 14, fontWeight: "800", letterSpacing: 0.6 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionSub: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },

  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTitle: { color: "#e5e7eb", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#94a3b8", fontSize: 12, marginTop: 4, fontWeight: "700" },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroBadgeActive: { backgroundColor: "#facc15", borderColor: "rgba(250,204,21,0.55)" },
  heroBadgeMuted: { backgroundColor: "#94a3b8", borderColor: "rgba(148,163,184,0.55)" },
  heroBadgeText: { color: "#0b0f1a", fontWeight: "900", fontSize: 12 },

  statRow: {
    marginHorizontal: 16,
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  statLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "800" },
  statValue: { color: "#e5e7eb", fontSize: 14, fontWeight: "900", marginTop: 6 },
  statValueActive: { color: "#facc15" },
  statValueMuted: { color: "#94a3b8" },

  badge: {
    color: "#0b0f1a",
    backgroundColor: "#facc15",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontWeight: "800",
    fontSize: 12,
  },
  badgeMuted: {
    color: "#0b0f1a",
    backgroundColor: "#94a3b8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontWeight: "800",
    fontSize: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.12)",
  },
  infoLabel: { color: "#94a3b8", fontSize: 13, fontWeight: "700" },
  infoValue: { color: "#e5e7eb", fontSize: 14, fontWeight: "800" },

  actionRow: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    borderTopColor: "rgba(148,163,184,0.12)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionTitle: { color: "#e5e7eb", fontSize: 16, fontWeight: "800" },
  actionSub: { color: "#94a3b8", marginTop: 4, fontSize: 12, fontWeight: "700" },
  actionIcon: { color: "#e5e7eb", fontSize: 20, fontWeight: "900" },

  tabs: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#111827",
  },
  tabText: { color: "#94a3b8", fontSize: 13, fontWeight: "800" },
  tabTextActive: { color: "#e5e7eb" },

  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
  },
  memberAvatarText: { color: "#0b0f1a", fontSize: 16, fontWeight: "900" },
  memberName: { color: "#e5e7eb", fontSize: 14, fontWeight: "800" },
  memberSub: { color: "#94a3b8", fontSize: 12, marginTop: 4, fontWeight: "700" },
  removeBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#fb7185",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  removeBtnText: { color: "#0b0f1a", fontSize: 12, fontWeight: "900" },
  memberPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  memberPickRowActive: {
    borderColor: "#facc15",
    backgroundColor: "rgba(250,204,21,0.12)",
  },
  memberPickAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
  },
  memberPickAvatarText: { color: "#0b0f1a", fontSize: 14, fontWeight: "900" },
  memberPickName: { color: "#e5e7eb", fontSize: 13, fontWeight: "800" },
  memberPickSub: { color: "#94a3b8", fontSize: 11, marginTop: 2, fontWeight: "700" },


  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    height: "56%",
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginBottom: 10 },
  helperText: { color: "#94a3b8", fontSize: 12, marginBottom: 10, fontWeight: "700" },
  errorText: { color: "#f87171", fontSize: 12, marginBottom: 8, fontWeight: "700" },

  input: { backgroundColor: "#111827", color: "#fff", padding: 14, borderRadius: 12, marginBottom: 10 },
debugText: {
  color: "#94a3b8",
  fontSize: 12,
  marginTop: 6,
  fontWeight: "700",
},

  primaryBtn: {
    backgroundColor: "#facc15",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#0b0f1a", fontWeight: "900" },

  cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  cancelText: { color: "#94a3b8", fontWeight: "800" },
});







































