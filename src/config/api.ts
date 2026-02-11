import axios from "axios";
import { clearProfile, clearToken, getToken } from "../utils/authStorage";
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
    const token = await getToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 401 -> global logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    const skipLogout =
      url.includes("/api/ailekatil") ||
      url.includes("/api/aileler/katil");
    if (status === 401 && !skipLogout) {
      await clearToken();
      await clearProfile();
      resetToLogin();
    }
    return Promise.reject(error);
  }
);

export default api;
