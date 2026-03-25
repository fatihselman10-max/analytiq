"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Inbox, BarChart3, Bot, Radio, Users, UserCircle, Settings, LogOut, MessageSquare, Menu, X, Workflow, BookOpen, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useThemeStore } from "@/store/theme";

const navItems = [
  { href: "/inbox", label: "Gelen Kutusu", icon: Inbox },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/bot", label: "AI Bot", icon: Bot },
  { href: "/channels", label: "Kanallar", icon: Radio },
  { href: "/automations", label: "Otomasyonlar", icon: Workflow },
  { href: "/knowledge-base", label: "Bilgi Bankası", icon: BookOpen },
  { href: "/contacts", label: "Kişiler", icon: UserCircle },
  { href: "/team", label: "Ekip", icon: Users },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

const mobileNavItems = [
  { href: "/inbox", label: "Gelen Kutusu", icon: Inbox },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/bot", label: "Bot", icon: Bot },
  { href: "/channels", label: "Kanallar", icon: Radio },
  { href: "/contacts", label: "Kişiler", icon: UserCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, organization, logout } = useAuthStore();
  const { dark, toggle: toggleTheme } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 min-h-screen flex-col">
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
                  isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 text-blue-700 dark:text-blue-300 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
                }`}>
                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? "bg-blue-100 dark:bg-blue-900" : "bg-transparent group-hover:bg-gray-100 dark:group-hover:bg-slate-700"}`}>
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
              <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest font-semibold">{organization.name}</p>
            </div>
          )}
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 mb-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
            {dark ? <Sun className="h-4 w-4 text-yellow-500" /> : <Moon className="h-4 w-4" />}
            {dark ? "Açık Tema" : "Koyu Tema"}
          </button>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-800">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-semibold">{user?.full_name?.charAt(0) || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <Link href="/inbox" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Repliq</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Slide Menu */}
      {mobileMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="lg:hidden fixed top-12 right-0 z-50 w-64 bg-white border-l border-gray-200 shadow-xl h-[calc(100vh-3rem)] flex flex-col animate-fade-in">
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
                    }`}>
                    <item.icon className={`h-4 w-4 ${isActive ? "text-blue-600" : ""}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-gray-100">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">{user?.full_name?.charAt(0) || "U"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                </div>
                <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-2 py-1 safe-area-bottom">
        <div className="flex items-center justify-around">
          {mobileNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                  isActive ? "text-blue-600" : "text-gray-400"
                }`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
