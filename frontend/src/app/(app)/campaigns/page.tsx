"use client";

import { useState } from "react";
import { Plus, Send, Users, CheckCircle2, Clock, XCircle, MessageSquare, ChevronRight, BarChart3, Filter } from "lucide-react";

const DEMO_CAMPAIGNS = [
  {
    id: 1, name: "Yeni Sezon Koleksiyon Tanıtımı", status: "completed", channel: "WhatsApp",
    targetSegment: "Segment 2 + 3", targetCountry: "Rusya", sentAt: "18 Mar 2026",
    stats: { total: 28, sent: 28, delivered: 26, responded: 12, failed: 2 },
    responseBreakdown: { thanks: 4, interested: 5, question: 3, order: 0 }
  },
  {
    id: 2, name: "Rusça Tanıtım Filmi Gönderimi", status: "completed", channel: "Telegram",
    targetSegment: "Segment 3 + 4", targetCountry: "Rusya", sentAt: "10 Mar 2026",
    stats: { total: 42, sent: 42, delivered: 38, responded: 8, failed: 4 },
    responseBreakdown: { thanks: 3, interested: 2, question: 3, order: 0 }
  },
  {
    id: 3, name: "8 Mart Özel Gün Tebriği", status: "completed", channel: "WhatsApp",
    targetSegment: "Tüm Segmentler", targetCountry: "Tümü", sentAt: "8 Mar 2026",
    stats: { total: 52, sent: 52, delivered: 49, responded: 18, failed: 3 },
    responseBreakdown: { thanks: 12, interested: 3, question: 2, order: 1 }
  },
  {
    id: 4, name: "Fuar Sonrası Takip Mesajı", status: "active", channel: "WhatsApp",
    targetSegment: "Segment 4", targetCountry: "Rusya", sentAt: "25 Mar 2026",
    stats: { total: 15, sent: 10, delivered: 8, responded: 2, failed: 0 },
    responseBreakdown: { thanks: 1, interested: 1, question: 0, order: 0 }
  },
  {
    id: 5, name: "Yaz Sezonu Erken Sipariş İndirimi", status: "draft", channel: "Telegram",
    targetSegment: "Segment 1 + 2", targetCountry: "Tümü", sentAt: "-",
    stats: { total: 20, sent: 0, delivered: 0, responded: 0, failed: 0 },
    responseBreakdown: { thanks: 0, interested: 0, question: 0, order: 0 }
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Taslak", color: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", icon: Clock },
  active: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Send },
  completed: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300", icon: CheckCircle2 },
};

const DEMO_RECIPIENTS = [
  { name: "Anna Morozova", company: "VIPTEX", status: "responded", responseType: "interested", sentAt: "18 Mar 14:30" },
  { name: "Oleg Petrov", company: "Elena Chezelle", status: "responded", responseType: "question", sentAt: "18 Mar 14:30" },
  { name: "Svetlana Sivaeva", company: "Terra", status: "responded", responseType: "thanks", sentAt: "18 Mar 14:31" },
  { name: "Nadezdha Akulshina", company: "Tom Klaim", status: "delivered", responseType: "-", sentAt: "18 Mar 14:31" },
  { name: "Alexandr", company: "Edit Production", status: "sent", responseType: "-", sentAt: "18 Mar 14:32" },
  { name: "Lüdmila Tetsko", company: "Baihome", status: "failed", responseType: "-", sentAt: "-" },
];

const responseLabels: Record<string, string> = {
  thanks: "Teşekkür", interested: "İlgilendi", question: "Soru Sordu", order: "Sipariş Verdi", "-": "-"
};
const responseColors: Record<string, string> = {
  thanks: "text-gray-500", interested: "text-blue-600", question: "text-orange-600", order: "text-emerald-600", "-": "text-gray-400"
};
const recipientStatusColors: Record<string, string> = {
  responded: "bg-emerald-100 text-emerald-700", delivered: "bg-blue-100 text-blue-700", sent: "bg-gray-100 text-gray-600", failed: "bg-red-100 text-red-700", pending: "bg-gray-50 text-gray-400"
};

export default function CampaignsPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  const filteredCampaigns = filter === "all" ? DEMO_CAMPAIGNS : DEMO_CAMPAIGNS.filter(c => c.status === filter);

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kampanyalar</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{DEMO_CAMPAIGNS.length} kampanya, {DEMO_CAMPAIGNS.filter(c => c.status === "active").length} aktif</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-md shadow-blue-600/20 hover:shadow-lg transition-all">
          <Plus className="h-4 w-4" /> Yeni Kampanya
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Gönderim", value: "137", sub: "5 kampanya", color: "blue" },
          { label: "Teslim Oranı", value: "%93", sub: "121 / 137", color: "green" },
          { label: "Cevap Oranı", value: "%29", sub: "40 cevap", color: "purple" },
          { label: "Sipariş Dönüşümü", value: "%0.7", sub: "1 sipariş", color: "orange" },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{card.label}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all", label: "Tümü" },
          { key: "active", label: "Devam Eden" },
          { key: "completed", label: "Tamamlanan" },
          { key: "draft", label: "Taslak" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f.key ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Campaign List */}
        <div className="space-y-3">
          {filteredCampaigns.map(camp => {
            const sConf = statusConfig[camp.status];
            const responseRate = camp.stats.sent > 0 ? Math.round((camp.stats.responded / camp.stats.sent) * 100) : 0;
            return (
              <div key={camp.id}
                onClick={() => setSelectedCampaign(camp.id)}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedCampaign === camp.id ? "border-blue-300 dark:border-blue-700 shadow-sm" : "border-gray-100 dark:border-slate-800 hover:border-gray-200"
                }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{camp.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${sConf.color}`}>
                    <sConf.icon className="h-3 w-3" /> {sConf.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 mb-3">
                  <span>{camp.channel}</span>
                  <span>{camp.targetSegment}</span>
                  <span>{camp.targetCountry}</span>
                  {camp.sentAt !== "-" && <span>{camp.sentAt}</span>}
                </div>
                {camp.stats.sent > 0 && (
                  <>
                    <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mb-2">
                      <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full" style={{ width: `${responseRate}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                      <span>Gönderim: {camp.stats.sent}</span>
                      <span>Teslim: {camp.stats.delivered}</span>
                      <span>Cevap: {camp.stats.responded} ({responseRate}%)</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Campaign Detail - Recipients */}
        {selectedCampaign && (
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Alıcılar</h3>
            <div className="space-y-2">
              {DEMO_RECIPIENTS.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{r.company}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${recipientStatusColors[r.status]}`}>
                      {r.status === "responded" ? "Cevapladı" : r.status === "delivered" ? "Teslim" : r.status === "sent" ? "Gönderildi" : "Başarısız"}
                    </span>
                    {r.responseType !== "-" && (
                      <span className={`text-xs font-medium ${responseColors[r.responseType]}`}>
                        {responseLabels[r.responseType]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
