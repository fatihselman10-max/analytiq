"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types";
import { Bot, StickyNote, Image, Film, Mic, FileText, Share2, BookOpen } from "lucide-react";

interface MessageThreadProps {
  messages: Message[];
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Bugün";
  if (date.toDateString() === yesterday.toDateString()) return "Dün";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export default function MessageThread({ messages }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Re-scroll when container resizes (e.g. AI suggestions appear/disappear)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
        Henüz mesaj yok
      </div>
    );
  }

  let lastDate = "";

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-1 bg-gray-50/30">
      {messages.map((msg) => {
        const msgDate = formatMessageDate(msg.created_at);
        let showDate = false;
        if (msgDate !== lastDate) { showDate = true; lastDate = msgDate; }

        return (
          <div key={msg.id} className="animate-fade-in">
            {showDate && (
              <div className="flex items-center justify-center my-5">
                <span className="text-[11px] text-gray-400 bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm font-medium">{msgDate}</span>
              </div>
            )}

            {msg.is_internal ? (
              <div className="flex justify-center my-3">
                <div className="max-w-lg w-full bg-amber-50 border border-dashed border-amber-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">{msg.sender_name || "Dahili Not"}</span>
                    <span className="text-[10px] text-amber-400 ml-auto">{formatMessageTime(msg.created_at)}</span>
                  </div>
                  <p className="text-sm text-amber-800 whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : msg.sender_type === "contact" ? (
              <div className="flex justify-start mb-3">
                <div className="max-w-[70%]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-gray-500">{msg.sender_name || "Müşteri"}</span>
                    <span className="text-[10px] text-gray-400">{formatMessageTime(msg.created_at)}</span>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm border border-gray-100">
                    {/* Attachment'lar */}
                    {(msg as any).attachments?.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {(msg as any).attachments.map((att: any, i: number) => (
                          att.file_type === "image" || att.file_type === "story_reply" ? (
                            <a key={i} href={att.file_url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={att.file_url} alt="" className="max-w-full rounded-xl max-h-64 object-cover" />
                              {att.file_type === "story_reply" && <span className="text-[10px] text-purple-500 mt-0.5 block">Hikaye yanıtı</span>}
                            </a>
                          ) : att.file_type === "video" || att.file_type === "reel" ? (
                            <a key={i} href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                              <Film className="h-4 w-4 text-blue-500" />
                              <span className="text-xs text-blue-600 underline">{att.file_type === "reel" ? "Reels" : "Video"}</span>
                            </a>
                          ) : att.file_type === "audio" ? (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                              <Mic className="h-4 w-4 text-violet-500" />
                              <span className="text-xs text-gray-600">Sesli mesaj</span>
                            </div>
                          ) : att.file_type === "share" ? (
                            <a key={i} href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100">
                              <Share2 className="h-4 w-4 text-pink-500" />
                              <span className="text-xs text-pink-600 underline">Gönderi paylaşımı</span>
                            </a>
                          ) : att.file_type === "story_mention" ? (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-purple-50">
                              <BookOpen className="h-4 w-4 text-purple-500" />
                              <span className="text-xs text-purple-600">Hikayede bahsetti</span>
                            </div>
                          ) : att.file_url ? (
                            <a key={i} href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="text-xs text-blue-600 underline">Ek dosya</span>
                            </a>
                          ) : null
                        ))}
                      </div>
                    )}
                    {msg.content && !msg.content.startsWith("[") && (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.content && msg.content.startsWith("[") && !(msg as any).attachments?.length && (
                      <p className="text-sm text-gray-500 italic whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.content && msg.content.startsWith("[") && (msg as any).attachments?.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : msg.sender_type === "bot" ? (
              <div className="flex justify-start mb-3">
                <div className="max-w-[70%]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs font-medium text-indigo-600">Bot</span>
                    <span className="text-[10px] text-gray-400">{formatMessageTime(msg.created_at)}</span>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl rounded-tl-md px-4 py-2.5 border border-indigo-100">
                    <p className="text-sm text-indigo-800 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ) : msg.sender_type === "system" ? (
              <div className="flex justify-center my-2">
                <span className="text-xs text-gray-400 italic">{msg.content}</span>
              </div>
            ) : (
              <div className="flex justify-end mb-3">
                <div className="max-w-[70%]">
                  <div className="flex items-center justify-end gap-1.5 mb-1">
                    <span className="text-[10px] text-gray-400">{formatMessageTime(msg.created_at)}</span>
                    <span className="text-xs font-medium text-gray-500">{msg.sender_name || "Temsilci"}</span>
                  </div>
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl rounded-tr-md px-4 py-2.5 shadow-md shadow-blue-600/10">
                    <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
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
