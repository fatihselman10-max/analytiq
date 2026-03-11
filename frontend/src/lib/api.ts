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
    company?: string;
  }) => api.post("/auth/register", data),
};

// Dashboard
export const dashboardAPI = {
  getOverview: (startDate: string, endDate: string) =>
    api.get("/dashboard/overview", {
      params: { start_date: startDate, end_date: endDate },
    }),
};

// Orders
export const ordersAPI = {
  list: (params: {
    page?: number;
    per_page?: number;
    platform?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get("/orders", { params }),
  get: (id: number) => api.get(`/orders/${id}`),
};

// Integrations
export const integrationsAPI = {
  list: () => api.get("/integrations"),
  create: (data: {
    platform: string;
    platform_type: string;
    credentials: Record<string, string>;
  }) => api.post("/integrations", data),
  delete: (id: number) => api.delete(`/integrations/${id}`),
  sync: (id: number) => api.post(`/integrations/${id}/sync`),
};

// Analytics
export const analyticsAPI = {
  getAdPerformance: (params: {
    start_date: string;
    end_date: string;
    platform?: string;
  }) => api.get("/analytics/ads", { params }),
  getProfitAnalysis: (params: { start_date: string; end_date: string }) =>
    api.get("/analytics/profit", { params }),
};
