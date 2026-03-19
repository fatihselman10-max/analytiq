"use client";

import { useState, useEffect } from "react";
import { teamAPI } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Building2, User } from "lucide-react";

export default function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [orgName, setOrgName] = useState(organization?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Ayarlar</h1>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Profil</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Ad Soyad</span>
            <span className="text-gray-900">{user?.full_name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">E-posta</span>
            <span className="text-gray-900">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Organization */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Organizasyon</h2>
        </div>
        <form onSubmit={handleSaveOrg} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organizasyon Adi
            </label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
            <span className="text-gray-500">Plan</span>
            <span className="text-gray-900 capitalize">{organization?.plan || "free"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
            <span className="text-gray-500">Slug</span>
            <span className="text-gray-900 font-mono text-xs">{organization?.slug}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            {message && (
              <span className="text-sm text-green-600">{message}</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
