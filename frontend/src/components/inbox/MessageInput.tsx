"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { Send, StickyNote, MessageSquare, Zap, Sparkles, Loader2, X } from "lucide-react";
import { cannedAPI } from "@/lib/api";

interface CannedResponse {
  id: number;
  shortcut: string;
  title: string;
  content: string;
}

interface ConversationMessage {
  sender_type: string;
  content: string;
}

interface MessageInputProps {
  onSend: (content: string) => void;
  onNote: (content: string) => void;
  conversationMessages?: ConversationMessage[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export default function MessageInput({ onSend, onNote, conversationMessages, contactName, contactEmail, contactPhone }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [cannedFilter, setCannedFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cannedRef = useRef<HTMLDivElement>(null);

  // AI Suggested Reply state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const lastSuggestedMsg = useRef<string>("");

  // Load canned responses once
  useEffect(() => {
    cannedAPI.list().then((res) => {
      setCannedResponses(res.data?.canned_responses || res.data || []);
    }).catch(() => {});
  }, []);

  // Generate AI suggestions via dedicated fast endpoint
  useEffect(() => {
    const msgs = conversationMessages || [];
    const lastCustomerMsg = [...msgs].reverse().find(m => m.sender_type === "contact");
    if (!lastCustomerMsg) return;
    const msgKey = lastCustomerMsg.content;
    if (msgKey === lastSuggestedMsg.current) return;
    setSuggestDismissed(false);
    lastSuggestedMsg.current = msgKey;
    setSuggestLoading(true);
    setSuggestions([]);

    fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: msgs.slice(-10),
        contactName,
        contactEmail,
        contactPhone,
      }),
    })
      .then(r => r.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestLoading(false));
  }, [conversationMessages, contactName, contactEmail, contactPhone]);

  // Close canned panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cannedRef.current && !cannedRef.current.contains(e.target as Node)) {
        setShowCanned(false);
      }
    };
    if (showCanned) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCanned]);

  // Detect / shortcut trigger
  useEffect(() => {
    if (content.startsWith("/") && !isNoteMode) {
      setCannedFilter(content.slice(1).toLowerCase());
      if (cannedResponses.length > 0) setShowCanned(true);
    } else {
      setShowCanned(false);
    }
  }, [content, isNoteMode, cannedResponses.length]);

  const filteredCanned = cannedResponses.filter(
    (cr) =>
      cr.shortcut.toLowerCase().includes(cannedFilter) ||
      cr.title.toLowerCase().includes(cannedFilter)
  );

  // Kategorilere ayır (shortcut prefix'ine göre: kargo-xxx, iade-xxx, inf-xxx, genel)
  const CATEGORIES: Record<string, { label: string; color: string }> = {
    kargo: { label: "Kargo", color: "bg-blue-100 text-blue-700" },
    iade: { label: "Iade", color: "bg-red-100 text-red-700" },
    degisim: { label: "Degisim", color: "bg-orange-100 text-orange-700" },
    inf: { label: "Influencer", color: "bg-pink-100 text-pink-700" },
  };

  const getCannedCategory = (shortcut: string) => {
    const prefix = shortcut.split("-")[0];
    return CATEGORIES[prefix] ? prefix : "genel";
  };

  const groupedCanned = filteredCanned.reduce<Record<string, CannedResponse[]>>((acc, cr) => {
    const cat = getCannedCategory(cr.shortcut);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cr);
    return acc;
  }, {});

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`; }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (isNoteMode) { onNote(trimmed); } else { onSend(trimmed); }
    setContent("");
    setShowCanned(false);
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
  }, [content, isNoteMode, onSend, onNote]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") { setShowCanned(false); }
  };

  const selectCanned = (cr: CannedResponse) => {
    setContent(cr.content);
    setShowCanned(false);
    textareaRef.current?.focus();
  };

  const sendCannedDirect = (cr: CannedResponse) => {
    onSend(cr.content);
    setShowCanned(false);
    setContent("");
  };

  return (
    <div className={`border-t relative ${isNoteMode ? "border-amber-200 bg-amber-50/50" : "border-gray-100 bg-white"}`}>
      {/* AI Suggested Replies */}
      {!isNoteMode && !suggestDismissed && (suggestLoading || suggestions.length > 0) && (
        <div className="px-4 pt-2 pb-1 max-h-24 overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-violet-500" />
              <span className="text-[10px] font-medium text-violet-600">AI Yanit Onerisi</span>
            </div>
            <button onClick={() => setSuggestDismissed(true)} className="p-0.5 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </button>
          </div>
          {suggestLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
              <span className="text-[10px] text-gray-400">Yanit olusturuluyor...</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { onSend(s); setSuggestDismissed(true); }}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-800 hover:bg-violet-100 hover:border-violet-300 transition-all text-left max-w-full"
                >
                  <span className="line-clamp-2 flex-1">{s}</span>
                  <Send className="h-3 w-3 text-violet-400 group-hover:text-violet-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Canned responses popup - kategorili */}
      {showCanned && filteredCanned.length > 0 && (
        <div ref={cannedRef} className="absolute bottom-full left-0 right-0 mx-4 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto z-10">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white z-10">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-gray-500">Hazir Yanitlar</span>
            <span className="text-[10px] text-gray-400 ml-auto">{filteredCanned.length} sonuc</span>
          </div>
          {Object.entries(groupedCanned).map(([cat, items]) => {
            const catInfo = CATEGORIES[cat] || { label: "Genel", color: "bg-gray-100 text-gray-600" };
            return (
              <div key={cat}>
                <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 sticky top-[33px] z-[5]">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${catInfo.color}`}>
                    {catInfo.label}
                  </span>
                </div>
                {items.map((cr) => (
                  <div key={cr.id} className="flex items-center border-b border-gray-50 last:border-0 hover:bg-blue-50 transition-colors">
                    <button
                      onClick={() => selectCanned(cr)}
                      className="flex-1 text-left px-3 py-2 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">/{cr.shortcut}</span>
                        <span className="text-xs font-medium text-gray-700 truncate">{cr.title}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{cr.content}</p>
                    </button>
                    <button
                      onClick={() => sendCannedDirect(cr)}
                      className="px-3 py-2 text-gray-300 hover:text-blue-600 hover:bg-blue-100 rounded-lg mr-1 flex-shrink-0 transition-colors"
                      title="Direkt gonder"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <button onClick={() => setIsNoteMode(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !isNoteMode ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Yanıt
        </button>
        <button onClick={() => setIsNoteMode(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isNoteMode ? "bg-amber-200 text-amber-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
          <StickyNote className="h-3.5 w-3.5" /> Dahili Not
        </button>
        {!isNoteMode && cannedResponses.length > 0 && (
          <button
            onClick={() => { setShowCanned(!showCanned); setCannedFilter(""); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showCanned ? "bg-amber-100 text-amber-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
          >
            <Zap className="h-3.5 w-3.5" /> Hazır Yanıt
          </button>
        )}
      </div>
      <div className="flex items-end gap-2 px-4 pb-3 pt-1">
        <textarea ref={textareaRef} value={content}
          onChange={(e) => { setContent(e.target.value); adjustHeight(); }}
          onKeyDown={handleKeyDown}
          placeholder={isNoteMode ? "Dahili not yaz... (sadece ekip görebilir)" : "Mesajınızı yazın... ( / ile hazır yanıt)"}
          rows={1}
          className={`flex-1 resize-none text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
            isNoteMode ? "border-amber-200 bg-amber-50 focus:ring-amber-300 placeholder-amber-400" : "border-gray-200 bg-gray-50 focus:bg-white focus:ring-blue-500/20 placeholder-gray-400"}`} />
        <button onClick={handleSubmit} disabled={!content.trim()}
          className={`flex-shrink-0 p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            isNoteMode ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-600/20"}`}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
