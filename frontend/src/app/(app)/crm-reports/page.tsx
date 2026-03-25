"use client";

import { useState } from "react";
import { Users, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Activity, Target, Send, MessageSquare } from "lucide-react";

const SEGMENT_DATA = [
  { id: 1, label: "Satış + İletişim", count: 3, prev: 2, color: "bg-emerald-500", pct: 20 },
  { id: 2, label: "İletişim Var, Satış Yok", count: 5, prev: 4, color: "bg-blue-500", pct: 33 },
  { id: 3, label: "Büyük Firma, Ulaşılamıyor", count: 3, prev: 4, color: "bg-amber-500", pct: 20 },
  { id: 4, label: "Normal Firma, Ulaşılamıyor", count: 4, prev: 5, color: "bg-red-500", pct: 27 },
];

const MOVEMENTS = [
  { from: 4, to: 2, count: 2, label: "Segment 4 → 2", description: "İletişim kuruldu", direction: "up" },
  { from: 2, to: 1, count: 1, label: "Segment 2 → 1", description: "Satış gerçekleşti", direction: "up" },
  { from: 3, to: 2, count: 1, label: "Segment 3 → 2", description: "Büyük firmaya ulaşıldı", direction: "up" },
  { from: 1, to: 2, count: 1, label: "Segment 1 → 2", description: "Müşteri bu sezon sipariş vermedi", direction: "down" },
];

const CAMPAIGN_STATS = [
  { name: "Yeni Sezon Koleksiyon", sent: 28, responded: 12, rate: 43, orders: 0 },
  { name: "Rusça Tanıtım Filmi", sent: 42, responded: 8, rate: 19, orders: 0 },
  { name: "8 Mart Tebriği", sent: 52, responded: 18, rate: 35, orders: 1 },
  { name: "Fuar Sonrası Takip", sent: 10, responded: 2, rate: 20, orders: 0 },
];

const DIRECTION_STATS = {
  inbound: { count: 18, pct: 31 },
  outbound: { count: 40, pct: 69 },
};

export default function CRMReportsPage() {
  const [period, setPeriod] = useState("30d");
  const totalCustomers = SEGMENT_DATA.reduce((s, d) => s + d.count, 0);
  const totalWins = MOVEMENTS.filter(m => m.direction === "up").reduce((s, m) => s + m.count, 0);
  const totalLosses = MOVEMENTS.filter(m => m.direction === "down").reduce((s, m) => s + m.count, 0);

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CRM Raporları</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Müşteri segmentasyon, kampanya ve iletişim analizleri</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm">
          <option value="7d">Son 7 Gün</option>
          <option value="30d">Son 30 Gün</option>
          <option value="90d">Son 90 Gün</option>
        </select>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Müşteri", value: totalCustomers.toString(), icon: Users, change: "+2", up: true },
          { label: "Aktif Satış (Seg.1)", value: SEGMENT_DATA[0].count.toString(), icon: Target, change: "+1", up: true },
          { label: "Kazanım (Segment ↑)", value: totalWins.toString(), icon: TrendingUp, change: "+4", up: true },
          { label: "Kayıp (Segment ↓)", value: totalLosses.toString(), icon: TrendingDown, change: "1", up: false },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className="h-5 w-5 text-gray-400 dark:text-slate-500" />
              <span className={`flex items-center gap-0.5 text-xs font-medium ${stat.up ? "text-emerald-600" : "text-red-500"}`}>
                {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Segment Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-blue-500" /> Segment Dağılımı
          </h3>
          <div className="space-y-3">
            {SEGMENT_DATA.map(seg => (
              <div key={seg.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-slate-300">{seg.id}. {seg.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{seg.count}</span>
                    <span className={`text-xs ${seg.count > seg.prev ? "text-emerald-500" : seg.count < seg.prev ? "text-red-500" : "text-gray-400"}`}>
                      {seg.count > seg.prev ? `+${seg.count - seg.prev}` : seg.count < seg.prev ? `${seg.count - seg.prev}` : "="}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2.5">
                  <div className={`${seg.color} h-2.5 rounded-full transition-all`} style={{ width: `${seg.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Segment Movements */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" /> Segment Hareketleri
          </h3>
          <div className="space-y-3">
            {MOVEMENTS.map((mov, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mov.direction === "up" ? "bg-emerald-100 dark:bg-emerald-900" : "bg-red-100 dark:bg-red-900"}`}>
                    {mov.direction === "up"
                      ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      : <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{mov.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{mov.description}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${mov.direction === "up" ? "text-emerald-600" : "text-red-500"}`}>
                  {mov.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Performance */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Send className="h-4 w-4 text-orange-500" /> Kampanya Performansı
          </h3>
          <div className="space-y-3">
            {CAMPAIGN_STATS.map((camp, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{camp.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{camp.sent} gönderim · {camp.responded} cevap</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">%{camp.rate}</p>
                  <p className="text-xs text-gray-400">cevap oranı</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inbound vs Outbound */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" /> Gelen vs Giden İletişim
          </h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{DIRECTION_STATS.inbound.count}</p>
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">Gelen</p>
              <p className="text-xs text-green-600/70">%{DIRECTION_STATS.inbound.pct}</p>
            </div>
            <div className="flex-1 text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{DIRECTION_STATS.outbound.count}</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Giden</p>
              <p className="text-xs text-purple-600/70">%{DIRECTION_STATS.outbound.pct}</p>
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
            <div className="h-full flex">
              <div className="bg-green-500 h-full" style={{ width: `${DIRECTION_STATS.inbound.pct}%` }} />
              <div className="bg-purple-500 h-full" style={{ width: `${DIRECTION_STATS.outbound.pct}%` }} />
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-slate-400">
            <span>Gelen (müşteri başlattı)</span>
            <span>Giden (biz başlattık)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
