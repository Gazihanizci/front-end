import AsyncStorage from "@react-native-async-storage/async-storage";

// NOTE: For production, consider using SecureStore/Keychain for token storage.
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const PROFILE_KEY = "AUTH_PROFILE";

const listeners = new Set();

const emit = (token) => {
  listeners.forEach((fn) => fn(token));
};

export function onAuthTokenChanged(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function setTokens({ accessToken, refreshToken }) {
  const ops = [];
  if (accessToken) {
    ops.push(AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken));
  } else {
    ops.push(AsyncStorage.removeItem(ACCESS_TOKEN_KEY));
  }
  if (refreshToken) {
    ops.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken));
  } else {
    ops.push(AsyncStorage.removeItem(REFRESH_TOKEN_KEY));
  }
  await Promise.all(ops);
  emit(accessToken || null);
}

export async function getAccessToken() {
  return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await Promise.all([
    AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
  ]);
  emit(null);
}

export async function saveProfile(profile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getProfile() {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearProfile() {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

// Backward-compatible helpers
export async function saveToken(token) {
  await setTokens({ accessToken: token, refreshToken: null });
}

export async function getToken() {
  return await getAccessToken();
}

export async function clearToken() {
  await clearTokens();
}
