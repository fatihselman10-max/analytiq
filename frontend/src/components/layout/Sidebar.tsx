"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import {
  Inbox,
  BarChart3,
  Bot,
  Radio,
  Users,
  UserCircle,
  Settings,
  LogOut,
  MessageSquare,
  Tag,
} from "lucide-react";

const navItems = [
  { href: "/inbox", label: "Gelen Kutusu", icon: Inbox },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/bot", label: "AI Bot", icon: Bot },
  { href: "/channels", label: "Kanallar", icon: Radio },
  { href: "/contacts", label: "Kisiler", icon: UserCircle },
  { href: "/team", label: "Ekip", icon: Users },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, organization, logout } = useAuthStore();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <Link href="/inbox" className="flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-primary-600" />
          <span className="text-xl font-bold text-gray-900">Repliq</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        {organization && (
          <div className="px-3 py-1 mb-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{organization.name}</p>
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 text-sm font-medium">
              {user?.full_name?.charAt(0) || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.full_name}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
