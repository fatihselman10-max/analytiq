"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg } from "@/lib/demo-data";
import {
  Package, Truck, CheckCircle, Clock, AlertTriangle, DollarSign,
  ArrowRight, TrendingUp, BarChart3, Users, Calendar, MessageSquare,
  XCircle, Star,
} from "lucide-react";

const PIPELINE_STAGES = [
  { key: "requested", label: "Talep Alindi", color: "bg-gray-500", headerBg: "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700" },
  { key: "preparing", label: "Hazirlaniyor", color: "bg-amber-500", headerBg: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700" },
  { key: "shipped", label: "Kargoda", color: "bg-blue-500", headerBg: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700" },
  { key: "delivered", label: "Teslim Edildi", color: "bg-purple-500", headerBg: "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700" },
  { key: "completed", label: "Sonuclandi", color: "bg-emerald-500", headerBg: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700" },
];

const DEMO_SAMPLES = [
  // Talep Alindi
  { id: 1, stage: "requested", customer: "Ludmila Tetsko", company: "Ludmila Atelier", products: "Premium Saten (6 renk karti)", date: "25 Mar", channel: "WhatsApp", assignee: "Mehmet K.", cost: "Ucretsiz (1. numune)", daysInStage: 2, note: "" },
  { id: 2, stage: "requested", customer: "Yeni lead (BTK)", company: "Bilinmiyor", products: "Scuba + Denim numune", date: "26 Mar", channel: "Email", assignee: "Ahmet Y.", cost: "Ucretsiz", daysInStage: 1, note: "Fuar sonrasi talep" },
  // Hazirlaniyor
  { id: 3, stage: "preparing", customer: "Nadezdha Akulshina", company: "Tom Klaim", products: "Viskon 3 renk + Pamuk Poplin 2 renk", date: "25 Mar", channel: "WhatsApp", assignee: "Ahmet Y.", cost: "Ucretsiz", daysInStage: 2, note: "5 adet numune kesiliyor, yarin kargoya verilecek" },
  { id: 4, stage: "preparing", customer: "Olesya Petrova", company: "Nextex", products: "Saten 4 renk + Krep 3 renk", date: "24 Mar", channel: "Telegram", assignee: "Mehmet K.", cost: "Ucretsiz (2. numune)", daysInStage: 3, note: "Renk secimi tamamlandi, kesim yapiliyor" },
  // Kargoda
  { id: 5, stage: "shipped", customer: "Svetlana Sivaeva", company: "Terra", products: "Premium Saten 3 renk + Viskon 2 renk", date: "23 Mar", channel: "WhatsApp", assignee: "Ahmet Y.", cost: "Ucretsiz", daysInStage: 4, note: "DHL TR-834721 - Tahmini: 27 Mar", tracking: "TR-834721" },
  { id: 6, stage: "shipped", customer: "Sergei Novikov", company: "Novikov Textile", products: "Kadife + Triko numune", date: "22 Mar", channel: "Email", assignee: "Mehmet K.", cost: "$25 (4. numune)", daysInStage: 5, note: "TNT TR-192837", tracking: "TR-192837" },
  // Teslim Edildi
  { id: 7, stage: "delivered", customer: "Anna Morozova", company: "VIPTEX", products: "Saten + Krep + Astar (yeni renkler)", date: "18 Mar", channel: "WhatsApp", assignee: "Ahmet Y.", cost: "Ucretsiz", daysInStage: 9, note: "Degerlendirme bekleniyor", urgent: true, feedback: "" },
  { id: 8, stage: "delivered", customer: "Oleg Petrov", company: "Elena Chezelle", products: "Krep + Scuba (yeni renkler)", date: "20 Mar", channel: "Telegram", assignee: "Mehmet K.", cost: "Ucretsiz", daysInStage: 7, note: "", feedback: "Krep begendi, scuba renk farkli - alternatif istendi" },
  { id: 9, stage: "delivered", customer: "Kristina Boutique", company: "Kristina Boutique", products: "Saten + Sifon + Viskon", date: "15 Mar", channel: "WhatsApp", assignee: "Mehmet K.", cost: "Ucretsiz", daysInStage: 0, note: "TAMAMEN ONAYLADI", feedback: "Hepsi begendi, siparis verdi" },
  // Sonuclandi
  { id: 10, stage: "completed", customer: "Kristina Boutique", company: "Kristina Boutique", products: "Saten + Sifon + Viskon", result: "success", resultText: "Siparis verildi - $32,500", date: "22 Mar" },
  { id: 11, stage: "completed", customer: "Irina Kurganova", company: "Kurganova Moda", products: "Viskon + Pamuk Poplin", result: "success", resultText: "Siparis verildi - $27,500", date: "21 Mar" },
  { id: 12, stage: "completed", customer: "Tatiana Perni", company: "Tatiana Design", products: "Saten + Krep", result: "failed", resultText: "Vazgecti - Butce kisitli, gelecek sezon", date: "24 Mar" },
];

export default function SamplesPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization) return;
    setLoading(false);
  }, [organization]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  const successCount = DEMO_SAMPLES.filter(s => s.stage === "completed" && s.result === "success").length;
  const totalCompleted = DEMO_SAMPLES.filter(s => s.stage === "completed").length;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Numune Takibi</h1>
        <p className="text-sm text-gray-500 mt-1">Numune talepleri, gonderim ve donusum sureci</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Package className="h-3.5 w-3.5 text-blue-500" /><span className="text-[10px] text-gray-400">Aktif Numune</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{DEMO_SAMPLES.filter(s => !["completed"].includes(s.stage)).length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /><span className="text-[10px] text-gray-400">Degerlendirme Bekleyen</span></div>
          <p className="text-xl font-bold text-amber-600">{DEMO_SAMPLES.filter(s => s.stage === "delivered").length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Truck className="h-3.5 w-3.5 text-indigo-500" /><span className="text-[10px] text-gray-400">Bu Ay Gonderilen</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">12</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /><span className="text-[10px] text-gray-400">Donusum</span></div>
          <p className="text-xl font-bold text-emerald-600">%{totalCompleted > 0 ? ((successCount / totalCompleted) * 100).toFixed(0) : 0}</p>
          <p className="text-[10px] text-gray-400">{successCount}/{totalCompleted}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><DollarSign className="h-3.5 w-3.5 text-green-500" /><span className="text-[10px] text-gray-400">Donusum Geliri</span></div>
          <p className="text-xl font-bold text-emerald-600">$60K</p>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[1200px]">
          {PIPELINE_STAGES.map(stg => {
            const items = DEMO_SAMPLES.filter(s => s.stage === stg.key);
            return (
              <div key={stg.key} className="flex-1 min-w-[220px]">
                {/* Column Header */}
                <div className={`rounded-xl p-3 mb-3 border ${stg.headerBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${stg.color}`} />
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{stg.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.map(sample => (
                    <div key={sample.id} className={`card p-3 border-l-4 ${
                      (sample as any).urgent ? "border-l-red-500" :
                      (sample as any).result === "success" ? "border-l-emerald-500" :
                      (sample as any).result === "failed" ? "border-l-red-400" :
                      `border-l-transparent`
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {sample.customer.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{sample.customer}</p>
                          <p className="text-[10px] text-gray-400 truncate">{sample.company}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-slate-400 mb-2">{sample.products}</p>

                      {stg.key === "completed" ? (
                        <div className={`p-2 rounded-lg text-[10px] font-semibold ${
                          (sample as any).result === "success" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                        }`}>
                          {(sample as any).result === "success" ? "✓" : "✗"} {(sample as any).resultText}
                        </div>
                      ) : (
                        <>
                          {(sample as any).note && (
                            <p className="text-[10px] text-gray-500 italic mb-1.5">{(sample as any).note}</p>
                          )}
                          {(sample as any).feedback && (
                            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-[10px] text-amber-700 dark:text-amber-300 mb-1.5">
                              Geri bildirim: {(sample as any).feedback}
                            </div>
                          )}
                          {(sample as any).urgent && (
                            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-[10px] text-red-600 dark:text-red-400 font-semibold mb-1.5 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {(sample as any).daysInStage} gundur degerlendirme bekleniyor
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                            <span>{sample.date}</span>
                            <span>{(sample as any).assignee}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-gray-400">{(sample as any).cost}</span>
                            {(sample as any).daysInStage > 0 && stg.key !== "completed" && (
                              <span className={`text-[10px] font-medium ${(sample as any).daysInStage > 7 ? "text-red-500" : "text-gray-400"}`}>
                                {(sample as any).daysInStage} gun
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Tracking + Conversion Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500" /> Numune Maliyet Takibi
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left py-1.5 text-gray-400">Musteri</th>
                <th className="text-center py-1.5 text-gray-400">Ucretsiz</th>
                <th className="text-center py-1.5 text-gray-400">Ucretli</th>
                <th className="text-right py-1.5 text-gray-400">Donusum</th>
              </tr></thead>
              <tbody>
                {[
                  { name: "Anna Morozova", free: 3, paid: 0, converted: true, revenue: "$245K" },
                  { name: "Oleg Petrov", free: 2, paid: 1, converted: true, revenue: "$178K" },
                  { name: "Kristina Boutique", free: 1, paid: 0, converted: true, revenue: "$32.5K" },
                  { name: "Irina Kurganova", free: 2, paid: 0, converted: true, revenue: "$27.5K" },
                  { name: "Svetlana Sivaeva", free: 1, paid: 0, converted: false, revenue: "-" },
                  { name: "Nadezdha Akulshina", free: 1, paid: 0, converted: false, revenue: "-" },
                ].map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-slate-800">
                    <td className="py-2 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="py-2 text-center text-gray-500">{c.free}</td>
                    <td className="py-2 text-center text-gray-500">{c.paid > 0 ? c.paid : "-"}</td>
                    <td className="py-2 text-right">
                      {c.converted ? <span className="text-emerald-600 font-bold">{c.revenue}</span> : <span className="text-gray-400">Bekliyor</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">Toplam maliyet: $375 (15 ucretli numune)</span>
            <span className="font-bold text-emerald-600">ROI: 160x</span>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" /> Numune → Siparis Sureci
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Ortalama donusum suresi</span>
                <span className="font-bold text-gray-900 dark:text-white">14 gun</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500" style={{ width: "50%" }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
                <p className="text-[10px] text-gray-400">En hizli donusum</p>
                <p className="text-sm font-bold text-emerald-600">7 gun</p>
                <p className="text-[10px] text-gray-500">Kristina Boutique</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                <p className="text-[10px] text-gray-400">En yavas donusum</p>
                <p className="text-sm font-bold text-amber-600">28 gun</p>
                <p className="text-[10px] text-gray-500">Irina Kurganova</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-2">Asama bazli ortalama sure</p>
              <div className="flex items-center gap-1">
                {[
                  { label: "Talep", days: 1, color: "bg-gray-400" },
                  { label: "Hazirlik", days: 2, color: "bg-amber-400" },
                  { label: "Kargo", days: 5, color: "bg-blue-400" },
                  { label: "Degerlendirme", days: 4, color: "bg-purple-400" },
                  { label: "Karar", days: 2, color: "bg-emerald-400" },
                ].map((st, i) => (
                  <div key={i} className="flex-1">
                    <div className={`h-6 rounded-lg ${st.color} flex items-center justify-center`}>
                      <span className="text-white text-[9px] font-bold">{st.days}g</span>
                    </div>
                    <p className="text-[8px] text-gray-400 text-center mt-0.5">{st.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
