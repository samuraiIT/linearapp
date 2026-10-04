import axios from "axios";

// Prefer explicit env; fall back to same-host /api (works with docker-compose nginx),
// then localhost dev server.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `${window.location.protocol}//${window.location.host}/api`
    : "http://localhost:3005");

export const SERVER_WS =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `${window.location.protocol}//${window.location.host}`
    : "http://localhost:3005");

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- Auth token storage ----
let authToken: string | null = null;
try {
  if (typeof window !== "undefined") {
    authToken = localStorage.getItem("linear_token");
  }
} catch {}

export function setToken(token: string | null) {
  authToken = token;
  try {
    if (token) localStorage.setItem("linear_token", token);
    else localStorage.removeItem("linear_token");
  } catch {}
}

export function getToken() {
  return authToken;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// ---- Auth API ----
export const authAPI = {
  signup: (data: { email: string; password: string; name?: string; workspaceName?: string; teamName?: string; teamIdentifier?: string }) =>
    api.post("/auth/signup", data),
  login: (data: { email: string; password: string }) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  updateMe: (data: any) => api.patch("/auth/me", data),
};

// Tickets
export const ticketAPI = {
  getAll: (params?: any) => api.get("/ticket", { params }),
  getById: (id: string) => api.get(`/ticket/${id}`),
  create: (data: any) => api.post("/ticket", data),
  update: (id: string, data: any) => api.patch(`/ticket/${id}`, data),
  delete: (id: string) => api.delete(`/ticket/${id}`),
  children: (id: string) => api.get(`/ticket/${id}/children`),
  subscribe: (id: string, data?: any) => api.post(`/ticket/${id}/subscribe`, data || {}),
  subscribers: (id: string) => api.get(`/ticket/${id}/subscribers`),
  batch: (ids: string[], changes: any) => api.post("/ticket/batch", { ids, changes }),
};

// Inbox — notifications for issues I'm subscribed to
export const inboxAPI = {
  list: () => api.get("/view/inbox"),
};

// Saved views / filters
export const viewAPI = {
  getAll: () => api.get("/view"),
  create: (data: any) => api.post("/view", data),
  remove: (id: string) => api.delete(`/view/${id}`),
};

// Cycles analytics
export const cycleStatsAPI = {
  stats: (id: string) => api.get(`/cycle/${id}/stats`),
};

// Users
export const userAPI = {
  getAll: () => api.get("/user"),
  getById: (id: string) => api.get(`/user/${id}`),
  create: (data: any) => api.post("/user", data),
  update: (id: string, data: any) => api.patch(`/user/${id}`, data),
};

// Teams
export const teamAPI = {
  getAll: () => api.get("/team"),
  getById: (id: string) => api.get(`/team/${id}`),
  create: (data: any) => api.post("/team", data),
  update: (id: string, data: any) => api.patch(`/team/${id}`, data),
  delete: (id: string) => api.delete(`/team/${id}`),
};

// Projects
export const projectAPI = {
  getAll: (params?: any) => api.get("/project", { params }),
  getById: (id: string) => api.get(`/project/${id}`),
  create: (data: any) => api.post("/project", data),
  update: (id: string, data: any) => api.patch(`/project/${id}`, data),
  delete: (id: string) => api.delete(`/project/${id}`),
  roadmap: (params?: any) => api.get("/project/roadmap", { params }),
  issues: (id: string) => api.get(`/project/${id}/issues`),
};

// Custom status views (workflow states per team)
export const statusViewAPI = {
  getAll: (params?: any) => api.get("/statusview", { params }),
  create: (data: any) => api.post("/statusview", data),
  update: (id: string, data: any) => api.patch(`/statusview/${id}`, data),
  delete: (id: string) => api.delete(`/statusview/${id}`),
};

// Labels
export const labelAPI = {
  getAll: (params?: any) => api.get("/label", { params }),
  create: (data: any) => api.post("/label", data),
  update: (id: string, data: any) => api.patch(`/label/${id}`, data),
  delete: (id: string) => api.delete(`/label/${id}`),
};

// Cycles
export const cycleAPI = {
  getAll: (params?: any) => api.get("/cycle", { params }),
  getById: (id: string) => api.get(`/cycle/${id}`),
  create: (data: any) => api.post("/cycle", data),
  update: (id: string, data: any) => api.patch(`/cycle/${id}`, data),
  delete: (id: string) => api.delete(`/cycle/${id}`),
};

// Comments
export const commentAPI = {
  getAll: (params?: any) => api.get("/comment", { params }),
  getById: (id: string) => api.get(`/comment/${id}`),
  create: (data: any) => api.post("/comment", data),
  update: (id: string, data: any) => api.patch(`/comment/${id}`, data),
  addReaction: (id: string, data: any) => api.patch(`/comment/${id}/reaction`, data),
  delete: (id: string) => api.delete(`/comment/${id}`),
};

// Activity
export const activityAPI = {
  getAll: (params?: any) => api.get("/activity", { params }),
  create: (data: any) => api.post("/activity", data),
};

// Upload
export const uploadAPI = {
  uploadFiles: (files: FormData) => {
    return axios.post(`${API_BASE}/upload`, files, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

