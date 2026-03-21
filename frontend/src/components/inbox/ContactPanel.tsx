"use client";

import { useState, useEffect } from "react";
import { Conversation, Tag } from "@/types";
import { OrgMember } from "@/types";
import { teamAPI, tagsAPI, conversationsAPI } from "@/lib/api";
import {
  Mail,
  MessageCircle,
  Instagram,
  Phone,
  Globe,
  User,
  ChevronDown,
  X,
  Plus,
  Tag as TagIcon,
} from "lucide-react";

interface ContactPanelProps {
  conversation: Conversation;
  onUpdate: (id: number, updates: Partial<Conversation>) => void;
}

const channelLabels: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: "E-posta", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  instagram: { label: "Instagram", icon: Instagram },
  phone: { label: "Telefon", icon: Phone },
  web: { label: "Web", icon: Globe },
};

const statusOptions = [
  { value: "open", label: "Açık", className: "bg-green-100 text-green-700" },
  { value: "pending", label: "Beklemede", className: "bg-yellow-100 text-yellow-700" },
  { value: "resolved", label: "Çözüldü", className: "bg-blue-100 text-blue-700" },
  { value: "closed", label: "Kapalı", className: "bg-gray-100 text-gray-600" },
];

const priorityOptions = [
  { value: "low", label: "Düşük", className: "bg-gray-100 text-gray-600" },
  { value: "normal", label: "Normal", className: "bg-blue-100 text-blue-700" },
  { value: "high", label: "Yüksek", className: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Acil", className: "bg-red-100 text-red-700" },
];

export default function ContactPanel({ conversation, onUpdate }: ContactPanelProps) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  useEffect(() => {
    teamAPI.listMembers().then((res) => setMembers(res.data?.members || [])).catch(() => {});
    tagsAPI.list().then((res) => setAllTags(res.data?.tags || [])).catch(() => {});
  }, []);

  const contact = conversation.contact;
  const channel = channelLabels[conversation.channel_type || "web"] || channelLabels.web;
  const ChannelIcon = channel.icon;

  const handleStatusChange = async (status: string) => {
    try {
      await conversationsAPI.update(conversation.id, { status });
      onUpdate(conversation.id, { status: status as Conversation["status"] });
    } catch {}
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      await conversationsAPI.update(conversation.id, { priority });
      onUpdate(conversation.id, { priority: priority as Conversation["priority"] });
    } catch {}
  };

  const handleAssign = async (userId: number | null) => {
    try {
      if (userId) {
        await conversationsAPI.assign(conversation.id, userId);
        const member = members.find((m) => m.user_id === userId);
        onUpdate(conversation.id, {
          assigned_to: userId,
          assigned_user: member
            ? { id: member.user_id, email: member.email, full_name: member.full_name, avatar_url: member.avatar_url }
            : undefined,
        });
      } else {
        await conversationsAPI.update(conversation.id, { assigned_to: undefined });
        onUpdate(conversation.id, { assigned_to: null, assigned_user: undefined });
      }
    } catch {}
  };

  const handleAddTag = async (tagId: number) => {
    try {
      await conversationsAPI.addTag(conversation.id, tagId);
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) {
        onUpdate(conversation.id, {
          tags: [...(conversation.tags || []), tag],
        });
      }
      setShowTagPicker(false);
    } catch {}
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await conversationsAPI.removeTag(conversation.id, tagId);
      onUpdate(conversation.id, {
        tags: (conversation.tags || []).filter((t) => t.id !== tagId),
      });
    } catch {}
  };

  const currentStatus = statusOptions.find((s) => s.value === conversation.status) || statusOptions[0];
  const currentPriority = priorityOptions.find((p) => p.value === conversation.priority) || priorityOptions[1];
  const availableTags = allTags.filter(
    (t) => !(conversation.tags || []).some((ct) => ct.id === t.id)
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Contact Info */}
      <div className="p-5 border-b border-gray-200 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-semibold text-primary-700">
            {contact?.name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          {contact?.name || "Bilinmeyen"}
        </h3>
        {contact?.email && (
          <p className="text-sm text-gray-500 mt-0.5">{contact.email}</p>
        )}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <ChannelIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">{channel.label}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-4">
        {/* Status */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Durum
          </label>
          <div className="relative">
            <select
              value={conversation.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`w-full appearance-none px-3 py-2 pr-8 text-sm font-medium rounded-lg border border-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 ${currentStatus.className}`}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Öncelik
          </label>
          <div className="relative">
            <select
              value={conversation.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className={`w-full appearance-none px-3 py-2 pr-8 text-sm font-medium rounded-lg border border-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 ${currentPriority.className}`}
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Assigned Agent */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Atanan Temsilci
          </label>
          <div className="relative">
            <select
              value={conversation.assigned_to || ""}
              onChange={(e) =>
                handleAssign(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full appearance-none px-3 py-2 pr-8 text-sm rounded-lg border border-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Atanmamış</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
            Etiketler
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(conversation.tags || []).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add tag */}
          <div className="relative">
            {showTagPicker ? (
              <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
                <div className="max-h-32 overflow-y-auto p-1">
                  {availableTags.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2 text-center">
                      Eklenebilecek etiket yok
                    </p>
                  ) : (
                    availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-50 text-left"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setShowTagPicker(false)}
                  className="w-full text-xs text-gray-400 py-1.5 border-t border-gray-100 hover:text-gray-600"
                >
                  Kapat
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTagPicker(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Etiket ekle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conversation details */}
      <div className="mt-auto p-4 border-t border-gray-200">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Detaylar
        </h4>
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-400">Oluşturulma</dt>
            <dd className="text-gray-600">
              {new Date(conversation.created_at).toLocaleDateString("tr-TR")}
            </dd>
          </div>
          {conversation.first_response_at && (
            <div className="flex justify-between">
              <dt className="text-gray-400">İlk Yanıt</dt>
              <dd className="text-gray-600">
                {new Date(conversation.first_response_at).toLocaleDateString("tr-TR")}
              </dd>
            </div>
          )}
          {conversation.resolved_at && (
            <div className="flex justify-between">
              <dt className="text-gray-400">Çözüm</dt>
              <dd className="text-gray-600">
                {new Date(conversation.resolved_at).toLocaleDateString("tr-TR")}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-400">Konuşma ID</dt>
            <dd className="text-gray-600">#{conversation.id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
