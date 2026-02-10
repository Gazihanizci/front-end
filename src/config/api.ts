import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = "http://192.168.234.156:8080";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Her request'te USER_ID'yi alıp header'a ekle
api.interceptors.request.use(
  async (config) => {
    const userId = await AsyncStorage.getItem("USER_ID");
    if (userId) {
      config.headers["X-USER-ID"] = userId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
