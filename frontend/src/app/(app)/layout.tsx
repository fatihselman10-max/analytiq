"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { useWebSocket } from "@/lib/websocket";
import Sidebar from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, isAuthenticated, loadFromStorage } = useAuthStore();

  const { loadFromStorage: loadTheme } = useThemeStore();

  useEffect(() => {
    loadFromStorage();
    loadTheme();
  }, [loadFromStorage, loadTheme]);

  useEffect(() => {
    if (!isAuthenticated && !localStorage.getItem("token")) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  useWebSocket(token);

  useEffect(() => {
    document.body.classList.add("app-shell");
    return () => document.body.classList.remove("app-shell");
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-[100dvh] lg:h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overscroll-contain pt-12 pb-16 lg:pt-0 lg:pb-0">{children}</main>
      </div>
    </ToastProvider>
  );
}
