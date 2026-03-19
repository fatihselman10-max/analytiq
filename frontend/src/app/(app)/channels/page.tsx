"use client";

import { useState, useEffect } from "react";
import { channelsAPI } from "@/lib/api";
import { Channel } from "@/types";
import { Plus, Trash2, Radio } from "lucide-react";

const CHANNEL_TYPES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
  { value: "facebook", label: "Facebook Messenger" },
  { value: "twitter", label: "Twitter/X" },
  { value: "vk", label: "VK" },
  { value: "email", label: "E-posta" },
  { value: "livechat", label: "LiveChat" },
];

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-700",
  instagram: "bg-pink-100 text-pink-700",
  telegram: "bg-blue-100 text-blue-700",
  facebook: "bg-indigo-100 text-indigo-700",
  twitter: "bg-sky-100 text-sky-700",
  vk: "bg-blue-100 text-blue-700",
  email: "bg-gray-100 text-gray-700",
  livechat: "bg-purple-100 text-purple-700",
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: "livechat", name: "" });

  const loadChannels = async () => {
    try {
      const { data } = await channelsAPI.list();
      setChannels(data.channels || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await channelsAPI.create({ type: form.type, name: form.name });
    setShowModal(false);
    setForm({ type: "livechat", name: "" });
    loadChannels();
  };

  const handleToggle = async (channel: Channel) => {
    await channelsAPI.update(channel.id, { is_active: !channel.is_active });
    loadChannels();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu kanali silmek istediginize emin misiniz?")) return;
    await channelsAPI.delete(id);
    loadChannels();
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
        <h1 className="text-2xl font-bold text-gray-900">Kanallar</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Kanal Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${CHANNEL_COLORS[channel.type] || "bg-gray-100"}`}>
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{channel.name}</h3>
                  <p className="text-xs text-gray-500 capitalize">{channel.type}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(channel.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  channel.is_active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {channel.is_active ? "Aktif" : "Pasif"}
              </span>
              <button
                onClick={() => handleToggle(channel)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  channel.is_active ? "bg-primary-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    channel.is_active ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
        {channels.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            Henuz kanal eklenmemis
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Yeni Kanal Ekle</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kanal Tipi</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {CHANNEL_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kanal Adi</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ornegin: Destek WhatsApp"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Iptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
