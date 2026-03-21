"use client";

import { useState } from "react";
import { teamAPI } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Building2, User, Bell, Key, CreditCard, Check, Copy } from "lucide-react";

const tabs = [
  { key: "profile", label: "Profil", icon: User },
  { key: "organization", label: "Organizasyon", icon: Building2 },
  { key: "notifications", label: "Bildirimler", icon: Bell },
  { key: "api", label: "API & Entegrasyonlar", icon: Key },
  { key: "billing", label: "Plan & Faturalandirma", icon: CreditCard },
];

export default function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [orgName, setOrgName] = useState(organization?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await teamAPI.updateOrganization({ name: orgName });
      setMessage("Kaydedildi");
    } catch {
      setMessage("Hata olustu");
    } finally {
      setSaving(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ayarlar</h1>

      <div className="flex gap-8">
        {/* Vertical Tabs */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}>
                <tab.icon className={`h-4 w-4 ${isActive ? "text-blue-600" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {activeTab === "profile" && (
            <div className="card p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Profil Bilgileri</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <span className="text-2xl font-bold text-white">{user?.full_name?.charAt(0) || "U"}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{user?.full_name}</h3>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-3 border-b border-gray-50">
                  <span className="text-gray-400">Ad Soyad</span>
                  <span className="text-gray-900 font-medium">{user?.full_name}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-50">
                  <span className="text-gray-400">E-posta</span>
                  <span className="text-gray-900 font-medium">{user?.email}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "organization" && (
            <div className="card p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Organizasyon Ayarlari</h2>
              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Organizasyon Adi</label>
                  <input value={orgName} onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div className="flex justify-between py-3 border-b border-gray-50 text-sm">
                  <span className="text-gray-400">Plan</span>
                  <span className="text-gray-900 font-medium capitalize">{organization?.plan || "free"}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-50 text-sm">
                  <span className="text-gray-400">Slug</span>
                  <span className="text-gray-600 font-mono text-xs bg-gray-50 px-2 py-1 rounded-lg">{organization?.slug}</span>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm btn-gradient disabled:opacity-50">
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                  {message && <span className="text-sm text-green-600 font-medium">{message}</span>}
                </div>
              </form>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="card p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Bildirim Tercihleri</h2>
              <div className="space-y-4">
                {[
                  { label: "Yeni konusma bildirimi", desc: "Yeni bir musteri mesaji geldiginde bildirim al", defaultOn: true },
                  { label: "Atama bildirimi", desc: "Size bir konusma atandiginda bildirim al", defaultOn: true },
                  { label: "E-posta ozeti", desc: "Gunluk aktivite ozeti e-posta ile gonder", defaultOn: false },
                  { label: "Bot eslesme bildirimi", desc: "Bot bir kuralla eslestiginde bildirim al", defaultOn: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${item.defaultOn ? "bg-blue-600" : "bg-gray-300"}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${item.defaultOn ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="card p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">API & Entegrasyonlar</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Slug</label>
                  <div className="flex items-center gap-2">
                    <input value={organization?.slug || ""} readOnly className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 font-mono" />
                    <button type="button" onClick={() => copyText(organization?.slug || "")}
                      className={`p-2.5 rounded-xl transition-all ${copied ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Webhook Base URL</label>
                  <input value="https://repliq-production-e4aa.up.railway.app/api/v1/webhooks" readOnly
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 font-mono text-xs" />
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium">API Dokumantasyonu</p>
                  <p className="text-xs text-blue-600 mt-1">REST API dokumantasyonu yakin zamanda eklenecektir.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "billing" && (
            <div className="space-y-4 animate-fade-in">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Mevcut Plan</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full capitalize">{organization?.plan || "free"}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "Starter", price: "$29", features: ["5 kanal", "3 takim uyesi", "1.000 konusma/ay", "E-posta destek"] },
                  { name: "Pro", price: "$79", features: ["Sinirsiz kanal", "10 takim uyesi", "10.000 konusma/ay", "AI Bot", "Oncelikli destek"], popular: true },
                  { name: "Enterprise", price: "Ozel", features: ["Her sey dahil", "Sinirsiz uye", "Sinirsiz konusma", "SLA garantisi", "Ozel entegrasyon"] },
                ].map((plan) => (
                  <div key={plan.name} className={`card p-5 ${plan.popular ? "ring-2 ring-blue-500 relative" : ""}`}>
                    {plan.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">Populer</span>
                    )}
                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{plan.price}<span className="text-sm text-gray-400 font-normal">/ay</span></p>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                          <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full mt-4 py-2 text-sm rounded-xl font-medium transition-all ${
                      plan.popular ? "btn-gradient" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {plan.popular ? "Yukselt" : "Sec"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
