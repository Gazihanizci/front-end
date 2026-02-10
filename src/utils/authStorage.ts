import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_ID_KEY = "USER_ID";

export async function saveUserId(userId: number | string) {
  await AsyncStorage.setItem(USER_ID_KEY, String(userId));
}

export async function getUserId() {
  return await AsyncStorage.getItem(USER_ID_KEY);
}

export async function clearUserId() {
  await AsyncStorage.removeItem(USER_ID_KEY);
}
