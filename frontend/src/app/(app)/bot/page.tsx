"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { botAPI, aiBotAPI } from "@/lib/api";
import { BotRule } from "@/types";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg, DEMO_BOT_CONFIG, DEMO_BOT_RULES, DEMO_AI_LOGS } from "@/lib/demo-data";
import {
  Plus, Pencil, Trash2, Activity, Bot, Sparkles, Zap,
  MessageSquare, Settings, ToggleLeft, ToggleRight, ChevronRight,
  Coins, Send, Clock,
} from "lucide-react";

type AIConfig = {
  is_enabled: boolean;
  brand_name: string;
  brand_description: string;
  brand_tone: string;
  products_services: string;
  faq: string;
  policies: string;
  greeting_message: string;
  fallback_message: string;
  custom_instructions: string;
  token_balance: number;
  tokens_used: number;
};

type UsageData = {
  token_balance: number;
  tokens_used: number;
  total_responses: number;
  logs: { conversation_id: number; customer_message: string; ai_response: string; tokens_used: number; created_at: string }[];
};

const TONES = [
  { value: "professional", label: "Profesyonel", desc: "Resmi ve kurumsal" },
  { value: "friendly", label: "Samimi", desc: "Sıcak ve dostane" },
  { value: "casual", label: "Rahat", desc: "Günlük konuşma dili" },
  { value: "formal", label: "Resmi", desc: "Çok resmi ve ciddi" },
];

export default function BotPage() {
  const [activeTab, setActiveTab] = useState<"ai" | "keywords">("ai");
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [rules, setRules] = useState<BotRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<BotRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ name: "", keywords: "", match_type: "contains", response_template: "", priority: 0 });

  // Form state for AI config
  const [form, setForm] = useState({
    brand_name: "", brand_description: "", brand_tone: "professional",
    products_services: "", faq: "", policies: "",
    greeting_message: "", fallback_message: "", custom_instructions: "",
  });

  const { organization } = useAuthStore();
  const isDemo = isDemoOrg(organization?.name);

  useEffect(() => {
    if (!organization) return;
    loadAll();
  }, [isDemo, organization]);

  const loadAll = async () => {
    setLoading(true);
    if (isDemo) {
      const dc = DEMO_BOT_CONFIG;
      const cfg = {
        is_enabled: dc.is_enabled,
        brand_name: dc.brand_name,
        brand_description: dc.brand_description,
        brand_tone: dc.tone,
        products_services: dc.products_services,
        faq: dc.faq,
        policies: dc.policies,
        greeting_message: dc.greeting_message,
        fallback_message: dc.fallback_message,
        custom_instructions: dc.custom_instructions,
        token_balance: dc.token_balance,
        tokens_used: dc.tokens_used,
      } as AIConfig;
      setAIConfig(cfg);
      setUsage({ token_balance: dc.token_balance, tokens_used: dc.tokens_used, total_responses: dc.total_responses, logs: DEMO_AI_LOGS as any });
      setRules(DEMO_BOT_RULES as any);
      setForm({
        brand_name: dc.brand_name,
        brand_description: dc.brand_description,
        brand_tone: dc.tone,
        products_services: dc.products_services,
        faq: dc.faq,
        policies: dc.policies,
        greeting_message: dc.greeting_message,
        fallback_message: dc.fallback_message,
        custom_instructions: dc.custom_instructions,
      });
      setLoading(false);
      return;
    }
    try {
      const [configRes, usageRes, rulesRes] = await Promise.all([
        aiBotAPI.getConfig(),
        aiBotAPI.getUsage(),
        botAPI.listRules(),
      ]);
      const cfg = configRes.data;
      setAIConfig(cfg);
      setUsage(usageRes.data);
      setRules(rulesRes.data?.rules || []);
      setForm({
        brand_name: cfg.brand_name || "",
        brand_description: cfg.brand_description || "",
        brand_tone: cfg.brand_tone || "professional",
        products_services: cfg.products_services || "",
        faq: cfg.faq || "",
        policies: cfg.policies || "",
        greeting_message: cfg.greeting_message || "",
        fallback_message: cfg.fallback_message || "",
        custom_instructions: cfg.custom_instructions || "",
      });
      if (!cfg.brand_name) setShowSetup(true);
    } catch {}
    setLoading(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await aiBotAPI.saveConfig(form);
      await loadAll();
      setShowSetup(false);
    } catch {}
    setSaving(false);
  };

  const handleToggle = async () => {
    try {
      const res = await aiBotAPI.toggle();
      setAIConfig((prev) => prev ? { ...prev, is_enabled: res.data.is_enabled } : prev);
    } catch (err: any) {
      alert(err.response?.data?.error || "Hata oluştu");
    }
  };

  // Keyword bot functions
  const handleSaveRule = async () => {
    const data = {
      name: ruleForm.name,
      keywords: ruleForm.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      match_type: ruleForm.match_type,
      response_template: ruleForm.response_template,
      priority: ruleForm.priority,
    };
    if (editingRule) {
      await botAPI.updateRule(editingRule.id, data);
    } else {
      await botAPI.createRule(data);
    }
    setShowRuleModal(false);
    setEditingRule(null);
    const { data: d } = await botAPI.listRules();
    setRules(d?.rules || []);
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm("Bu kuralı silmek istediğinize emin misiniz?")) return;
    await botAPI.deleteRule(id);
    const { data: d } = await botAPI.listRules();
    setRules(d?.rules || []);
  };

  const handleToggleRule = async (id: number) => {
    await botAPI.toggleRule(id);
    const { data: d } = await botAPI.listRules();
    setRules(d?.rules || []);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">AI Bot</h1>
          <p className="text-sm text-gray-500 mt-1">Yapay zeka destekli müşteri asistanınız</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "ai" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}>
              <Sparkles className="h-4 w-4" /> AI Asistan
            </button>
            <button onClick={() => setActiveTab("keywords")}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "keywords" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}>
              <Zap className="h-4 w-4" /> Anahtar Kelime
            </button>
          </div>
        </div>
      </div>

      {activeTab === "ai" && (
        <>
          {/* Status Card */}
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  aiConfig?.is_enabled ? "bg-green-50" : "bg-gray-100"
                }`}>
                  <Bot className={`h-6 w-6 ${aiConfig?.is_enabled ? "text-green-600" : "text-gray-400"}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {aiConfig?.brand_name ? `${aiConfig.brand_name} AI Asistanı` : "AI Asistan"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {aiConfig?.is_enabled ? "Aktif - müşteri mesajlarına otomatik yanıt veriyor" : "Pasif - etkinleştirmek için aşağıdan yapılandırın"}
                  </p>
                </div>
              </div>
              <button onClick={handleToggle} disabled={!aiConfig?.brand_name}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
                {aiConfig?.is_enabled ? (
                  <ToggleRight className="h-8 w-8 text-green-600" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Token Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50">
                  <Coins className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Kalan Token</p>
                  <p className="text-xl font-bold text-gray-900">{(usage?.token_balance || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-50">
                  <Send className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Yanıt</p>
                  <p className="text-xl font-bold text-gray-900">{usage?.total_responses || 0}</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Harcanan Token</p>
                  <p className="text-xl font-bold text-gray-900">{(usage?.tokens_used || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Setup / Config */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Marka Yapılandırması</h3>
              </div>
              <button onClick={() => setShowSetup(!showSetup)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                {showSetup ? "Kapat" : "Düzenle"} <ChevronRight className={`h-4 w-4 transition-transform ${showSetup ? "rotate-90" : ""}`} />
              </button>
            </div>

            {!showSetup && aiConfig?.brand_name ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Marka:</span> <span className="font-medium text-gray-900 ml-1">{aiConfig.brand_name}</span></div>
                <div><span className="text-gray-500">Üslup:</span> <span className="font-medium text-gray-900 ml-1">{TONES.find(t => t.value === aiConfig.brand_tone)?.label}</span></div>
                <div className="md:col-span-2"><span className="text-gray-500">Açıklama:</span> <span className="text-gray-700 ml-1">{aiConfig.brand_description?.slice(0, 150)}...</span></div>
              </div>
            ) : showSetup ? (
              <div className="space-y-5">
                {/* Brand Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marka Adı *</label>
                  <input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                    placeholder="ör: Less and Romance" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                {/* Brand Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marka Tanımı *</label>
                  <textarea value={form.brand_description} onChange={(e) => setForm({ ...form, brand_description: e.target.value })}
                    placeholder="Markanız ne yapıyor? Hangi sektörde? Hedef kitleniz kim?" rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">İletişim Üslubu</label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {TONES.map((tone) => (
                      <button key={tone.value} onClick={() => setForm({ ...form, brand_tone: tone.value })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          form.brand_tone === tone.value ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-gray-200 hover:bg-gray-50"
                        }`}>
                        <p className="text-sm font-medium text-gray-900">{tone.label}</p>
                        <p className="text-xs text-gray-500">{tone.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Products */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ürün ve Hizmetler</label>
                  <textarea value={form.products_services} onChange={(e) => setForm({ ...form, products_services: e.target.value })}
                    placeholder="Sattığınız ürünler, fiyat aralıkları, kategoriler..." rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                {/* FAQ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sık Sorulan Sorular</label>
                  <textarea value={form.faq} onChange={(e) => setForm({ ...form, faq: e.target.value })}
                    placeholder="S: Kargo ne zaman gelir?&#10;C: Siparişiniz 2-3 iş günü içinde kargoya verilir.&#10;&#10;S: İade nasıl yapılır?&#10;C: 14 gün içinde iade edebilirsiniz." rows={5}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                {/* Policies */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Politikalar (İade, Kargo, vb.)</label>
                  <textarea value={form.policies} onChange={(e) => setForm({ ...form, policies: e.target.value })}
                    placeholder="İade politikası, kargo süreleri, ödeme yöntemleri..." rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                {/* Custom Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ek Talimatlar</label>
                  <textarea value={form.custom_instructions} onChange={(e) => setForm({ ...form, custom_instructions: e.target.value })}
                    placeholder="AI bot'a özel talimatlar... ör: Müşterilere her zaman 'efendim' diye hitap et" rows={2}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                {/* Fallback */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token bittiğinde mesaj</label>
                  <input value={form.fallback_message} onChange={(e) => setForm({ ...form, fallback_message: e.target.value })}
                    placeholder="ör: Şu an AI asistanımız kullanılamıyor, en kısa sürede bir temsilcimiz size dönecektir."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                <button onClick={handleSaveConfig} disabled={saving || !form.brand_name}
                  className="btn-gradient px-6 py-2.5 disabled:opacity-50">
                  {saving ? "Kaydediliyor..." : "Kaydet ve Yapılandır"}
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Henüz yapılandırma yok</p>
                <button onClick={() => setShowSetup(true)} className="btn-gradient px-5 py-2 mt-3 text-sm">
                  AI Bot&apos;u Yapılandır
                </button>
              </div>
            )}
          </div>

          {/* Recent AI Logs */}
          {(usage?.logs || []).length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Son AI Yanıtları</h3>
              </div>
              <div className="space-y-3">
                {usage!.logs.map((log, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Müşteri:</span> {log.customer_message}</p>
                        <p className="text-sm text-blue-700 mt-1"><span className="font-medium">AI:</span> {log.ai_response}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{log.tokens_used} token</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "keywords" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Belirli kelimeler eşleştiğinde hazır yanıt gönderir (token harcamaz)</p>
            <div className="flex gap-2">
              <Link href="/bot/logs" className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Loglar
              </Link>
              <button onClick={() => { setEditingRule(null); setRuleForm({ name: "", keywords: "", match_type: "contains", response_template: "", priority: 0 }); setShowRuleModal(true); }}
                className="btn-gradient px-4 py-2 text-sm flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Yeni Kural
              </button>
            </div>
          </div>

          {rules.length === 0 ? (
            <div className="card p-12 text-center">
              <Zap className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Henüz kural eklenmemiş</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="card p-4">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleToggleRule(rule.id)}
                      className={`w-10 h-6 rounded-full transition-colors ${rule.is_active ? "bg-green-500" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${rule.is_active ? "translate-x-4" : ""}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{rule.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{rule.match_type}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">Kelimeler: {rule.keywords.join(", ")}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingRule(rule); setRuleForm({ name: rule.name, keywords: rule.keywords.join(", "), match_type: rule.match_type, response_template: rule.response_template, priority: rule.priority }); setShowRuleModal(true); }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rule Modal */}
          {showRuleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold">{editingRule ? "Kuralı Düzenle" : "Yeni Kural"}</h3>
                <input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="Kural adı" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                <input value={ruleForm.keywords} onChange={(e) => setRuleForm({ ...ruleForm, keywords: e.target.value })}
                  placeholder="Anahtar kelimeler (virgülle ayırın)" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                <select value={ruleForm.match_type} onChange={(e) => setRuleForm({ ...ruleForm, match_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm">
                  <option value="contains">İçerir</option>
                  <option value="exact">Tam eşleşme</option>
                  <option value="regex">Regex</option>
                </select>
                <textarea value={ruleForm.response_template} onChange={(e) => setRuleForm({ ...ruleForm, response_template: e.target.value })}
                  placeholder="Yanıt şablonu... {{contact_name}} ve {{keyword}} kullanılabilir" rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">İptal</button>
                  <button onClick={handleSaveRule} className="btn-gradient px-5 py-2 text-sm">Kaydet</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
