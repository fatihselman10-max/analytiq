"use client";

import { useState } from "react";
import { Conversation } from "@/types";
import { conversationsAPI } from "@/lib/api";
import {
  Mail, MessageCircle, Instagram, Phone, Globe,
  ChevronDown, ChevronRight, CheckCircle, Circle,
  Clock, AlertTriangle, Search, Layers,
} from "lucide-react";

interface MessageTableViewProps {
  conversations: Conversation[];
  onSelect: (id: number) => void;
  onUpdate: (id: number, updates: Partial<Conversation>) => void;
  slaStatuses?: Record<number, { response_breached: boolean; resolution_breached: boolean }>;
}

const statusFilterOptions = [
  { key: "all", label: "Tümü" },
  { key: "open", label: "Açık" },
  { key: "pending", label: "Beklemede" },
  { key: "resolved", label: "Çözüldü" },
];

const channelFilterOptions = [
  { key: "all", label: "Tümü", icon: Layers },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "email", label: "E-posta", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const channelIcon: Record<string, React.ElementType> = {
  email: Mail, whatsapp: MessageCircle, instagram: Instagram, phone: Phone, web: Globe,
};

const statusLabels: Record<string, string> = {
  open: "Açık", pending: "Beklemede", resolved: "Çözüldü", closed: "Kapalı",
};

const statusColors: Record<string, string> = {
  open: "text-green-600", pending: "text-amber-600", resolved: "text-blue-600", closed: "text-gray-500",
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Bugün ${time}`;
  if (isYesterday) return `Dün ${time}`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) + " " + time;
}

export default function MessageTableView({ conversations, onSelect, onUpdate, slaStatuses = {} }: MessageTableViewProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"time" | "status" | "channel">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  // Filter
  const filtered = conversations.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (channelFilter !== "all" && c.channel_type !== channelFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(c.contact?.name?.toLowerCase().includes(q) || c.last_message?.toLowerCase().includes(q) || c.contact?.email?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "time":
        cmp = new Date(a.last_message_at || a.created_at).getTime() - new Date(b.last_message_at || b.created_at).getTime();
        break;
      case "status":
        cmp = (a.status || "").localeCompare(b.status || "");
        break;
      case "channel":
        cmp = (a.channel_type || "").localeCompare(b.channel_type || "");
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleResolved = async (conv: Conversation) => {
    const newStatus = conv.status === "resolved" ? "open" : "resolved";
    try {
      await conversationsAPI.update(conv.id, { status: newStatus });
      onUpdate(conv.id, { status: newStatus as Conversation["status"] });
    } catch {}
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return null;
    return <span className="ml-0.5 text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-slate-700 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-1">
          {statusFilterOptions.map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all ${statusFilter === s.key ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-gray-500 hover:bg-gray-100"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {channelFilterOptions.map(ch => {
            const Icon = ch.icon;
            return (
              <button key={ch.key} onClick={() => setChannelFilter(ch.key)}
                className={`flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg transition-all ${channelFilter === ch.key ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-gray-500 hover:bg-gray-100"}`}>
                <Icon className="h-3 w-3" /> {ch.label}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-gray-400 ml-auto">{sorted.length} konusma</span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[40px_1fr_130px_100px_80px_80px] gap-x-3 px-3 py-2.5 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10">
        <div className="flex items-center justify-center" title="Çözüldü">
          <CheckCircle className="h-3.5 w-3.5" />
        </div>
        <div>Kisi / Mesaj</div>
        <button onClick={() => handleSort("time")} className="flex items-center gap-0.5 hover:text-gray-700 dark:hover:text-slate-200">
          Zaman <SortIcon col="time" />
        </button>
        <button onClick={() => handleSort("channel")} className="flex items-center gap-0.5 hover:text-gray-700 dark:hover:text-slate-200">
          Kanal <SortIcon col="channel" />
        </button>
        <button onClick={() => handleSort("status")} className="flex items-center gap-0.5 hover:text-gray-700 dark:hover:text-slate-200">
          Durum <SortIcon col="status" />
        </button>
        <div className="text-center">Oncelik</div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Konusma bulunamadi
          </div>
        ) : (
          sorted.map(conv => {
            const ChannelIcon = channelIcon[conv.channel_type || "web"] || Globe;
            const isExpanded = expandedId === conv.id;
            const isResolved = conv.status === "resolved" || conv.status === "closed";
            const sla = slaStatuses[conv.id];
            const slaBreached = sla && (sla.response_breached || sla.resolution_breached);

            return (
              <div key={conv.id} className={`border-b border-gray-100 dark:border-slate-800 transition-colors ${isResolved ? "opacity-60" : ""}`}>
                {/* Main Row */}
                <div className="grid grid-cols-[40px_1fr_130px_100px_80px_80px] gap-x-3 px-3 py-2 items-center hover:bg-gray-50 dark:hover:bg-slate-800/50 group">
                  {/* Resolved checkbox */}
                  <button onClick={() => toggleResolved(conv)} className="flex items-center justify-center" title={isResolved ? "Tekrar ac" : "Cozuldu olarak isaretle"}>
                    {isResolved ? (
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
                    )}
                  </button>

                  {/* Person + Message */}
                  <button onClick={() => setExpandedId(isExpanded ? null : conv.id)} className="flex items-center gap-2 min-w-0 text-left overflow-hidden">
                    <span className="text-gray-400 flex-shrink-0">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                    {conv.contact?.avatar_url ? (
                      <img src={conv.contact.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-gray-500">{conv.contact?.name?.charAt(0)?.toUpperCase() || "?"}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${isResolved ? "text-gray-500 line-through" : "text-gray-900 dark:text-white"}`}>
                        {conv.contact?.name || "Bilinmeyen"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {conv.last_message || conv.subject || "-"}
                      </p>
                    </div>
                  </button>

                  {/* Time */}
                  <span className="text-xs text-gray-500 whitespace-nowrap truncate">{formatDateTime(conv.last_message_at)}</span>

                  {/* Channel */}
                  <div className="flex items-center gap-1">
                    <ChannelIcon className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500 capitalize">{conv.channel_type || "-"}</span>
                  </div>

                  {/* Status */}
                  <span className={`text-xs font-medium ${statusColors[conv.status] || "text-gray-500"}`}>
                    {statusLabels[conv.status] || conv.status}
                  </span>

                  {/* Priority + SLA */}
                  <div className="flex items-center justify-center gap-1">
                    {conv.priority !== "normal" && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        conv.priority === "urgent" ? "bg-red-100 text-red-700" :
                        conv.priority === "high" ? "bg-orange-100 text-orange-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {conv.priority === "urgent" ? "Acil" : conv.priority === "high" ? "Yuksek" : "Dusuk"}
                      </span>
                    )}
                    {slaBreached && (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-14 pb-3 animate-fade-in">
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-xs text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {conv.last_message || "Mesaj icerigi yok"}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={() => onSelect(conv.id)}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline">
                        Konusmayi Ac
                      </button>
                      {conv.contact?.email && (
                        <span className="text-[11px] text-gray-400">{conv.contact.email}</span>
                      )}
                      {conv.contact?.phone && (
                        <span className="text-[11px] text-gray-400">{conv.contact.phone}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
