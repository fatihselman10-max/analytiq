"use client";

import { Conversation } from "@/types";
import { Search, Mail, MessageCircle, Instagram, Phone, Globe, Circle } from "lucide-react";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const statusTabs = [
  { key: "all", label: "Tumu" },
  { key: "open", label: "Acik" },
  { key: "pending", label: "Beklemede" },
  { key: "resolved", label: "Cozuldu" },
];

const channelIcon: Record<string, React.ElementType> = {
  email: Mail, whatsapp: MessageCircle, instagram: Instagram, phone: Phone, web: Globe,
};

const channelDot: Record<string, string> = {
  whatsapp: "bg-green-500", instagram: "bg-pink-500", telegram: "bg-blue-400",
  facebook: "bg-blue-600", twitter: "bg-sky-500", email: "bg-gray-400", livechat: "bg-purple-500",
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: "Acil", className: "bg-red-100 text-red-700" },
  high: { label: "Yuksek", className: "bg-orange-100 text-orange-700" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-700" },
  low: { label: "Dusuk", className: "bg-gray-100 text-gray-600" },
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "simdi";
  if (diffMins < 60) return `${diffMins}dk`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}sa`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}g`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function ConversationList({
  conversations, activeId, onSelect, statusFilter, onStatusFilter, searchQuery, onSearchChange,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Konusmalarda ara..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-100 rounded-xl bg-gray-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all" />
        </div>
      </div>

      {/* Status Tabs - Pill style */}
      <div className="flex gap-1 px-3 pb-3">
        {statusTabs.map((tab) => (
          <button key={tab.key} onClick={() => onStatusFilter(tab.key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              statusFilter === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageCircle className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">Konusma bulunamadi</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const ChannelIcon = channelIcon[conv.channel_type || "web"] || Globe;
            const priority = priorityConfig[conv.priority] || priorityConfig.normal;
            const isActive = conv.id === activeId;
            const dotColor = channelDot[conv.channel_type || "web"] || "bg-gray-400";

            return (
              <button key={conv.id} onClick={() => onSelect(conv.id)}
                className={`w-full text-left px-4 py-3 transition-all duration-150 ${
                  isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50/50 border-l-2 border-l-blue-600" : "hover:bg-gray-50/80 border-l-2 border-l-transparent"
                }`}>
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div className={`w-9 h-9 rounded-xl ${isActive ? "bg-blue-100" : "bg-gray-100"} flex items-center justify-center`}>
                      <span className={`text-sm font-semibold ${isActive ? "text-blue-600" : "text-gray-500"}`}>
                        {conv.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${dotColor} border-2 border-white`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-semibold truncate ${isActive ? "text-blue-900" : "text-gray-900"}`}>
                        {conv.contact?.name || "Bilinmeyen"}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mb-1">{conv.subject || "Konu yok"}</p>
                    <div className="flex items-center gap-1.5">
                      {conv.last_message && <p className="text-xs text-gray-400 truncate flex-1">{conv.last_message}</p>}
                      {conv.priority !== "normal" && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${priority.className}`}>{priority.label}</span>
                      )}
                      {conv.status === "open" && <Circle className="h-2 w-2 fill-green-500 text-green-500 flex-shrink-0" />}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
