import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import VerifyCodeScreen from "./src/screens/VerifyCodeScreen";
import HomeScreen from "./src/screens/HomeScreen";
import MenuScreen from "./src/screens/MenuScreen";
import FamilyScreen from "./src/screens/FamilyScreen";
import kategoriler from "./src/screens/kategoriler";
import IslemlerScreen from "./src/screens/IslemlerScreen";
import AileCuzdaniScreen from "./src/screens/AileCuzdaniScreen";
import TaksitOdemeScreen from "./src/screens/TaksitOdemeScreen";
import RaporlarScreen from "./src/screens/Raporlar";
import SabitOdemelerScreen from "./src/screens/sabit_odemeler";
import BildirimlerScreen from "./src/screens/BildirimlerScreen";
import HesaplarScreen from "./src/screens/HesaplarScreen";
import YatirimAzaltScreen from "./src/screens/YatirimAzaltScreen";
import FamilyPermissionInboxScreen from "./src/screens/FamilyPermissionInboxScreen";
import NotesListScreen from "./src/screens/NotesListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import { getAccessToken, onAuthTokenChanged } from "./src/utils/authStorage";
import { navigationRef } from "./src/navigation/navigationRef";
import { ThemeProvider } from "./src/theme/theme";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyCode: { email: string };
  Home: undefined;
  Menu: undefined;
  FamilyAccount: undefined;
  Categories: undefined;
  Islemler: undefined;
  AileCuzdani: undefined;
  TaksitOdeme: undefined;
  Raporlar: undefined;
  SabitOdemeler: undefined;
  Bildirimler: undefined;
  Hesaplar: undefined;
  FamilyPermissionInbox: undefined;
  Notlar: undefined;
  Chat: undefined;
  YatirimAzalt: { yatirimId: number; hesapAdi: string; varlikTuru: "USD" | "EUR" | "ALTIN" | "TL" };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const token = await getAccessToken();
      if (active) {
        setIsAuthed(!!token);
        setChecking(false);
      }
    };
    init();

    const unsub = onAuthTokenChanged((token) => {
      setIsAuthed(!!token);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthed ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Menu" component={MenuScreen} />
              <Stack.Screen name="FamilyAccount" component={FamilyScreen} />
              <Stack.Screen name="Categories" component={kategoriler} />
              <Stack.Screen name="Islemler" component={IslemlerScreen} />
              <Stack.Screen name="AileCuzdani" component={AileCuzdaniScreen} />
              <Stack.Screen name="TaksitOdeme" component={TaksitOdemeScreen} />
              <Stack.Screen name="Raporlar" component={RaporlarScreen} />
              <Stack.Screen name="SabitOdemeler" component={SabitOdemelerScreen} />
              <Stack.Screen name="Bildirimler" component={BildirimlerScreen} />
              <Stack.Screen name="Hesaplar" component={HesaplarScreen} />
              <Stack.Screen name="FamilyPermissionInbox" component={FamilyPermissionInboxScreen} />
              <Stack.Screen name="Notlar" component={NotesListScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="YatirimAzalt" component={YatirimAzaltScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
