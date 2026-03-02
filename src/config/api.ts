import axios from "axios";
import { clearProfile, clearTokens, getAccessToken } from "../utils/authStorage";
import { resetToLogin } from "../navigation/navigationRef";

export const BASE_URL = "http://192.168.234.156:8080";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Her request'te token'i header'a ekle
api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      const trimmed = token.trim();
      config.headers.Authorization = /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 401/403 -> global logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    const skipLogout =
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/verify-email") ||
      url.includes("/api/auth/register") ||
      url.includes("/api/ailekatil") ||
      url.includes("/api/aileler/katil") ||
      url.includes("/api/ozelislemler") ||
      url.includes("/api/market") ||
      url.includes("/api/ailecuzdani/izin/inbox") ||
      url.includes("/api/ailecuzdani/izin/") ||
      url.includes(":8090/");
    if (status === 401) {
      console.log("401 intercepted:", { url, skipLogout, data: error?.response?.data });
    }
    if (status === 401 && !skipLogout) {
      await clearTokens();
      await clearProfile();
      resetToLogin();
    }
    return Promise.reject(error);
  }
);

export default api;
