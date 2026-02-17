import api from "../config/api";

export type SabitOdemeResponse = {
  odemeId: number;
  kullaniciId: number;
  aileId: number | null;
  odemeAdi: string;
  sonOdemeGunu: string;
  aktif: boolean;
  aciklama?: string;
  createdAt: string;
};

export async function getAll(): Promise<SabitOdemeResponse[]> {
  const res = await api.get("/api/sabitodemeler");
  return Array.isArray(res.data) ? res.data : [];
}

export async function pasifeCek(id: number): Promise<SabitOdemeResponse> {
  const res = await api.patch(`/api/sabitodemeler/${id}/pasif`, null);
  return res.data;
}

export async function aktifeAl(id: number): Promise<SabitOdemeResponse> {
  const res = await api.patch(`/api/sabitodemeler/${id}/aktif`, null);
  return res.data;
}
