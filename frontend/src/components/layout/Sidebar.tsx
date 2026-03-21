"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Inbox, BarChart3, Bot, Radio, Users, UserCircle, Settings, LogOut, MessageSquare } from "lucide-react";

const navItems = [
  { href: "/inbox", label: "Gelen Kutusu", icon: Inbox },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/bot", label: "AI Bot", icon: Bot },
  { href: "/channels", label: "Kanallar", icon: Radio },
  { href: "/contacts", label: "Kişiler", icon: UserCircle },
  { href: "/team", label: "Ekip", icon: Users },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, organization, logout } = useAuthStore();

  return (
    <aside className="w-64 bg-white border-r border-gray-100 min-h-screen flex flex-col">
      <div className="px-6 py-5">
        <Link href="/inbox" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/20">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Repliq</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 mt-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}>
              <div className={`p-1.5 rounded-lg transition-colors ${isActive ? "bg-blue-100" : "bg-transparent group-hover:bg-gray-100"}`}>
                <item.icon className={`h-4 w-4 ${isActive ? "text-blue-600" : ""}`} />
              </div>
              {item.label}
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 mt-auto">
        {organization && (
          <div className="px-3 py-1.5 mb-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{organization.name}</p>
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-semibold">{user?.full_name?.charAt(0) || "U"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={logout} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
