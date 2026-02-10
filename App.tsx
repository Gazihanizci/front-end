import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import MenuScreen from "./src/screens/MenuScreen";
import FamilyScreen from "./src/screens/FamilyScreen";
import kategoriler from "./src/screens/kategoriler";
import IslemlerScreen from "./src/screens/IslemlerScreen";
import AileCuzdaniScreen from "./src/screens/AileCuzdaniScreen";
import TaksitOdemeScreen from "./src/screens/TaksitOdemeScreen";
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Menu: undefined;
  FamilyAccount: undefined;
  Categories: undefined;
  Islemler: undefined;
  AileCuzdani: undefined;
  TaksitOdeme: undefined;

};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="FamilyAccount" component={FamilyScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Menu" component={MenuScreen} /> 
        <Stack.Screen name="Categories" component={kategoriler} />
        <Stack.Screen name="Islemler" component={IslemlerScreen} />
        <Stack.Screen name="AileCuzdani" component={AileCuzdaniScreen} />
        <Stack.Screen name="TaksitOdeme" component={TaksitOdemeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
