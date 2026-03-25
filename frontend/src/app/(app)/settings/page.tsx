"use client";

import { useState, useEffect } from "react";
import { teamAPI, businessHoursAPI, slaAPI, csatAPI } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Building2, User, Bell, Key, CreditCard, Check, Copy, Clock, Loader2, ShieldCheck, Star } from "lucide-react";

const DAYS = [
  { key: "monday", label: "Pazartesi" },
  { key: "tuesday", label: "Salı" },
  { key: "wednesday", label: "Çarşamba" },
  { key: "thursday", label: "Perşembe" },
  { key: "friday", label: "Cuma" },
  { key: "saturday", label: "Cumartesi" },
  { key: "sunday", label: "Pazar" },
];

const defaultSchedule: Record<string, { enabled: boolean; start: string; end: string }> = {
  monday: { enabled: true, start: "09:00", end: "18:00" },
  tuesday: { enabled: true, start: "09:00", end: "18:00" },
  wednesday: { enabled: true, start: "09:00", end: "18:00" },
  thursday: { enabled: true, start: "09:00", end: "18:00" },
  friday: { enabled: true, start: "09:00", end: "18:00" },
  saturday: { enabled: false, start: "10:00", end: "14:00" },
  sunday: { enabled: false, start: "", end: "" },
};

const tabs = [
  { key: "profile", label: "Profil", icon: User },
  { key: "organization", label: "Organizasyon", icon: Building2 },
  { key: "business-hours", label: "İş Saatleri", icon: Clock },
  { key: "sla", label: "SLA Yönetimi", icon: ShieldCheck },
  { key: "csat", label: "CSAT Anketleri", icon: Star },
  { key: "notifications", label: "Bildirimler", icon: Bell },
  { key: "api", label: "API & Entegrasyonlar", icon: Key },
  { key: "billing", label: "Plan & Faturalandırma", icon: CreditCard },
];

export default function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [orgName, setOrgName] = useState(organization?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Business Hours state
  const [bhEnabled, setBhEnabled] = useState(false);
  const [bhTimezone, setBhTimezone] = useState("Europe/Istanbul");
  const [bhSchedule, setBhSchedule] = useState(defaultSchedule);
  const [bhAwayMessage, setBhAwayMessage] = useState("Şu anda mesai saatleri dışındayız. En kısa sürede size dönüş yapacağız.");
  const [bhWelcomeMessage, setBhWelcomeMessage] = useState("");
  const [bhLoading, setBhLoading] = useState(false);
  const [bhSaving, setBhSaving] = useState(false);
  const [bhMessage, setBhMessage] = useState("");

  // SLA state
  const [slaEnabled, setSlaEnabled] = useState(false);
  const [slaBhOnly, setSlaBhOnly] = useState(false);
  const [slaFR, setSlaFR] = useState({ urgent: 5, high: 15, normal: 60, low: 240 });
  const [slaRes, setSlaRes] = useState({ urgent: 60, high: 240, normal: 1440, low: 4320 });
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaSaving, setSlaSaving] = useState(false);
  const [slaMessage, setSlaMessage] = useState("");

  // CSAT state
  const [csatEnabled, setCsatEnabled] = useState(false);
  const [csatQuestion, setCsatQuestion] = useState("Destek deneyiminizi nasıl değerlendirirsiniz?");
  const [csatThankYou, setCsatThankYou] = useState("Geri bildiriminiz için teşekkür ederiz!");
  const [csatDelay, setCsatDelay] = useState(5);
  const [csatLoading, setCsatLoading] = useState(false);
  const [csatSaving, setCsatSaving] = useState(false);
  const [csatMessage, setCsatMessage] = useState("");
  const [csatStats, setCsatStats] = useState<{ avg_rating: number; total_count: number; satisfaction_rate: number; rating_distribution: number[] } | null>(null);
  const [csatResponses, setCsatResponses] = useState<{ id: number; rating: number; comment: string; contact_name: string; agent_name: string; created_at: string }[]>([]);

  useEffect(() => {
    if (activeTab === "business-hours") loadBusinessHours();
    if (activeTab === "sla") loadSLA();
    if (activeTab === "csat") loadCSAT();
  }, [activeTab]);

  const loadBusinessHours = async () => {
    setBhLoading(true);
    try {
      const { data } = await businessHoursAPI.get();
      const bh = data.business_hours;
      setBhEnabled(bh.is_enabled || false);
      setBhTimezone(bh.timezone || "Europe/Istanbul");
      setBhSchedule(bh.schedule || defaultSchedule);
      setBhAwayMessage(bh.away_message || "");
      setBhWelcomeMessage(bh.welcome_message || "");
    } catch {
      // Use defaults
    }
    setBhLoading(false);
  };

  const handleSaveBusinessHours = async () => {
    setBhSaving(true);
    setBhMessage("");
    try {
      await businessHoursAPI.save({
        is_enabled: bhEnabled,
        timezone: bhTimezone,
        schedule: bhSchedule,
        away_message: bhAwayMessage,
        welcome_message: bhWelcomeMessage,
      });
      setBhMessage("Kaydedildi!");
      setTimeout(() => setBhMessage(""), 3000);
    } catch {
      setBhMessage("Hata oluştu");
    }
    setBhSaving(false);
  };

  const updateDay = (day: string, field: string, value: string | boolean) => {
    setBhSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const loadSLA = async () => {
    setSlaLoading(true);
    try {
      const { data } = await slaAPI.getPolicy();
      const p = data.sla_policy;
      setSlaEnabled(p.is_enabled || false);
      setSlaBhOnly(p.business_hours_only || false);
      setSlaFR({ urgent: p.first_response_urgent, high: p.first_response_high, normal: p.first_response_normal, low: p.first_response_low });
      setSlaRes({ urgent: p.resolution_urgent, high: p.resolution_high, normal: p.resolution_normal, low: p.resolution_low });
    } catch { /* defaults */ }
    setSlaLoading(false);
  };

  const handleSaveSLA = async () => {
    setSlaSaving(true);
    setSlaMessage("");
    try {
      await slaAPI.savePolicy({
        is_enabled: slaEnabled,
        first_response_urgent: slaFR.urgent,
        first_response_high: slaFR.high,
        first_response_normal: slaFR.normal,
        first_response_low: slaFR.low,
        resolution_urgent: slaRes.urgent,
        resolution_high: slaRes.high,
        resolution_normal: slaRes.normal,
        resolution_low: slaRes.low,
        business_hours_only: slaBhOnly,
      });
      setSlaMessage("Kaydedildi!");
      setTimeout(() => setSlaMessage(""), 3000);
    } catch {
      setSlaMessage("Hata oluştu");
    }
    setSlaSaving(false);
  };

  const loadCSAT = async () => {
    setCsatLoading(true);
    try {
      const [configRes, responsesRes] = await Promise.all([
        csatAPI.getConfig(),
        csatAPI.getResponses("30d"),
      ]);
      const cfg = configRes.data.csat_config;
      setCsatEnabled(cfg.is_enabled || false);
      setCsatQuestion(cfg.question || "");
      setCsatThankYou(cfg.thank_you_message || "");
      setCsatDelay(cfg.send_delay_minutes || 5);
      setCsatStats({
        avg_rating: responsesRes.data.avg_rating,
        total_count: responsesRes.data.total_count,
        satisfaction_rate: responsesRes.data.satisfaction_rate,
        rating_distribution: responsesRes.data.rating_distribution,
      });
      setCsatResponses(responsesRes.data.responses || []);
    } catch { /* defaults */ }
    setCsatLoading(false);
  };

  const handleSaveCSAT = async () => {
    setCsatSaving(true);
    setCsatMessage("");
    try {
      await csatAPI.saveConfig({
        is_enabled: csatEnabled,
        question: csatQuestion,
        thank_you_message: csatThankYou,
        send_delay_minutes: csatDelay,
      });
      setCsatMessage("Kaydedildi!");
      setTimeout(() => setCsatMessage(""), 3000);
    } catch {
      setCsatMessage("Hata oluştu");
    }
    setCsatSaving(false);
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await teamAPI.updateOrganization({ name: orgName });
      setMessage("Kaydedildi");
    } catch {
      setMessage("Hata oluştu");
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
    <div className="p-4 sm:p-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Ayarlar</h1>

      {/* Mobile: horizontal scroll tabs */}
      <div className="flex lg:hidden gap-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                isActive ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "bg-gray-50 text-gray-500"
              }`}>
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-8">
        {/* Desktop: vertical tabs */}
        <div className="hidden lg:block w-56 flex-shrink-0 space-y-1">
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
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Organizasyon Ayarları</h2>
              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Organizasyon Adı</label>
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

          {activeTab === "business-hours" && (
            <div className="space-y-4 animate-fade-in">
              {bhLoading ? (
                <div className="card p-12 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* Toggle Card */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">İş Saatleri</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Mesai saatleri dışında gelen mesajlara otomatik yanıt gönderin
                        </p>
                      </div>
                      <button
                        onClick={() => setBhEnabled(!bhEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          bhEnabled ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                            bhEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className={`card p-6 transition-opacity ${bhEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Haftalık Program</h3>

                    <div className="mb-4">
                      <label className="block text-xs text-gray-500 mb-1">Saat Dilimi</label>
                      <select
                        value={bhTimezone}
                        onChange={(e) => setBhTimezone(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white w-full max-w-xs"
                      >
                        <option value="Europe/Istanbul">Türkiye (GMT+3)</option>
                        <option value="Europe/London">Londra (GMT+0)</option>
                        <option value="Europe/Berlin">Berlin (GMT+1)</option>
                        <option value="America/New_York">New York (GMT-5)</option>
                        <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
                        <option value="Asia/Dubai">Dubai (GMT+4)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      {DAYS.map((day) => {
                        const sch = bhSchedule[day.key] || { enabled: false, start: "09:00", end: "18:00" };
                        return (
                          <div
                            key={day.key}
                            className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
                              sch.enabled ? "bg-blue-50/50" : "bg-gray-50/50"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => updateDay(day.key, "enabled", !sch.enabled)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                                sch.enabled ? "bg-blue-600" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                                  sch.enabled ? "translate-x-4.5" : "translate-x-0.5"
                                }`}
                                style={{ transform: sch.enabled ? "translateX(17px)" : "translateX(2px)" }}
                              />
                            </button>
                            <span className={`text-sm font-medium w-24 ${sch.enabled ? "text-gray-900" : "text-gray-400"}`}>
                              {day.label}
                            </span>
                            {sch.enabled ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={sch.start}
                                  onChange={(e) => updateDay(day.key, "start", e.target.value)}
                                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                                />
                                <span className="text-gray-400 text-xs">-</span>
                                <input
                                  type="time"
                                  value={sch.end}
                                  onChange={(e) => updateDay(day.key, "end", e.target.value)}
                                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Kapalı</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className={`card p-6 transition-opacity ${bhEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Otomatik Mesajlar</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Mesai Dışı Mesajı
                        </label>
                        <textarea
                          value={bhAwayMessage}
                          onChange={(e) => setBhAwayMessage(e.target.value)}
                          rows={3}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none"
                          placeholder="Mesai saatleri dışında gelen mesajlara gönderilecek otomatik yanıt..."
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Bu mesaj, mesai saatleri dışında yeni konuşma başlatan müşterilere gönderilir.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Hoş Geldiniz Mesajı (Opsiyonel)
                        </label>
                        <textarea
                          value={bhWelcomeMessage}
                          onChange={(e) => setBhWelcomeMessage(e.target.value)}
                          rows={2}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none"
                          placeholder="Mesai saatlerinde yeni konuşma başlatan müşterilere gönderilecek karşılama mesajı..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveBusinessHours}
                      disabled={bhSaving}
                      className="px-6 py-2.5 text-sm btn-gradient disabled:opacity-50 flex items-center gap-2"
                    >
                      {bhSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {bhSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                    {bhMessage && (
                      <span className={`text-sm font-medium ${bhMessage.includes("Hata") ? "text-red-600" : "text-green-600"}`}>
                        {bhMessage}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "sla" && (
            <div className="space-y-4 animate-fade-in">
              {slaLoading ? (
                <div className="card p-12 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* Toggle */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">SLA Politikası</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Öncelik seviyesine göre yanıt ve çözüm süresi hedefleri belirleyin
                        </p>
                      </div>
                      <button
                        onClick={() => setSlaEnabled(!slaEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${slaEnabled ? "bg-blue-600" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${slaEnabled ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* First Response Targets */}
                  <div className={`card p-6 transition-opacity ${slaEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">İlk Yanıt Süresi Hedefleri</h3>
                    <p className="text-xs text-gray-400 mb-4">Müşterinin ilk mesajına kaç dakika içinde yanıt verilmeli?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "urgent" as const, label: "Acil", color: "red" },
                        { key: "high" as const, label: "Yüksek", color: "orange" },
                        { key: "normal" as const, label: "Normal", color: "blue" },
                        { key: "low" as const, label: "Düşük", color: "gray" },
                      ].map((p) => (
                        <div key={p.key} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                          <div className={`w-2 h-2 rounded-full bg-${p.color}-500 flex-shrink-0`}
                               style={{ backgroundColor: p.color === "red" ? "#ef4444" : p.color === "orange" ? "#f97316" : p.color === "blue" ? "#3b82f6" : "#6b7280" }} />
                          <span className="text-sm text-gray-700 w-16">{p.label}</span>
                          <input
                            type="number"
                            min={1}
                            value={slaFR[p.key]}
                            onChange={(e) => setSlaFR({ ...slaFR, [p.key]: parseInt(e.target.value) || 0 })}
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right bg-white"
                          />
                          <span className="text-xs text-gray-400 w-8">dk</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resolution Targets */}
                  <div className={`card p-6 transition-opacity ${slaEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Çözüm Süresi Hedefleri</h3>
                    <p className="text-xs text-gray-400 mb-4">Konuşma kaç dakika içinde çözülmeli?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "urgent" as const, label: "Acil", color: "red", hint: `${Math.round(slaRes.urgent / 60)} saat` },
                        { key: "high" as const, label: "Yüksek", color: "orange", hint: `${Math.round(slaRes.high / 60)} saat` },
                        { key: "normal" as const, label: "Normal", color: "blue", hint: `${Math.round(slaRes.normal / 60)} saat` },
                        { key: "low" as const, label: "Düşük", color: "gray", hint: `${Math.round(slaRes.low / 60)} saat` },
                      ].map((p) => (
                        <div key={p.key} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                               style={{ backgroundColor: p.color === "red" ? "#ef4444" : p.color === "orange" ? "#f97316" : p.color === "blue" ? "#3b82f6" : "#6b7280" }} />
                          <span className="text-sm text-gray-700 w-16">{p.label}</span>
                          <input
                            type="number"
                            min={1}
                            value={slaRes[p.key]}
                            onChange={(e) => setSlaRes({ ...slaRes, [p.key]: parseInt(e.target.value) || 0 })}
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right bg-white"
                          />
                          <span className="text-xs text-gray-400 w-14">dk ({p.hint})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Options */}
                  <div className={`card p-6 transition-opacity ${slaEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Sadece İş Saatlerinde Hesapla</p>
                        <p className="text-xs text-gray-400 mt-0.5">Mesai dışı süreler SLA hesabına dahil edilmez</p>
                      </div>
                      <button
                        onClick={() => setSlaBhOnly(!slaBhOnly)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${slaBhOnly ? "bg-blue-600" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${slaBhOnly ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Save */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveSLA}
                      disabled={slaSaving}
                      className="px-6 py-2.5 text-sm btn-gradient disabled:opacity-50 flex items-center gap-2"
                    >
                      {slaSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {slaSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                    {slaMessage && (
                      <span className={`text-sm font-medium ${slaMessage.includes("Hata") ? "text-red-600" : "text-green-600"}`}>
                        {slaMessage}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "csat" && (
            <div className="space-y-4 animate-fade-in">
              {csatLoading ? (
                <div className="card p-12 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* Toggle */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">CSAT Anketleri</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Konuşma çözüldüğünde müşteriye memnuniyet anketi gönderin
                        </p>
                      </div>
                      <button
                        onClick={() => setCsatEnabled(!csatEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${csatEnabled ? "bg-blue-600" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${csatEnabled ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Stats Dashboard */}
                  {csatStats && csatStats.total_count > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="card p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">{csatStats.avg_rating.toFixed(1)}</div>
                        <div className="flex items-center justify-center gap-0.5 mt-1">
                          {[1,2,3,4,5].map((s) => (
                            <Star key={s} className={`h-3 w-3 ${s <= Math.round(csatStats.avg_rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">Ort. Puan</p>
                      </div>
                      <div className="card p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">{csatStats.total_count}</div>
                        <p className="text-[11px] text-gray-400 mt-1">Toplam Yanıt</p>
                      </div>
                      <div className="card p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">%{csatStats.satisfaction_rate.toFixed(0)}</div>
                        <p className="text-[11px] text-gray-400 mt-1">Memnuniyet</p>
                      </div>
                    </div>
                  )}

                  {/* Rating Distribution */}
                  {csatStats && csatStats.total_count > 0 && (
                    <div className="card p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Puan Dağılımı (Son 30 Gün)</h3>
                      <div className="space-y-2">
                        {[5,4,3,2,1].map((r) => {
                          const count = csatStats.rating_distribution[r-1] || 0;
                          const pct = csatStats.total_count > 0 ? (count / csatStats.total_count * 100) : 0;
                          return (
                            <div key={r} className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5 w-14">
                                <span className="text-xs font-medium text-gray-600">{r}</span>
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              </div>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${r >= 4 ? "bg-green-500" : r === 3 ? "bg-yellow-500" : "bg-red-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Config */}
                  <div className={`card p-6 transition-opacity ${csatEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Anket Ayarları</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Anket Sorusu</label>
                        <input
                          type="text"
                          value={csatQuestion}
                          onChange={(e) => setCsatQuestion(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Teşekkür Mesajı</label>
                        <input
                          type="text"
                          value={csatThankYou}
                          onChange={(e) => setCsatThankYou(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Gönderim Gecikmesi (dk)</label>
                        <input
                          type="number"
                          min={0}
                          value={csatDelay}
                          onChange={(e) => setCsatDelay(parseInt(e.target.value) || 0)}
                          className="w-32 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Konuşma çözüldükten kaç dakika sonra anket gönderilsin (0 = hemen)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Responses */}
                  {csatResponses.length > 0 && (
                    <div className="card p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Son Yanıtlar</h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {csatResponses.slice(0, 10).map((r) => (
                          <div key={r.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                              {[1,2,3,4,5].map((s) => (
                                <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                              ))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-gray-900">{r.contact_name}</span>
                                <span className="text-gray-300">→</span>
                                <span className="text-gray-500">{r.agent_name}</span>
                              </div>
                              {r.comment && <p className="text-xs text-gray-500 mt-0.5">{r.comment}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveCSAT}
                      disabled={csatSaving}
                      className="px-6 py-2.5 text-sm btn-gradient disabled:opacity-50 flex items-center gap-2"
                    >
                      {csatSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {csatSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                    {csatMessage && (
                      <span className={`text-sm font-medium ${csatMessage.includes("Hata") ? "text-red-600" : "text-green-600"}`}>
                        {csatMessage}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="card p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Bildirim Tercihleri</h2>
              <div className="space-y-4">
                {[
                  { label: "Yeni konuşma bildirimi", desc: "Yeni bir müşteri mesajı geldiğinde bildirim al", defaultOn: true },
                  { label: "Atama bildirimi", desc: "Size bir konuşma atandığında bildirim al", defaultOn: true },
                  { label: "E-posta özeti", desc: "Günlük aktivite özeti e-posta ile gönder", defaultOn: false },
                  { label: "Bot eşleşme bildirimi", desc: "Bot bir kuralla eşleştiğinde bildirim al", defaultOn: false },
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
                  <p className="text-sm text-blue-800 font-medium">API Dokümantasyonu</p>
                  <p className="text-xs text-blue-600 mt-1">REST API dokümantasyonu yakın zamanda eklenecektir.</p>
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
                  { name: "Starter", price: "$29", features: ["5 kanal", "3 takım üyesi", "1.000 konuşma/ay", "E-posta destek"] },
                  { name: "Pro", price: "$79", features: ["Sınırsız kanal", "10 takım üyesi", "10.000 konuşma/ay", "AI Bot", "Öncelikli destek"], popular: true },
                  { name: "Enterprise", price: "Özel", features: ["Her şey dahil", "Sınırsız üye", "Sınırsız konuşma", "SLA garantisi", "Özel entegrasyon"] },
                ].map((plan) => (
                  <div key={plan.name} className={`card p-5 ${plan.popular ? "ring-2 ring-blue-500 relative" : ""}`}>
                    {plan.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">Popüler</span>
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
                      {plan.popular ? "Yükselt" : "Seç"}
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
