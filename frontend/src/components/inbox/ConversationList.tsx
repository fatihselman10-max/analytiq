"use client";

import { useState } from "react";
import { Conversation } from "@/types";
import { conversationsAPI, teamAPI } from "@/lib/api";
import {
  Search,
  Mail,
  MessageCircle,
  Instagram,
  Phone,
  Globe,
  Circle,
  Layers,
  AlertTriangle,
  CheckSquare,
  Square,
  X,
  UserPlus,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { useEffect } from "react";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  channelFilter: string;
  onChannelFilter: (channel: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  slaStatuses?: Record<number, { response_breached: boolean; resolution_breached: boolean; response_elapsed: number; response_target: number }>;
  onRefresh?: () => void;
}

const statusTabs = [
  { key: "all", label: "Tümü" },
  { key: "open", label: "Açık" },
  { key: "pending", label: "Beklemede" },
  { key: "resolved", label: "Çözüldü" },
];

const channelTabs = [
  { key: "all", label: "Tümü", icon: Layers },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "email", label: "E-posta", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const channelIcon: Record<string, React.ElementType> = {
  email: Mail,
  whatsapp: MessageCircle,
  instagram: Instagram,
  phone: Phone,
  web: Globe,
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: "Acil", className: "bg-red-100 text-red-700" },
  high: { label: "Yüksek", className: "bg-orange-100 text-orange-700" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-700" },
  low: { label: "Düşük", className: "bg-gray-100 text-gray-600" },
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "şimdi";
  if (diffMins < 60) return `${diffMins}dk`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}sa`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}g`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  statusFilter,
  onStatusFilter,
  channelFilter,
  onChannelFilter,
  searchQuery,
  onSearchChange,
  slaStatuses = {},
  onRefresh,
}: ConversationListProps) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState<string | null>(null);
  const [agents, setAgents] = useState<{ user_id: number; full_name: string }[]>([]);

  useEffect(() => {
    if (bulkMode && agents.length === 0) {
      teamAPI.listMembers().then(({ data }) => setAgents(data.members || [])).catch(() => {});
    }
  }, [bulkMode]);

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === conversations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(conversations.map(c => c.id)));
    }
  };

  const exitBulk = () => {
    setBulkMode(false);
    setSelected(new Set());
    setShowBulkMenu(null);
  };

  const bulkAction = async (updates: { status?: string; priority?: string; assigned_to?: number }) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await conversationsAPI.bulkUpdate(Array.from(selected), updates);
      exitBulk();
      onRefresh?.();
    } catch {}
    setBulkLoading(false);
    setShowBulkMenu(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Bulk Action Bar */}
      {bulkMode && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-xs text-blue-600 font-medium hover:underline">
                {selected.size === conversations.length ? "Hiçbirini Seçme" : "Tümünü Seç"}
              </button>
              <span className="text-xs text-blue-500">{selected.size} seçili</span>
            </div>
            <button onClick={exitBulk} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Status actions */}
              <div className="relative">
                <button onClick={() => setShowBulkMenu(showBulkMenu === "status" ? null : "status")}
                  disabled={bulkLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                  <CheckCircle className="h-3 w-3" /> Durum <ChevronDown className="h-3 w-3" />
                </button>
                {showBulkMenu === "status" && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-10 py-1 w-32 animate-fade-in">
                    {[
                      { value: "open", label: "Açık", icon: Circle },
                      { value: "pending", label: "Beklemede", icon: Clock },
                      { value: "resolved", label: "Çözüldü", icon: CheckCircle },
                      { value: "closed", label: "Kapalı", icon: XCircle },
                    ].map(s => (
                      <button key={s.value} onClick={() => bulkAction({ status: s.value })}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <s.icon className="h-3 w-3" /> {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority actions */}
              <div className="relative">
                <button onClick={() => setShowBulkMenu(showBulkMenu === "priority" ? null : "priority")}
                  disabled={bulkLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                  <AlertTriangle className="h-3 w-3" /> Öncelik <ChevronDown className="h-3 w-3" />
                </button>
                {showBulkMenu === "priority" && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-10 py-1 w-28 animate-fade-in">
                    {[
                      { value: "urgent", label: "Acil" },
                      { value: "high", label: "Yüksek" },
                      { value: "normal", label: "Normal" },
                      { value: "low", label: "Düşük" },
                    ].map(p => (
                      <button key={p.value} onClick={() => bulkAction({ priority: p.value })}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign actions */}
              <div className="relative">
                <button onClick={() => setShowBulkMenu(showBulkMenu === "assign" ? null : "assign")}
                  disabled={bulkLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                  <UserPlus className="h-3 w-3" /> Ata <ChevronDown className="h-3 w-3" />
                </button>
                {showBulkMenu === "assign" && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-10 py-1 w-40 animate-fade-in">
                    {agents.map(a => (
                      <button key={a.user_id} onClick={() => bulkAction({ assigned_to: a.user_id })}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                        {a.full_name}
                      </button>
                    ))}
                    {agents.length === 0 && <p className="px-3 py-1.5 text-xs text-gray-400">Yükleniyor...</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Konuşmalarda ara..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
          </div>
          {!bulkMode && conversations.length > 0 && (
            <button onClick={() => setBulkMode(true)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
              title="Toplu İşlem">
              <CheckSquare className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Channel Filter */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 overflow-x-auto">
        {channelTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onChannelFilter(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                channelFilter === tab.key
                  ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Status Tabs */}
      <div className="flex border-b border-gray-200">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusFilter(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              statusFilter === tab.key
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageCircle className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Konuşma bulunamadı</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const ChannelIcon = channelIcon[conv.channel_type || "web"] || Globe;
            const priority = priorityConfig[conv.priority] || priorityConfig.normal;
            const isActive = conv.id === activeId;
            const sla = slaStatuses[conv.id];
            const slaBreached = sla && (sla.response_breached || sla.resolution_breached);
            const isSelected = selected.has(conv.id);

            return (
              <div
                key={conv.id}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 flex items-start gap-2 ${
                  isActive ? "bg-primary-50 border-l-2 border-l-primary-600" : ""
                } ${isSelected ? "bg-blue-50 dark:bg-blue-950/50" : ""}`}
              >
                {/* Checkbox */}
                {bulkMode && (
                  <button onClick={() => toggleSelect(conv.id)} className="mt-1.5 flex-shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-300" />
                    )}
                  </button>
                )}

                <button onClick={() => !bulkMode ? onSelect(conv.id) : toggleSelect(conv.id)}
                  className="flex-1 text-left flex items-start gap-3 min-w-0">
                  {/* Avatar */}
                  {conv.contact?.avatar_url ? (
                    <img
                      src={conv.contact.avatar_url}
                      alt={conv.contact.name || ""}
                      className="flex-shrink-0 w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {conv.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {conv.contact?.name || "Bilinmeyen"}
                        </span>
                        <ChannelIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate mb-1">
                      {conv.subject || "Konu yok"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {conv.last_message && (
                        <p className="text-xs text-gray-400 truncate flex-1">
                          {conv.last_message}
                        </p>
                      )}
                      {conv.priority !== "normal" && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${priority.className}`}>
                          {priority.label}
                        </span>
                      )}
                      {slaBreached && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0" title="SLA ihlali">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          SLA
                        </span>
                      )}
                      {conv.status === "open" && !slaBreached && (
                        <Circle className="h-2 w-2 fill-green-500 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
