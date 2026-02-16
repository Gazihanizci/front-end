import api from "../config/api";

export type YatirimVarlikTuru = "USD" | "EUR" | "ALTIN" | "TL";

export type YatirimCreateRequest = {
  aileId: number;
  hesapAdi: string;
  varlikTuru: YatirimVarlikTuru;
  adet: number;
  ilkAlisFiyati: number;
  guncelFiyat: number;
};

export type YatirimCreateResponse = {
  yatirimId: number;
  kullaniciId: number;
  aileId: number;
  hesapAdi: string;
  varlikTuru: YatirimVarlikTuru;
  adet: number;
  ilkAlisFiyati: number;
  guncelFiyat: number;
  toplamMaliyet: number;
  guncelDeger: number;
  karZarar: number;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
};

export async function createYatirim(payload: YatirimCreateRequest) {
  const res = await api.post<YatirimCreateResponse>("/api/yatirim", payload);
  return res.data;
}

export async function getMyYatirimlar() {
  const res = await api.get<YatirimCreateResponse[]>("/api/yatirim/mine");
  return Array.isArray(res.data) ? res.data : [];
}

export async function decreaseYatirim(yatirimId: number, amount: number) {
  const payload = { adetDegisim: -Math.abs(amount) };
  const res = await api.put<YatirimCreateResponse>(`/api/yatirim/mine/${yatirimId}/adet-degis`, payload);
  return res.data;
}

export async function changeYatirimAdet(yatirimId: number, delta: number) {
  const res = await api.put<YatirimCreateResponse>(`/api/yatirim/mine/${yatirimId}/adet-degis`, {
    adetDegisim: delta,
  });
  return res.data;
}

export async function increaseYatirim(yatirimId: number, amount: number, alisFiyati: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be > 0");
  }
  if (!Number.isFinite(alisFiyati) || alisFiyati <= 0) {
    throw new Error("alisFiyati must be > 0");
  }
  const res = await api.put<YatirimCreateResponse>(`/api/yatirim/mine/${yatirimId}/adet-degis`, {
    adetDegisim: amount,
    alisFiyati,
  });
  return res.data;
}
