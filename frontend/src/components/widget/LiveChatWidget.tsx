"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send } from "lucide-react";

interface Props {
  channelId: number;
  apiBase?: string;
}

interface WidgetMessage {
  id: string;
  content: string;
  sender: "user" | "agent" | "bot";
  time: string;
}

export default function LiveChatWidget({ channelId, apiBase = "/api/v1" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const senderIdRef = useRef(
    `visitor-${Math.random().toString(36).substring(2, 10)}`
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStarted(true);
    setMessages([
      {
        id: "welcome",
        content: `Merhaba ${name}! Size nasil yardimci olabiliriz?`,
        sender: "bot",
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput("");

    const userMsg: WidgetMessage = {
      id: `user-${Date.now()}`,
      content,
      sender: "user",
      time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      await fetch(`${apiBase}/webhooks/livechat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: channelId,
          sender_id: senderIdRef.current,
          name,
          content,
        }),
      });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 flex items-center justify-center z-50 transition-transform hover:scale-105"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat popup */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-primary-600 text-white p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Canli Destek</h3>
              <p className="text-xs text-primary-200">Genellikle birkaç dakika içinde yanit verilir</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-primary-700 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          {!started ? (
            /* Name form */
            <div className="flex-1 flex items-center justify-center p-6">
              <form onSubmit={handleStart} className="w-full space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  Gorusmeye baslamak icin adinizi girin
                </p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Adiniz"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Baslat
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.sender === "user"
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender === "user" ? "text-primary-200" : "text-gray-400"
                        }`}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Mesajinizi yazin..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleSend}
                    className="w-9 h-9 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
