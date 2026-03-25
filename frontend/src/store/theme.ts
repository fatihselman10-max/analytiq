import { create } from "zustand";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
  loadFromStorage: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  dark: false,
  toggle: () => {
    set((state) => {
      const next = !state.dark;
      localStorage.setItem("theme", next ? "dark" : "light");
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { dark: next };
    });
  },
  loadFromStorage: () => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved === "dark" || (!saved && prefersDark);
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ dark });
  },
}));
