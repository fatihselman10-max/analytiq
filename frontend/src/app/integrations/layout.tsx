"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Sidebar from "@/components/layout/Sidebar";

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
    if (!localStorage.getItem("token")) router.push("/auth/login");
  }, [loadFromStorage, router]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
