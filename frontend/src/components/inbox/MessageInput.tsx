"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, StickyNote, MessageSquare } from "lucide-react";

interface MessageInputProps {
  onSend: (content: string) => void;
  onNote: (content: string) => void;
}

export default function MessageInput({ onSend, onNote }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isNoteMode, setIsNoteMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`; }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (isNoteMode) { onNote(trimmed); } else { onSend(trimmed); }
    setContent("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
  }, [content, isNoteMode, onSend, onNote]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className={`border-t ${isNoteMode ? "border-amber-200 bg-amber-50/50" : "border-gray-100 bg-white"}`}>
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <button onClick={() => setIsNoteMode(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !isNoteMode ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Yanit
        </button>
        <button onClick={() => setIsNoteMode(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isNoteMode ? "bg-amber-200 text-amber-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
          <StickyNote className="h-3.5 w-3.5" /> Dahili Not
        </button>
      </div>
      <div className="flex items-end gap-2 px-4 pb-3 pt-1">
        <textarea ref={textareaRef} value={content}
          onChange={(e) => { setContent(e.target.value); adjustHeight(); }}
          onKeyDown={handleKeyDown}
          placeholder={isNoteMode ? "Dahili not yaz... (sadece ekip gorebilir)" : "Mesajinizi yazin..."}
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
