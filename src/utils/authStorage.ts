import AsyncStorage from "@react-native-async-storage/async-storage";

// NOTE: For production, consider using SecureStore/Keychain for token storage.
const TOKEN_KEY = "ACCESS_TOKEN";
const PROFILE_KEY = "AUTH_PROFILE";

export type Profile = {
  kullaniciId: number;
  email: string;
};

type AuthListener = (token: string | null) => void;
const listeners = new Set<AuthListener>();

const emit = (token: string | null) => {
  listeners.forEach((fn) => fn(token));
};

export function onAuthTokenChanged(listener: AuthListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  emit(token);
}

export async function getToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  emit(null);
}

export async function saveProfile(profile: Profile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getProfile(): Promise<Profile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export async function clearProfile() {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
