"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useConversationsStore } from "@/store/conversations";
import { conversationsAPI, messagesAPI, slaAPI } from "@/lib/api";
import ConversationList from "@/components/inbox/ConversationList";
import MessageThread from "@/components/inbox/MessageThread";
import MessageInput from "@/components/inbox/MessageInput";
import ContactPanel from "@/components/inbox/ContactPanel";
import { Inbox, MessageSquare, ArrowLeft, User } from "lucide-react";
import { Conversation } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg, DEMO_CONVERSATIONS, DEMO_MESSAGES, DEMO_SLA_STATUSES } from "@/lib/demo-data";

export default function InboxPage() {
  const {
    conversations,
    activeConversationId,
    messages,
    setConversations,
    setActiveConversation,
    setMessages,
    updateConversation,
  } = useConversationsStore();

  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [slaStatuses, setSlaStatuses] = useState<Record<number, { response_breached: boolean; resolution_breached: boolean; response_elapsed: number; response_target: number }>>({});
  const { toast } = useToast();
  const { organization } = useAuthStore();
  const isDemo = isDemoOrg(organization?.name);

  // Fetch conversations on mount + poll every 5s
  useEffect(() => {
    if (!organization) return;
    if (isDemo) {
      setConversations(DEMO_CONVERSATIONS as any);
      setSlaStatuses(DEMO_SLA_STATUSES);
      setLoading(false);
      return;
    }
    const fetchConversations = async () => {
      try {
        const res = await conversationsAPI.list();
        setConversations(res.data?.conversations || res.data || []);
      } catch {}
    };
    setLoading(true);
    fetchConversations().finally(() => setLoading(false));
    const interval = setInterval(fetchConversations, 5000);

    slaAPI.getStatuses().then(({ data }) => {
      if (data.enabled && data.sla_statuses) setSlaStatuses(data.sla_statuses);
    }).catch(() => {});

    return () => clearInterval(interval);
  }, [setConversations, isDemo, organization]);

  // Fetch messages when active conversation changes + poll every 3s
  useEffect(() => {
    if (!activeConversationId) return;
    if (isDemo) {
      setMessages(activeConversationId, (DEMO_MESSAGES[activeConversationId] || []) as any);
      return;
    }
    const fetchMessages = async () => {
      try {
        const res = await messagesAPI.list(activeConversationId);
        setMessages(activeConversationId, res.data?.messages || res.data || []);
      } catch {}
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeConversationId, setMessages, isDemo]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (channelFilter !== "all") {
      filtered = filtered.filter((c) => c.channel_type === channelFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.subject?.toLowerCase().includes(q) ||
          c.contact?.name?.toLowerCase().includes(q) ||
          c.contact?.email?.toLowerCase().includes(q) ||
          c.last_message?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [conversations, statusFilter, channelFilter, searchQuery]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const activeMessages = activeConversationId
    ? messages[activeConversationId] || []
    : [];

  const refreshMessages = useCallback(
    async (convId: number) => {
      try {
        const res = await messagesAPI.list(convId);
        const msgs = res.data?.messages || res.data || [];
        setMessages(convId, msgs);
      } catch {}
    },
    [setMessages]
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      if (isDemo) {
        toast("Demo modunda mesaj gönderilemez", "info");
        return;
      }
      try {
        await messagesAPI.reply(activeConversationId, content);
      } catch {
        toast("Mesaj gönderilemedi", "error");
        return;
      }
      await refreshMessages(activeConversationId);
    },
    [activeConversationId, refreshMessages, isDemo]
  );

  const handleNote = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      if (isDemo) {
        toast("Demo modunda not eklenemez", "info");
        return;
      }
      try {
        await messagesAPI.addNote(activeConversationId, content);
      } catch {
        toast("Not eklenemedi", "error");
        return;
      }
      await refreshMessages(activeConversationId);
    },
    [activeConversationId, refreshMessages, isDemo]
  );

  const handleUpdate = useCallback(
    (id: number, updates: Partial<Conversation>) => {
      updateConversation(id, updates);
    },
    [updateConversation]
  );

  const handleMobileBack = () => {
    setActiveConversation(0);
    setShowContactPanel(false);
  };

  const handleMobileSelect = (id: number) => {
    setActiveConversation(id);
    setShowContactPanel(false);
  };

  // Mobile: show list or thread based on activeConversationId
  const showMobileThread = activeConversationId && activeConversation;

  return (
    <div className="flex h-[calc(100dvh-3rem-3.5rem)] lg:h-screen">
      {/* Left Panel - Conversation List */}
      <div className={`${showMobileThread ? "hidden lg:flex" : "flex"} w-full lg:w-80 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-col`}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <Inbox className="h-5 w-5 text-primary-600" />
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Gelen Kutusu</h1>
          <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {filteredConversations.length}
          </span>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <ConversationList
            conversations={filteredConversations}
            activeId={activeConversationId}
            onSelect={handleMobileSelect}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            channelFilter={channelFilter}
            onChannelFilter={setChannelFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            slaStatuses={slaStatuses}
            onRefresh={async () => {
              try {
                const res = await conversationsAPI.list();
                setConversations(res.data?.conversations || res.data || []);
              } catch {}
            }}
          />
        )}
      </div>

      {/* Center Panel - Message Thread */}
      <div className={`${showMobileThread ? "flex" : "hidden lg:flex"} flex-1 flex-col bg-white dark:bg-slate-900 min-w-0 overflow-hidden`}>
        {activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              {/* Mobile back button */}
              <button onClick={handleMobileBack} className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5" />
              </button>
              {activeConversation.contact?.avatar_url ? (
                <img
                  src={activeConversation.contact.avatar_url}
                  alt={activeConversation.contact.name || ""}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-gray-600">
                    {activeConversation.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-gray-900 truncate">
                  {activeConversation.contact?.name || "Bilinmeyen"}
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  {activeConversation.last_message || activeConversation.subject || "Konu yok"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    activeConversation.status === "open"
                      ? "bg-green-100 text-green-700"
                      : activeConversation.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : activeConversation.status === "resolved"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {activeConversation.status === "open"
                    ? "Açık"
                    : activeConversation.status === "pending"
                    ? "Beklemede"
                    : activeConversation.status === "resolved"
                    ? "Çözüldü"
                    : "Kapalı"}
                </span>
                {/* Mobile contact info toggle */}
                <button
                  onClick={() => setShowContactPanel(!showContactPanel)}
                  className="lg:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <User className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <MessageThread messages={activeMessages} />

            {/* Input */}
            <div className="flex-shrink-0">
              <MessageInput
                onSend={handleSend}
                onNote={handleNote}
                conversationMessages={activeMessages}
                contactName={activeConversation.contact?.name}
                contactEmail={activeConversation.contact?.email}
                contactPhone={activeConversation.contact?.phone}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Bir konuşma seçin</p>
            <p className="text-xs text-gray-400 mt-1">
              Sol panelden bir konuşma seçin
            </p>
          </div>
        )}
      </div>

      {/* Right Panel - Contact Panel (Desktop: always visible, Mobile: overlay) */}
      {activeConversation && (
        <>
          {/* Desktop */}
          <div className="hidden lg:flex w-80 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-col">
            <ContactPanel
              conversation={activeConversation}
              onUpdate={handleUpdate}
              onSendMessage={handleSend}
            />
          </div>
          {/* Mobile overlay */}
          {showContactPanel && (
            <>
              <div className="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setShowContactPanel(false)} />
              <div className="lg:hidden fixed right-0 top-12 bottom-14 z-40 w-80 max-w-[85vw] bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Müşteri Bilgileri</h3>
                  <button onClick={() => setShowContactPanel(false)} className="p-1 text-gray-400 hover:text-gray-700">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
                <ContactPanel
                  conversation={activeConversation}
                  onUpdate={handleUpdate}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
