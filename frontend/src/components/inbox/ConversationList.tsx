"use client";

import { Conversation } from "@/types";
import {
  Search,
  Mail,
  MessageCircle,
  Instagram,
  Phone,
  Globe,
  Circle,
} from "lucide-react";

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
  email: Mail,
  whatsapp: MessageCircle,
  instagram: Instagram,
  phone: Phone,
  web: Globe,
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
  conversations,
  activeId,
  onSelect,
  statusFilter,
  onStatusFilter,
  searchQuery,
  onSearchChange,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Konusmalarda ara..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
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
            <p className="text-sm text-gray-500">Konusma bulunamadi</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const ChannelIcon = channelIcon[conv.channel_type || "web"] || Globe;
            const priority = priorityConfig[conv.priority] || priorityConfig.normal;
            const isActive = conv.id === activeId;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                  isActive ? "bg-primary-50 border-l-2 border-l-primary-600" : ""
                }`}
              >
                <div className="flex items-start gap-3">
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
                    {/* Top row: name + time */}
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

                    {/* Subject */}
                    <p className="text-sm text-gray-700 truncate mb-1">
                      {conv.subject || "Konu yok"}
                    </p>

                    {/* Bottom row: preview + badges */}
                    <div className="flex items-center gap-1.5">
                      {conv.last_message && (
                        <p className="text-xs text-gray-400 truncate flex-1">
                          {conv.last_message}
                        </p>
                      )}
                      {conv.priority !== "normal" && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${priority.className}`}
                        >
                          {priority.label}
                        </span>
                      )}
                      {conv.status === "open" && (
                        <Circle className="h-2 w-2 fill-green-500 text-green-500 flex-shrink-0" />
                      )}
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
