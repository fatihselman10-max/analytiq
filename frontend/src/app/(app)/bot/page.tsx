"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { botAPI } from "@/lib/api";
import { BotRule } from "@/types";
import { Plus, Pencil, Trash2, Activity } from "lucide-react";

export default function BotPage() {
  const [rules, setRules] = useState<BotRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<BotRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    keywords: "",
    match_type: "contains",
    response_template: "",
    priority: 0,
    channel_types: [] as string[],
  });

  const loadRules = async () => {
    try {
      const { data } = await botAPI.listRules();
      setRules(data?.rules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggle = async (id: number) => {
    await botAPI.toggleRule(id);
    loadRules();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu kuralı silmek istediğinize emin misiniz?")) return;
    await botAPI.deleteRule(id);
    loadRules();
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm({ name: "", keywords: "", match_type: "contains", response_template: "", priority: 0, channel_types: [] });
    setShowModal(true);
  };

  const openEdit = (rule: BotRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      keywords: rule.keywords.join(", "),
      match_type: rule.match_type,
      response_template: rule.response_template,
      priority: rule.priority,
      channel_types: rule.channel_types || [],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      match_type: form.match_type,
      response_template: form.response_template,
      priority: form.priority,
      channel_types: form.channel_types,
    };

    if (editingRule) {
      await botAPI.updateRule(editingRule.id, payload);
    } else {
      await botAPI.createRule(payload);
    }
    setShowModal(false);
    loadRules();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">AI Bot Kuralları</h1>
        <div className="flex gap-3">
          <Link
            href="/bot/logs"
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Activity className="h-4 w-4" />
            Log Kayıtları
          </Link>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Kural
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {rules.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            Henüz bot kuralı eklenmemiş
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <button
                  onClick={() => handleToggle(rule.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    rule.is_active ? "bg-primary-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      rule.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{rule.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      Öncelik: {rule.priority}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {rule.match_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Anahtar kelimeler: {rule.keywords.join(", ")}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5 truncate">
                    Yanit: {rule.response_template}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(rule)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">
              {editingRule ? "Kural Düzenle" : "Yeni Kural"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kural Adı</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anahtar Kelimeler (virgül ile ayırın)
                </label>
                <input
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="merhaba, yardim, fiyat"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Eşleşme Tipi</label>
                <select
                  value={form.match_type}
                  onChange={(e) => setForm({ ...form, match_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="contains">İçerir</option>
                  <option value="exact">Tam Eşleşme</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yanıt Şablonu</label>
                <textarea
                  value={form.response_template}
                  onChange={(e) => setForm({ ...form, response_template: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Degiskenler: {"{{contact_name}}"}, {"{{keyword}}"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingRule ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
