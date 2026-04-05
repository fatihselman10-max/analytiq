"use client";

import { useState, useEffect } from "react";
import { automationsAPI, teamAPI, tagsAPI, cannedAPI } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

import {
  Workflow,
  Plus,
  Trash2,
  Zap,
  Loader2,
  ChevronDown,
  X,
  MessageSquare,
  UserPlus,
  Tag,
  AlertTriangle,
  ArrowRight,
  Edit3,
  Send,
  Search,
  FileText,
} from "lucide-react";

const TRIGGERS = [
  { value: "new_conversation", label: "Yeni Konuşma Açıldığında" },
  { value: "message_received", label: "Mesaj Alındığında" },
  { value: "status_changed", label: "Durum Değiştiğinde" },
];

const CONDITION_FIELDS = [
  { value: "channel_type", label: "Kanal" },
  { value: "message_content", label: "Mesaj İçeriği" },
  { value: "priority", label: "Öncelik" },
];

const OPERATORS = [
  { value: "equals", label: "Eşittir" },
  { value: "not_equals", label: "Eşit Değil" },
  { value: "contains", label: "İçerir" },
];

const ACTION_TYPES = [
  { value: "assign_agent", label: "Ajana Ata", icon: UserPlus },
  { value: "set_priority", label: "Öncelik Belirle", icon: AlertTriangle },
  { value: "set_status", label: "Durum Değiştir", icon: Zap },
  { value: "add_tag", label: "Etiket Ekle", icon: Tag },
  { value: "send_message", label: "Mesaj Gönder", icon: MessageSquare },
];

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Action {
  type: string;
  value: string;
}

interface Automation {
  id: number;
  name: string;
  is_active: boolean;
  trigger_type: string;
  conditions: Condition[];
  actions: Action[];
  execution_count: number;
  last_executed_at: string | null;
}

interface CannedResponse {
  id: number;
  shortcut: string;
  title: string;
  content: string;
}

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<"automations" | "templates">("automations");

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("new_conversation");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([{ type: "assign_agent", value: "" }]);

  // Reference data
  const [agents, setAgents] = useState<{ id: number; full_name: string }[]>([]);
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);

  // Templates state
  const [templates, setTemplates] = useState<CannedResponse[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSearch, setTplSearch] = useState("");
  const [tplShowForm, setTplShowForm] = useState(false);
  const [tplEditingId, setTplEditingId] = useState<number | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplForm, setTplForm] = useState({ shortcut: "", title: "", content: "" });

  const { organization } = useAuthStore();

  useEffect(() => {
    if (!organization) return;
    if (activeTab === "automations") fetchAll();
    if (activeTab === "templates") fetchTemplates();
  }, [organization, activeTab]);

  const fetchTemplates = async () => {
    setTplLoading(true);
    try {
      const { data } = await cannedAPI.list();
      setTemplates(data.canned_responses || []);
    } catch { setTemplates([]); }
    setTplLoading(false);
  };

  const resetTplForm = () => {
    setTplForm({ shortcut: "", title: "", content: "" });
    setTplEditingId(null);
    setTplShowForm(false);
  };

  const handleSaveTpl = async () => {
    if (!tplForm.shortcut.trim() || !tplForm.title.trim() || !tplForm.content.trim()) return;
    setTplSaving(true);
    try {
      if (tplEditingId) {
        await cannedAPI.update(tplEditingId, tplForm);
      } else {
        await cannedAPI.create(tplForm);
      }
      await fetchTemplates();
      resetTplForm();
    } catch {}
    setTplSaving(false);
  };

  const handleDeleteTpl = async (id: number) => {
    try {
      await cannedAPI.delete(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {}
  };

  const TEMPLATE_CATEGORIES: Record<string, { label: string; color: string }> = {
    kargo: { label: "Kargo", color: "bg-blue-100 text-blue-700" },
    iade: { label: "Iade", color: "bg-red-100 text-red-700" },
    degisim: { label: "Degisim", color: "bg-orange-100 text-orange-700" },
    inf: { label: "Influencer", color: "bg-pink-100 text-pink-700" },
    siparis: { label: "Siparis", color: "bg-emerald-100 text-emerald-700" },
  };

  const getTplCategory = (shortcut: string) => {
    const prefix = shortcut.split("-")[0];
    return TEMPLATE_CATEGORIES[prefix] || { label: "Genel", color: "bg-gray-100 text-gray-600" };
  };

  const filteredTemplates = templates.filter(t =>
    !tplSearch || t.shortcut.includes(tplSearch.toLowerCase()) || t.title.toLowerCase().includes(tplSearch.toLowerCase()) || t.content.toLowerCase().includes(tplSearch.toLowerCase())
  );

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [autoRes, agentRes, tagRes] = await Promise.all([
        automationsAPI.list(),
        teamAPI.listMembers(),
        tagsAPI.list(),
      ]);
      setAutomations(autoRes.data.automations || []);
      setAgents((agentRes.data.members || []).map((m: any) => ({ id: m.user_id, full_name: m.full_name })));
      setTags(tagRes.data.tags || []);
    } catch {}
    setLoading(false);
  };

  const resetForm = () => {
    setName("");
    setTriggerType("new_conversation");
    setConditions([]);
    setActions([{ type: "assign_agent", value: "" }]);
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (a: Automation) => {
    setName(a.name);
    setTriggerType(a.trigger_type);
    setConditions(a.conditions || []);
    setActions(a.actions || []);
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = { name, trigger_type: triggerType, conditions, actions: actions.filter((a) => a.value) };
      if (editingId) {
        await automationsAPI.update(editingId, data);
      } else {
        await automationsAPI.create(data);
      }
      await fetchAll();
      resetForm();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await automationsAPI.delete(id);
      setAutomations(automations.filter((a) => a.id !== id));
    } catch {}
  };

  const handleToggle = async (id: number) => {
    try {
      await automationsAPI.toggle(id);
      setAutomations(automations.map((a) => (a.id === id ? { ...a, is_active: !a.is_active } : a)));
    } catch {}
  };

  const addCondition = () => setConditions([...conditions, { field: "channel_type", operator: "equals", value: "" }]);
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, updates: Partial<Condition>) => {
    const updated = [...conditions];
    updated[i] = { ...updated[i], ...updates };
    setConditions(updated);
  };

  const addAction = () => setActions([...actions, { type: "send_message", value: "" }]);
  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, updates: Partial<Action>) => {
    const updated = [...actions];
    updated[i] = { ...updated[i], ...updates };
    setActions(updated);
  };

  const getActionValueInput = (action: Action, idx: number) => {
    switch (action.type) {
      case "assign_agent":
        return (
          <select value={action.value} onChange={(e) => updateAction(idx, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Ajan Seçin</option>
            {agents.map((a) => <option key={a.id} value={String(a.id)}>{a.full_name}</option>)}
          </select>
        );
      case "set_priority":
        return (
          <select value={action.value} onChange={(e) => updateAction(idx, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Öncelik Seçin</option>
            <option value="urgent">Acil</option>
            <option value="high">Yüksek</option>
            <option value="normal">Normal</option>
            <option value="low">Düşük</option>
          </select>
        );
      case "set_status":
        return (
          <select value={action.value} onChange={(e) => updateAction(idx, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Durum Seçin</option>
            <option value="open">Açık</option>
            <option value="pending">Beklemede</option>
            <option value="resolved">Çözüldü</option>
            <option value="closed">Kapalı</option>
          </select>
        );
      case "add_tag":
        return (
          <select value={action.value} onChange={(e) => updateAction(idx, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Etiket Seçin</option>
            {tags.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
          </select>
        );
      case "send_message":
        return (
          <input type="text" value={action.value} onChange={(e) => updateAction(idx, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Gönderilecek mesaj..." />
        );
      default:
        return <input type="text" value={action.value} onChange={(e) => updateAction(idx, { value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Değer" />;
    }
  };

  return (
    <div className="p-4 sm:p-8 animate-fade-in">
      {/* Tab Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setActiveTab("automations")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "automations" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Workflow className="h-4 w-4" /> Otomasyonlar
          </button>
          <button onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "templates" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <FileText className="h-4 w-4" /> Sablonlar
            {templates.length > 0 && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{templates.length}</span>}
          </button>
        </div>
        {activeTab === "automations" ? (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm btn-gradient">
            <Plus className="h-4 w-4" /> Yeni Otomasyon
          </button>
        ) : (
          <button onClick={() => { resetTplForm(); setTplShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm btn-gradient">
            <Plus className="h-4 w-4" /> Yeni Sablon
          </button>
        )}
      </div>

      {/* ==================== SABLONLAR TAB ==================== */}
      {activeTab === "templates" && (
        <div>
          {/* Template Form */}
          {tplShowForm && (
            <div className="card p-5 mb-5 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">{tplEditingId ? "Sablonu Duzenle" : "Yeni Sablon"}</h3>
                <button onClick={resetTplForm} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Kisayol</label>
                  <div className="flex items-center">
                    <span className="px-2.5 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl text-sm text-gray-500">/</span>
                    <input value={tplForm.shortcut} onChange={e => setTplForm(p => ({ ...p, shortcut: e.target.value.replace(/\s/g, "").toLowerCase() }))}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-r-xl text-sm" placeholder="inf-isbirligi" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Kategori icin tire kullanin: kargo-takip, inf-urun, iade-bilgi</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Sablon Adi</label>
                  <input value={tplForm.title} onChange={e => setTplForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Influencer Is Birligi Teklifi" />
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Mesaj Icerigi</label>
                <textarea value={tplForm.content} onChange={e => setTplForm(p => ({ ...p, content: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" rows={4}
                  placeholder="Merhaba! LessandRomance olarak sizinle is birligi yapmak istiyoruz..." />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={resetTplForm} className="px-4 py-2 text-sm text-gray-500">Iptal</button>
                <button onClick={handleSaveTpl} disabled={tplSaving || !tplForm.shortcut || !tplForm.title || !tplForm.content}
                  className="flex items-center gap-2 px-5 py-2 text-sm btn-gradient disabled:opacity-50">
                  {tplSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {tplEditingId ? "Guncelle" : "Kaydet"}
                </button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={tplSearch} onChange={e => setTplSearch(e.target.value)} placeholder="Sablon ara..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" />
          </div>

          {/* Template List */}
          {tplLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">{tplSearch ? "Sonuc bulunamadi" : "Henuz sablon yok"}</p>
              <p className="text-sm text-gray-400 mt-1">Chat icinde &quot;Sablonlar&quot; butonundan hizlica erisebilirsiniz.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map(t => {
                const cat = getTplCategory(t.shortcut);
                return (
                  <div key={t.id} className="card p-4 hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                          <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">/{t.shortcut}</code>
                          <span className="text-sm font-medium text-gray-900">{t.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{t.content}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => { setTplEditingId(t.id); setTplForm({ shortcut: t.shortcut, title: t.title, content: t.content }); setTplShowForm(true); }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteTpl(t.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== OTOMASYONLAR TAB ==================== */}
      {activeTab === "automations" && (
      <div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Otomasyonu Düzenle" : "Yeni Otomasyon"}
              </h2>
              <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Otomasyon Adı</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm"
                  placeholder="Örn: Instagram mesajlarını Ayşe'ye ata" />
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tetikleyici</label>
                <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
                  {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Koşullar (opsiyonel)</label>
                  <button onClick={addCondition} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Koşul Ekle
                  </button>
                </div>
                {conditions.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">Koşul yok - otomasyon her tetiklemede çalışır.</p>
                )}
                <div className="space-y-2">
                  {conditions.map((cond, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl">
                      <select value={cond.field} onChange={(e) => updateCondition(i, { field: e.target.value })}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                        {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select value={cond.operator} onChange={(e) => updateCondition(i, { operator: e.target.value })}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                        {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {cond.field === "channel_type" ? (
                        <select value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                          <option value="">Seçin</option>
                          <option value="instagram">Instagram</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">E-posta</option>
                          <option value="telegram">Telegram</option>
                          <option value="facebook">Facebook</option>
                          <option value="livechat">LiveChat</option>
                        </select>
                      ) : cond.field === "priority" ? (
                        <select value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                          <option value="">Seçin</option>
                          <option value="urgent">Acil</option>
                          <option value="high">Yüksek</option>
                          <option value="normal">Normal</option>
                          <option value="low">Düşük</option>
                        </select>
                      ) : (
                        <input type="text" value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" placeholder="Değer" />
                      )}
                      <button onClick={() => removeCondition(i)} className="p-1 text-gray-400 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Eylemler</label>
                  <button onClick={addAction} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Eylem Ekle
                  </button>
                </div>
                <div className="space-y-2">
                  {actions.map((act, i) => (
                    <div key={i} className="flex items-center gap-2 bg-blue-50/50 p-2.5 rounded-xl">
                      <select value={act.type} onChange={(e) => updateAction(i, { type: e.target.value, value: "" })}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white w-36">
                        {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                      {getActionValueInput(act, i)}
                      {actions.length > 1 && (
                        <button onClick={() => removeAction(i)} className="p-1 text-gray-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                İptal
              </button>
              <button onClick={handleSave} disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm btn-gradient disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Güncelle" : "Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automation List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : automations.length === 0 ? (
        <div className="text-center py-20">
          <Workflow className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Henüz otomasyon yok</p>
          <p className="text-sm text-gray-400 mt-1">İlk otomasyonunuzu oluştürün ve iş akışlarınızı otomatikleştirin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <div key={a.id} className={`card p-5 transition-all ${a.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${a.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <span>{TRIGGERS.find((t) => t.value === a.trigger_type)?.label || a.trigger_type}</span>
                    {a.conditions && a.conditions.length > 0 && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{a.conditions.length} koşul</span>
                      </>
                    )}
                    <ArrowRight className="h-3 w-3 text-gray-300" />
                    <span>{a.actions?.length || 0} eylem</span>
                    {a.execution_count > 0 && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{a.execution_count}x çalıştı</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(a)}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleToggle(a.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${a.is_active ? "bg-blue-600" : "bg-gray-300"}`}
                  >
                    <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm"
                      style={{ transform: a.is_active ? "translateX(17px)" : "translateX(2px)" }} />
                  </button>
                  <button onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      )}
    </div>
  );
}
