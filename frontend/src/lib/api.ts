import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
  }) => api.post("/auth/register", data),
};

// Conversations
export const conversationsAPI = {
  list: (params?: {
    status?: string;
    assigned_to?: number;
    channel_id?: number;
    search?: string;
    priority?: string;
  }) => api.get("/conversations", { params }),
  get: (id: number) => api.get(`/conversations/${id}`),
  update: (id: number, data: { status?: string; priority?: string; assigned_to?: number }) =>
    api.patch(`/conversations/${id}`, data),
  assign: (id: number, userId: number) =>
    api.post(`/conversations/${id}/assign`, { user_id: userId }),
  addTag: (id: number, tagId: number) =>
    api.post(`/conversations/${id}/tags`, { tag_id: tagId }),
  removeTag: (id: number, tagId: number) =>
    api.delete(`/conversations/${id}/tags/${tagId}`),
};

// Messages
export const messagesAPI = {
  list: (conversationId: number) =>
    api.get(`/conversations/${conversationId}/messages`),
  reply: (conversationId: number, content: string) =>
    api.post(`/conversations/${conversationId}/messages`, { content }),
  addNote: (conversationId: number, content: string) =>
    api.post(`/conversations/${conversationId}/notes`, { content }),
};

// Channels
export const channelsAPI = {
  list: () => api.get("/channels"),
  create: (data: { type: string; name: string; credentials?: Record<string, string> }) =>
    api.post("/channels", data),
  update: (id: number, data: { name?: string; is_active?: boolean; credentials?: Record<string, string> }) =>
    api.patch(`/channels/${id}`, data),
  delete: (id: number) => api.delete(`/channels/${id}`),
};

// Contacts
export const contactsAPI = {
  list: (params?: { search?: string }) => api.get("/contacts", { params }),
  get: (id: number) => api.get(`/contacts/${id}`),
  update: (id: number, data: { name?: string; email?: string; phone?: string }) =>
    api.patch(`/contacts/${id}`, data),
};

// Reports
export const reportsAPI = {
  overview: (period?: string, channel?: string) => api.get("/reports/overview", { params: { period, channel } }),
  agents: (period?: string, channel?: string) => api.get("/reports/agents", { params: { period, channel } }),
  channels: (period?: string) => api.get("/reports/channels", { params: { period } }),
  messages: (period?: string, channel?: string) => api.get("/reports/messages", { params: { period, channel } }),
};

// AI Bot
export const aiBotAPI = {
  getConfig: () => api.get("/ai-bot/config"),
  saveConfig: (data: {
    brand_name: string; brand_description: string; brand_tone: string;
    products_services: string; faq: string; policies: string;
    greeting_message: string; fallback_message: string; custom_instructions: string;
  }) => api.post("/ai-bot/config", data),
  toggle: () => api.patch("/ai-bot/toggle"),
  getUsage: () => api.get("/ai-bot/usage"),
};

// Bot
export const botAPI = {
  listRules: () => api.get("/bot/rules"),
  createRule: (data: {
    name: string;
    keywords: string[];
    match_type?: string;
    response_template: string;
    priority?: number;
    channel_types?: string[];
  }) => api.post("/bot/rules", data),
  updateRule: (id: number, data: Partial<{
    name: string;
    keywords: string[];
    match_type: string;
    response_template: string;
    priority: number;
    channel_types: string[];
  }>) => api.put(`/bot/rules/${id}`, data),
  deleteRule: (id: number) => api.delete(`/bot/rules/${id}`),
  toggleRule: (id: number) => api.patch(`/bot/rules/${id}/toggle`),
  listLogs: () => api.get("/bot/logs"),
};

// Team
export const teamAPI = {
  listMembers: () => api.get("/team/members"),
  invite: (data: { email: string; full_name: string; role: string }) =>
    api.post("/team/invite", data),
  updateMember: (userId: number, role: string) =>
    api.patch(`/team/members/${userId}`, { role }),
  deleteMember: (userId: number) => api.delete(`/team/members/${userId}`),
  getOrganization: () => api.get("/organization"),
  updateOrganization: (data: { name?: string }) => api.patch("/organization", data),
};

// Canned responses
export const cannedAPI = {
  list: () => api.get("/canned-responses"),
  create: (data: { shortcut: string; title: string; content: string }) =>
    api.post("/canned-responses", data),
  update: (id: number, data: { shortcut?: string; title?: string; content?: string }) =>
    api.put(`/canned-responses/${id}`, data),
  delete: (id: number) => api.delete(`/canned-responses/${id}`),
};

// Tags
export const tagsAPI = {
  list: () => api.get("/tags"),
  create: (data: { name: string; color?: string }) => api.post("/tags", data),
  delete: (id: number) => api.delete(`/tags/${id}`),
};
