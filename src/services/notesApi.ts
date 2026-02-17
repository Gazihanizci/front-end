import api from "../config/api";

export type NotResponse = { notId: number; notMetini: string; createdAt: string };

export async function listNotes(): Promise<NotResponse[]> {
  const res = await api.get("/api/notlar");
  return Array.isArray(res.data) ? res.data : [];
}

export async function createNote(notMetini: string): Promise<NotResponse> {
  const res = await api.post("/api/notlar", { notMetini });
  return res.data;
}

export async function updateNote(id: number, notMetini: string): Promise<NotResponse> {
  const res = await api.put(`/api/notlar/${id}`, { notMetini });
  return res.data;
}

export async function deleteNote(id: number): Promise<void> {
  await api.delete(`/api/notlar/${id}`);
}
