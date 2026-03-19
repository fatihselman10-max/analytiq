"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types";
import { Bot, StickyNote } from "lucide-react";

interface MessageThreadProps {
  messages: Message[];
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Bugun";
  if (date.toDateString() === yesterday.toDateString()) return "Dun";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function MessageThread({ messages }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Henuz mesaj yok
      </div>
    );
  }

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
      {messages.map((msg) => {
        const msgDate = formatMessageDate(msg.created_at);
        let showDate = false;
        if (msgDate !== lastDate) {
          showDate = true;
          lastDate = msgDate;
        }

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center justify-center my-4">
                <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">
                  {msgDate}
                </span>
              </div>
            )}

            {/* Internal note */}
            {msg.is_internal ? (
              <div className="flex justify-center my-3">
                <div className="max-w-lg w-full bg-yellow-50 border border-dashed border-yellow-300 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <StickyNote className="h-3.5 w-3.5 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">
                      {msg.sender_name || "Dahili Not"}
                    </span>
                    <span className="text-[10px] text-yellow-500 ml-auto">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ) : msg.sender_type === "contact" ? (
              /* Contact message - left aligned */
              <div className="flex justify-start mb-3">
                <div className="max-w-[70%]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      {msg.sender_name || "Musteri"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-2.5">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ) : msg.sender_type === "bot" ? (
              /* Bot message - left aligned with badge */
              <div className="flex justify-start mb-3">
                <div className="max-w-[70%]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium text-blue-600">
                      Bot
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                  <div className="bg-blue-50 rounded-2xl rounded-tl-md px-4 py-2.5 border border-blue-100">
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ) : msg.sender_type === "system" ? (
              /* System message */
              <div className="flex justify-center my-2">
                <span className="text-xs text-gray-400 italic">
                  {msg.content}
                </span>
              </div>
            ) : (
              /* Agent message - right aligned */
              <div className="flex justify-end mb-3">
                <div className="max-w-[70%]">
                  <div className="flex items-center justify-end gap-1.5 mb-1">
                    <span className="text-[10px] text-gray-400">
                      {formatMessageTime(msg.created_at)}
                    </span>
                    <span className="text-xs font-medium text-gray-600">
                      {msg.sender_name || "Temsilci"}
                    </span>
                  </div>
                  <div className="bg-primary-600 rounded-2xl rounded-tr-md px-4 py-2.5">
                    <p className="text-sm text-white whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
