import api from "../config/api";

export type PermissionRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PermissionRequestItem = {
  id: number;
  requesterUserId: number;
  createdAt?: string;
  status?: PermissionRequestStatus;
};

export const requestPermission = async () => {
  const res = await api.post("/api/aile-not-izin/request", null);
  return res.data;
};

export const getPendingRequests = async () => {
  const res = await api.get<PermissionRequestItem[]>("/api/aile-not-izin/pending");
  return res.data ?? [];
};

export const approveRequest = async (id: number) => {
  try {
    const res = await api.get("/api/aile-not-izin/approve", { params: { id } });
    return res.data;
  } catch {
    try {
      const res = await api.get(`/api/aile-not-izin/${id}/approve`);
      return res.data;
    } catch {
      const res = await api.put(`/api/aile-not-izin/${id}/approve`, null);
      return res.data;
    }
  }
};

export const rejectRequest = async (id: number) => {
  try {
    const res = await api.get("/api/aile-not-izin/reject", { params: { id } });
    return res.data;
  } catch {
    try {
      const res = await api.get(`/api/aile-not-izin/${id}/reject`);
      return res.data;
    } catch {
      const res = await api.put(`/api/aile-not-izin/${id}/reject`, null);
      return res.data;
    }
  }
};

export const getMyRequests = async () => {
  const res = await api.get<PermissionRequestItem[]>("/api/aile-not-izin/me");
  return res.data ?? [];
};
