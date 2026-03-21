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
    addMessage,
    updateConversation,
  } = useConversationsStore();

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const res = await conversationsAPI.list();
        setConversations(res.data?.conversations || res.data || []);
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [setConversations]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;
    const fetchMessages = async () => {
      try {
        const res = await messagesAPI.list(activeConversationId);
        setMessages(activeConversationId, res.data?.messages || res.data || []);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    };
    fetchMessages();
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

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      try {
        const res = await messagesAPI.reply(activeConversationId, content);
        if (res.data) addMessage(activeConversationId, res.data);
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    },
    [activeConversationId, addMessage]
  );

  const handleNote = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      try {
        const res = await messagesAPI.addNote(activeConversationId, content);
        if (res.data) addMessage(activeConversationId, res.data);
      } catch (err) {
        console.error("Failed to add note:", err);
      }
    },
    [activeConversationId, addMessage]
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
      <div className="w-80 border-r border-gray-100 bg-white flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <div className="p-1.5 rounded-lg bg-blue-50">
            <Inbox className="h-4 w-4 text-blue-600" />
          </div>
          <h1 className="text-sm font-semibold text-gray-900">Gelen Kutusu</h1>
          <span className="ml-auto text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
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
            <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-white">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-blue-600">
                  {activeConversation.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
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
                    ? "Açık"
                    : activeConversation.status === "pending"
                    ? "Beklemede"
                    : activeConversation.status === "resolved"
                    ? "Çözüldü"
                    : "Kapalı"}
                </span>
              </div>
            </div>

            {/* Messages */}
            <MessageThread messages={activeMessages} />

            {/* Input */}
            <MessageInput onSend={handleSend} onNote={handleNote} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500">Bir konuşma seçin</p>
            <p className="text-xs text-gray-400 mt-1">Sol panelden bir konuşma seçerek başlayabilirsiniz</p>
          </div>
        )}
      </div>

      {/* Right Panel - Contact Panel */}
      {activeConversation && (
        <div className="w-80 border-l border-gray-100 bg-white flex flex-col">
          <ContactPanel
            conversation={activeConversation}
            onUpdate={handleUpdate}
          />
        </div>
      )}
    </div>
  );
}
