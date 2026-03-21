"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MessageSquare, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authAPI.login(email, password);
      login(data.token, data.user, data.organization, data.role);
      router.push("/inbox");
    } catch {
      setError("Gecersiz e-posta veya sifre");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 auth-gradient relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>
        <div className="relative text-white max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-white" />
            </div>
            <span className="text-3xl font-bold">Repliq</span>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Tum destek kanallarinizi tek panelden yonetin
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            WhatsApp, Instagram, Telegram, E-posta ve daha fazlasi. Musterilerinize her kanaldan aninda yanit verin.
          </p>
          <div className="mt-10 flex gap-4">
            {["WhatsApp", "Instagram", "Telegram", "E-posta"].map((ch) => (
              <div key={ch} className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm text-blue-100">
                {ch}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 mesh-bg">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Repliq
              </span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Tekrar Hos Geldiniz</h1>
            <p className="mt-2 text-gray-500">Hesabiniza giris yapin</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm border border-red-100 animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm transition-all"
                  placeholder="ornek@sirket.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sifre</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 btn-gradient disabled:opacity-50 text-sm"
            >
              {loading ? "Giris yapiliyor..." : "Giris Yap"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Hesabiniz yok mu?{" "}
              <a href="/auth/register" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                Kayit Ol
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
