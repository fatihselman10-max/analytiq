import { create } from "zustand";

interface User {
  id: number;
  email: string;
  full_name: string;
}

interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  role: string | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User, organization: Organization, role: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  role: null,
  token: null,
  isAuthenticated: false,
  login: (token, user, organization, role) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("organization", JSON.stringify(organization));
    localStorage.setItem("role", role);
    set({ token, user, organization, role, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("organization");
    localStorage.removeItem("role");
    set({ token: null, user: null, organization: null, role: null, isAuthenticated: false });
  },
  loadFromStorage: () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    const orgStr = localStorage.getItem("organization");
    const role = localStorage.getItem("role");
    if (token && userStr && orgStr) {
      try {
        const user = JSON.parse(userStr);
        const organization = JSON.parse(orgStr);
        set({ token, user, organization, role, isAuthenticated: true });
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("organization");
        localStorage.removeItem("role");
      }
    }
  },
}));
