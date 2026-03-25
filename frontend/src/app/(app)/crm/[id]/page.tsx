"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, Mail, Globe, MessageSquare, Building2, MapPin, Edit3, Plus, TrendingUp, Calendar, Tag, Send } from "lucide-react";

const DEMO_CONTACTS: Record<string, any> = {
  "1": { name: "Anna Morozova", company: "VIPTEX", country: "Rusya", segment: 1, fair: "BTK 2025", phone: "+7 905 106 53 53", email: "anna@viptex.ru", instagram: "@viptex_official", orders: "8609, 8733" },
  "2": { name: "Oleg Petrov", company: "Elena Chezelle", country: "Rusya", segment: 1, fair: "VIPTEX 2025", phone: "+7 921 963 88 82", email: "oleg@chezelle.ru", instagram: "@elenachezelle", orders: "8601, 7058, 7768" },
  "3": { name: "Svetlana Sivaeva", company: "Terra", country: "Rusya", segment: 2, fair: "VIPTEX 2025", phone: "+7 916 106 03 20", email: "svetlana.terramd@mail.ru", instagram: "@terra_fashion", orders: "-" },
  "6": { name: "Alexandr", company: "Edit Production", country: "Rusya", segment: 3, fair: "VIPTEX 2025", phone: "+7 977 420 48 73", email: "", instagram: "@production.edit", orders: "-" },
};

const segmentLabels: Record<number, string> = {
  1: "Satış + İletişim", 2: "İletişim Var, Satış Yok", 3: "Büyük Firma, Ulaşılamıyor", 4: "Normal Firma, Ulaşılamıyor"
};
const segmentColors: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700", 2: "bg-blue-100 text-blue-700", 3: "bg-amber-100 text-amber-700", 4: "bg-red-100 text-red-700"
};

const DEMO_TIMELINE = [
  { type: "note", date: "24 Mar 2026", author: "Ahmet Y.", content: "Yeni sezon numuneleri gönderildi. 3 model beğendi, sipariş hazırlanıyor. Haftalık takip devam edecek." },
  { type: "segment", date: "20 Mar 2026", author: "Sistem", content: "Segment değişikliği: 2 → 1 (İletişim Var → Satış + İletişim)", from: 2, to: 1 },
  { type: "campaign", date: "18 Mar 2026", author: "Kampanya", content: "\"Yeni Sezon Tanıtımı\" kampanyası gönderildi — Cevap: Soru sordu, numune istedi" },
  { type: "note", date: "15 Mar 2026", author: "Mehmet K.", content: "WhatsApp üzerinden arandı, fiyat listesi gönderildi. İlgilendiğini belirtti, numune talep etti." },
  { type: "message", date: "12 Mar 2026", author: "Müşteri", content: "\"Hello, we are interested in your new collection. Can you send us samples?\"", channel: "WhatsApp" },
  { type: "campaign", date: "10 Mar 2026", author: "Kampanya", content: "\"Rusça Tanıtım Filmi\" kampanyası gönderildi — Cevap: İzledi, teşekkür etti" },
  { type: "note", date: "5 Mar 2026", author: "Ahmet Y.", content: "Fuarda tanıştık, kartvizit aldık. VIPTEX fuarından. Büyük firma, potansiyeli yüksek." },
  { type: "segment", date: "5 Mar 2026", author: "Sistem", content: "Müşteri oluşturuldu, Segment: 2 (İletişim Var, Satış Yok)", from: 0, to: 2 },
];

const DEMO_CONVERSATIONS = [
  { id: 1, channel: "WhatsApp", date: "22 Mar 2026", lastMsg: "Numuneler kargoya verildi, takip numarası: TR923847", direction: "outbound", status: "open" },
  { id: 2, channel: "Instagram", date: "18 Mar 2026", lastMsg: "Thank you for the catalog!", direction: "inbound", status: "resolved" },
  { id: 3, channel: "Email", date: "10 Mar 2026", lastMsg: "Price list attached", direction: "outbound", status: "resolved" },
];

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"timeline" | "notes" | "conversations" | "campaigns">("timeline");
  const [newNote, setNewNote] = useState("");

  const contact = DEMO_CONTACTS[id as string] || DEMO_CONTACTS["1"];
  const tabs = [
    { key: "timeline", label: "Zaman Çizelgesi" },
    { key: "notes", label: "Notlar" },
    { key: "conversations", label: "Konuşmalar" },
    { key: "campaigns", label: "Kampanyalar" },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto">
      {/* Back */}
      <button onClick={() => router.push("/crm")} className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Müşteri Listesi
      </button>

      {/* Contact Header */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-600/20">
            {contact.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{contact.name}</h1>
              <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold ${segmentColors[contact.segment]}`}>
                {contact.segment}. Segment — {segmentLabels[contact.segment]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {contact.company}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {contact.country}</span>
              <span className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> {contact.fair}</span>
              {contact.orders !== "-" && <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-emerald-500" /> Siparişler: {contact.orders}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <Phone className="h-3.5 w-3.5" /> {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <Mail className="h-3.5 w-3.5" /> {contact.email}
                </a>
              )}
              {contact.instagram && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-600 dark:text-slate-300">
                  <Globe className="h-3.5 w-3.5" /> {contact.instagram}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
              <Edit3 className="h-4 w-4" /> Düzenle
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all">
              <Send className="h-4 w-4" /> Mesaj Gönder
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          {DEMO_TIMELINE.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${
                  item.type === "note" ? "bg-blue-500" :
                  item.type === "segment" ? "bg-purple-500" :
                  item.type === "campaign" ? "bg-orange-500" :
                  "bg-green-500"
                }`}>
                  {item.type === "note" ? "📝" : item.type === "segment" ? "↕" : item.type === "campaign" ? "📣" : "💬"}
                </div>
                {i < DEMO_TIMELINE.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 dark:bg-slate-700 mt-2" />}
              </div>
              <div className="flex-1 pb-6">
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{item.author}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{item.date}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{item.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "notes" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Haftalık gelişim notu ekle..."
              className="w-full border-0 bg-transparent text-sm text-gray-700 dark:text-slate-300 placeholder-gray-400 resize-none focus:ring-0 min-h-[80px]"
            />
            <div className="flex justify-end mt-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Not Ekle
              </button>
            </div>
          </div>
          {DEMO_TIMELINE.filter(t => t.type === "note").map((note, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{note.author}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">{note.date}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-400">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "conversations" && (
        <div className="space-y-3">
          {DEMO_CONVERSATIONS.map(conv => (
            <div key={conv.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4 hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{conv.channel}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    conv.direction === "inbound" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  }`}>
                    {conv.direction === "inbound" ? "Gelen" : "Giden"}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${conv.status === "open" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                    {conv.status === "open" ? "Açık" : "Çözüldü"}
                  </span>
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500">{conv.date}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-400">{conv.lastMsg}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="space-y-3">
          {[
            { name: "Yeni Sezon Tanıtımı", date: "18 Mar 2026", status: "responded", response: "Soru sordu, numune istedi", channel: "WhatsApp" },
            { name: "Rusça Tanıtım Filmi", date: "10 Mar 2026", status: "responded", response: "İzledi, teşekkür etti", channel: "Telegram" },
            { name: "Özel Gün Tebriği", date: "8 Mar 2026", status: "delivered", response: "Okundu, cevap yok", channel: "WhatsApp" },
          ].map((camp, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{camp.name}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">{camp.date}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-slate-400">Kanal: {camp.channel}</span>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <span className={`font-medium ${camp.status === "responded" ? "text-emerald-600" : "text-gray-500"}`}>
                  {camp.response}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
