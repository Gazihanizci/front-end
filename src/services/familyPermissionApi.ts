import api from "../config/api";

export type PermissionStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export type PermissionStatusResponse = { status: PermissionStatus };
export type PermissionRequestResponse = { status: "PENDING" | "APPROVED"; alreadyApproved: boolean };
export type PermissionInboxItem = {
  id: number;
  requesterUserId: number;
  adSoyad: string;
  createdAt: string;
};

export async function getStatus(): Promise<PermissionStatusResponse> {
  const res = await api.get("/api/ailecuzdani/izin/status");
  return res.data;
}

export async function requestPermission(): Promise<PermissionRequestResponse> {
  const res = await api.post("/api/ailecuzdani/izin/request", null);
  return res.data;
}

export async function getInbox(): Promise<PermissionInboxItem[]> {
  const res = await api.get("/api/ailecuzdani/izin/inbox");
  return Array.isArray(res.data) ? res.data : [];
}

export async function approve(permissionId: number): Promise<void> {
  await api.post(`/api/ailecuzdani/izin/${permissionId}/approve`, null);
}

export async function reject(permissionId: number): Promise<void> {
  await api.post(`/api/ailecuzdani/izin/${permissionId}/reject`, null);
}
