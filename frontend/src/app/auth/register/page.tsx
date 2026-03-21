"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MessageSquare, Mail, Lock, User, Building2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "", full_name: "", organization_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authAPI.register(form);
      login(data.token, data.user, data.organization, data.role);
      router.push("/inbox");
    } catch {
      setError("Kayıt oluşturulamadı. E-posta zaten kayıtlı olabilir.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
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
          <h2 className="text-4xl font-bold leading-tight mb-4">Müşteri desteğinizi bir üst seviyeye taşıyın</h2>
          <p className="text-blue-100 text-lg leading-relaxed">Ücretsiz başlayın, büyüdükçe ölçeklendirin. Tüm kanallarınızı tek bir yerden yönetin.</p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {["Sınırsız konuşma", "AI destekli bot", "Çoklu kanal", "Takım yönetimi"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-blue-100">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />{f}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 mesh-bg">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Repliq</span>
            </div>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Hesap Oluşturun</h1>
            <p className="mt-2 text-gray-500">Ücretsiz başlayın, kredi kartı gerekmez</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm border border-red-100 animate-fade-in">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Soyad</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm transition-all" placeholder="Adınız Soyadınız" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şirket / Organizasyon Adı</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" required value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm transition-all" placeholder="Şirketinizin adı" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm transition-all" placeholder="ornek@sirket.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm transition-all" placeholder="En az 8 karakter" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 px-4 btn-gradient disabled:opacity-50 text-sm">
              {loading ? "Kayıt olunuyor..." : "Ücretsiz Başlat"}
            </button>
            <p className="text-center text-sm text-gray-500">
              Zaten hesabınız var mı?{" "}
              <a href="/auth/login" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">Giriş Yap</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
