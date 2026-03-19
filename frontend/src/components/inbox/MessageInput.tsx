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
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (isNoteMode) {
      onNote(trimmed);
    } else {
      onSend(trimmed);
    }

    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, isNoteMode, onSend, onNote]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`border-t ${
        isNoteMode ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Mode toggle */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <button
          onClick={() => setIsNoteMode(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !isNoteMode
              ? "bg-primary-100 text-primary-700"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Yanit
        </button>
        <button
          onClick={() => setIsNoteMode(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isNoteMode
              ? "bg-yellow-200 text-yellow-800"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <StickyNote className="h-3.5 w-3.5" />
          Dahili Not
        </button>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 px-4 pb-3 pt-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isNoteMode
              ? "Dahili not yaz... (sadece ekip gorebilir)"
              : "Mesajinizi yazin..."
          }
          rows={1}
          className={`flex-1 resize-none text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
            isNoteMode
              ? "border-yellow-300 bg-yellow-50 focus:ring-yellow-400 placeholder-yellow-500"
              : "border-gray-200 bg-gray-50 focus:bg-white focus:ring-primary-500 placeholder-gray-400"
          }`}
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className={`flex-shrink-0 p-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isNoteMode
              ? "bg-yellow-500 hover:bg-yellow-600 text-white"
              : "bg-primary-600 hover:bg-primary-700 text-white"
          }`}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
