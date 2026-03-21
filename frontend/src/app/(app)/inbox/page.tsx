"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useConversationsStore } from "@/store/conversations";
import { conversationsAPI, messagesAPI } from "@/lib/api";
import ConversationList from "@/components/inbox/ConversationList";
import MessageThread from "@/components/inbox/MessageThread";
import MessageInput from "@/components/inbox/MessageInput";
import ContactPanel from "@/components/inbox/ContactPanel";
import { Inbox, MessageSquare } from "lucide-react";
import { Conversation } from "@/types";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch conversations on mount + poll every 5s
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await conversationsAPI.list();
        setConversations(res.data?.conversations || res.data || []);
      } catch {}
    };
    setLoading(true);
    fetchConversations().finally(() => setLoading(false));
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [setConversations]);

  // Fetch messages when active conversation changes + poll every 3s
  useEffect(() => {
    if (!activeConversationId) return;
    const fetchMessages = async () => {
      try {
        const res = await messagesAPI.list(activeConversationId);
        setMessages(activeConversationId, res.data?.messages || res.data || []);
      } catch {}
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeConversationId, setMessages]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
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
  }, [conversations, statusFilter, searchQuery]);

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
        console.log("[REPLIQ] messages for conv", convId, "count:", msgs.length, "last:", msgs[msgs.length - 1]);
        setMessages(convId, msgs);
      } catch (err) {
        console.error("[REPLIQ] refreshMessages error:", err);
      }
    },
    [setMessages]
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      try {
        await messagesAPI.reply(activeConversationId, content);
      } catch (err) {
        console.error("Failed to send message:", err);
      }
      // Always refresh messages after attempt
      await refreshMessages(activeConversationId);
    },
    [activeConversationId, refreshMessages]
  );

  const handleNote = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      try {
        await messagesAPI.addNote(activeConversationId, content);
      } catch (err) {
        console.error("Failed to add note:", err);
      }
      await refreshMessages(activeConversationId);
    },
    [activeConversationId, refreshMessages]
  );

  const handleUpdate = useCallback(
    (id: number, updates: Partial<Conversation>) => {
      updateConversation(id, updates);
    },
    [updateConversation]
  );

  return (
    <div className="flex h-screen">
      {/* Left Panel - Conversation List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <Inbox className="h-5 w-5 text-primary-600" />
          <h1 className="text-base font-semibold text-gray-900">Gelen Kutusu</h1>
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
            onSelect={setActiveConversation}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </div>

      {/* Center Panel - Message Thread */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white">
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
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 truncate">
                  {activeConversation.subject || "Konu yok"}
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  {activeConversation.contact?.name || "Bilinmeyen"}{" "}
                  {activeConversation.contact?.email
                    ? `- ${activeConversation.contact.email}`
                    : ""}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
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
                    ? "Acik"
                    : activeConversation.status === "pending"
                    ? "Beklemede"
                    : activeConversation.status === "resolved"
                    ? "Cozuldu"
                    : "Kapali"}
                </span>
              </div>
            </div>

            {/* Messages */}
            <MessageThread messages={activeMessages} />

            {/* Input */}
            <MessageInput onSend={handleSend} onNote={handleNote} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Bir konusma secin</p>
            <p className="text-xs text-gray-400 mt-1">
              Sol panelden bir konusma secin
            </p>
          </div>
        )}
      </div>

      {/* Right Panel - Contact Panel */}
      {activeConversation && (
        <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
          <ContactPanel
            conversation={activeConversation}
            onUpdate={handleUpdate}
          />
        </div>
      )}
    </div>
  );
}
