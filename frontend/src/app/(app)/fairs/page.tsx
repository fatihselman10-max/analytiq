"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg } from "@/lib/demo-data";
import {
  Users, MapPin, Calendar, Target, TrendingUp, DollarSign,
  CheckCircle, Clock, AlertTriangle, Phone, Mail, Globe,
  ArrowUpRight, BarChart3, Star, FileText, Camera, UserPlus,
} from "lucide-react";

const DEMO_FAIRS = [
  {
    id: 1, name: "VIPTEX 2025", location: "Istanbul, Turkiye", date: "15-18 Ocak 2025",
    status: "completed",
    stats: { contacts: 22, converted: 7, rate: 31.8, revenue: 298000, samples: 14, meetings: 18 },
    investment: { booth: 8500, travel: 3200, materials: 2800, total: 14500 },
    roi: 1955,
    topLeads: [
      { name: "Anna Morozova", company: "VIPTEX", segment: 1, result: "Musteri oldu - $245K toplam", status: "won" },
      { name: "Oleg Petrov", company: "Elena Chezelle", segment: 1, result: "Musteri oldu - $178K toplam", status: "won" },
      { name: "Alexandr", company: "Edit Production", segment: 3, result: "Buyuk firma - iletisim kurulamiyor", status: "stuck" },
      { name: "Svetlana Sivaeva", company: "Terra", segment: 2, result: "Iletisim var, henuz siparis yok", status: "pending" },
    ],
    notes: "En basarili fuarimiz. Stand C-14'te yerdik. Rus musteri yogunlugu cok yuksekti. Saten ve Krep numuneleri en cok ilgi gordu.",
  },
  {
    id: 2, name: "BTK 2025", location: "Istanbul, Turkiye", date: "5-8 Subat 2025",
    status: "completed",
    stats: { contacts: 12, converted: 3, rate: 25.0, revenue: 112500, samples: 8, meetings: 10 },
    investment: { booth: 6000, travel: 1500, materials: 2200, total: 9700 },
    roi: 1060,
    topLeads: [
      { name: "Kristina Boutique", company: "Kristina Boutique", segment: 1, result: "Hizli donusum - $96K", status: "won" },
      { name: "Irina Kurganova", company: "Kurganova Moda", segment: 1, result: "2 siparis - $42K", status: "won" },
      { name: "Nadezdha Akulshina", company: "Tom Klaim", segment: 2, result: "Numune asamasinda", status: "pending" },
    ],
    notes: "Anna Morozova buradan geldi. BTK'da kadin giyim ureticileri daha yogun. Viskon ve Pamuk Poplin ilgi gordu.",
  },
  {
    id: 3, name: "TS 2025", location: "Istanbul, Turkiye", date: "20-22 Mart 2025",
    status: "completed",
    stats: { contacts: 13, converted: 2, rate: 15.4, revenue: 77000, samples: 6, meetings: 8 },
    investment: { booth: 5500, travel: 1200, materials: 1800, total: 8500 },
    roi: 806,
    topLeads: [
      { name: "Ludmila Tetsko", company: "Ludmila Atelier", segment: 2, result: "Renk secimi bekleniyor", status: "pending" },
      { name: "Tatiana Perni", company: "Tatiana Design", segment: 4, result: "Butce kisitli - vazgecti", status: "lost" },
    ],
    notes: "TS fuari daha kucuk olcekli. Donusum orani dusuk ama kaliteli leadler var. Kadife ve Triko ilgi gordu.",
  },
  {
    id: 4, name: "VIPTEX 2026", location: "Istanbul, Turkiye", date: "14-17 Ocak 2026",
    status: "upcoming",
    stats: { contacts: 0, converted: 0, rate: 0, revenue: 0, samples: 0, meetings: 0 },
    investment: { booth: 9000, travel: 3500, materials: 3000, total: 15500 },
    roi: 0,
    preparation: {
      targetContacts: 30,
      targetMeetings: 20,
      boothReserved: true,
      materialsReady: false,
      teamAssigned: ["Ahmet Y.", "Mehmet K."],
      goals: [
        "Mevcut Segment 2 musterilerle yuz yuze gorusme",
        "En az 15 yeni lead toplama",
        "Kadife ve Triko koleksiyonunu tanitma",
        "Minimum 5 yerinde numune dagitimi",
      ],
      todoList: [
        { task: "Stand tasarimi onaylama", done: true, assignee: "Ahmet Y." },
        { task: "Rusca brosur basimi (500 adet)", done: true, assignee: "Mehmet K." },
        { task: "Numune koleksiyonu hazirlama (her urun 3 renk)", done: false, assignee: "Ahmet Y." },
        { task: "Musteri randevu plani olusturma", done: false, assignee: "Mehmet K." },
        { task: "Kartvizit basimi (1000 adet, Turkce/Rusca)", done: true, assignee: "Fatma D." },
        { task: "Otel ve transfer rezervasyonu (ekip 4 kisi)", done: false, assignee: "Fatma D." },
        { task: "Dijital katalog QR kodu hazirlama", done: true, assignee: "Ahmet Y." },
      ],
    },
    topLeads: [],
    notes: "VIPTEX 2026 icin hedef: 30 yeni temas, $150K potansiyel pipeline. Stand C-14 tekrar rezerve edildi.",
  },
];

const statusColors: Record<string, string> = {
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  stuck: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

export default function FairsPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [selectedFair, setSelectedFair] = useState<number | null>(null);

  useEffect(() => {
    if (!organization) return;
    setLoading(false);
  }, [organization]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  const fair = selectedFair !== null ? DEMO_FAIRS.find(f => f.id === selectedFair) : null;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Fuar Yonetimi</h1>
        <p className="text-sm text-gray-500 mt-1">Fuar planlama, musteri toplama ve donusum takibi</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Calendar className="h-3.5 w-3.5 text-indigo-500" /><span className="text-[10px] text-gray-400">Toplam Fuar</span></div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">3</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Users className="h-3.5 w-3.5 text-blue-500" /><span className="text-[10px] text-gray-400">Toplam Temas</span></div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">47</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Target className="h-3.5 w-3.5 text-emerald-500" /><span className="text-[10px] text-gray-400">Donusum</span></div>
          <p className="text-lg font-bold text-emerald-600">12 (%25.5)</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><DollarSign className="h-3.5 w-3.5 text-green-500" /><span className="text-[10px] text-gray-400">Toplam Gelir</span></div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">$487K</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><BarChart3 className="h-3.5 w-3.5 text-amber-500" /><span className="text-[10px] text-gray-400">Yatirim</span></div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">$32.7K</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="h-3.5 w-3.5 text-pink-500" /><span className="text-[10px] text-gray-400">Ort. ROI</span></div>
          <p className="text-lg font-bold text-emerald-600">%1274</p>
        </div>
      </div>

      {!fair ? (
        <>
          {/* Upcoming Fair Banner */}
          {DEMO_FAIRS.filter(f => f.status === "upcoming").map(uf => (
            <div key={uf.id} className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-full">YAKLASAN</span>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{uf.name}</h2>
                  </div>
                  <p className="text-sm text-gray-500">{uf.date} - {uf.location}</p>
                </div>
                <button onClick={() => setSelectedFair(uf.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all">
                  Detay & Hazirlik
                </button>
              </div>
              {uf.preparation && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-1">Hedef Temas</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{uf.preparation.targetContacts}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-1">Stand</p>
                    <p className="text-sm font-bold text-emerald-600">{uf.preparation.boothReserved ? "Rezerve" : "Beklemede"}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-1">Ekip</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{uf.preparation.teamAssigned.join(", ")}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-1">Hazirlik</p>
                    <p className="text-sm font-bold text-amber-600">{uf.preparation.todoList.filter(t => t.done).length}/{uf.preparation.todoList.length} tamamlandi</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Fair Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {DEMO_FAIRS.filter(f => f.status === "completed").map(f => (
              <div key={f.id} className="card p-5 cursor-pointer hover:border-blue-200 dark:hover:border-blue-800 transition-all" onClick={() => setSelectedFair(f.id)}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{f.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-500">{f.date.split(" ")[0]} {f.date.split(" ")[1]}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{f.stats.contacts}</p>
                    <p className="text-[10px] text-gray-400">Temas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">{f.stats.converted}</p>
                    <p className="text-[10px] text-gray-400">Donusum</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">${(f.stats.revenue / 1000).toFixed(0)}K</p>
                    <p className="text-[10px] text-gray-400">Gelir</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex-1 mr-3">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${f.stats.rate}%` }} />
                  </div>
                  <span className="text-xs font-bold text-emerald-600">%{f.stats.rate.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] text-gray-400">Yatirim: ${f.investment.total.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-emerald-600">ROI: %{f.roi}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Fair Detail */}
          <button onClick={() => setSelectedFair(null)} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1">
            ← Tum Fuarlar
          </button>

          <div className="card p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{fair.name}</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${fair.status === "upcoming" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" : "bg-gray-100 text-gray-500"}`}>
                    {fair.status === "upcoming" ? "YAKLASAN" : "TAMAMLANDI"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{fair.date} - {fair.location}</p>
              </div>
            </div>

            {/* Stats */}
            {fair.status === "completed" && (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{fair.stats.contacts}</p>
                  <p className="text-[10px] text-gray-400">Temas</p>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-center">
                  <p className="text-lg font-bold text-emerald-600">{fair.stats.converted}</p>
                  <p className="text-[10px] text-gray-400">Donusum</p>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">${(fair.stats.revenue / 1000).toFixed(0)}K</p>
                  <p className="text-[10px] text-gray-400">Gelir</p>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{fair.stats.samples}</p>
                  <p className="text-[10px] text-gray-400">Numune</p>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{fair.stats.meetings}</p>
                  <p className="text-[10px] text-gray-400">Gorusme</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                  <p className="text-lg font-bold text-emerald-600">%{fair.roi}</p>
                  <p className="text-[10px] text-gray-400">ROI</p>
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Fair Preparation */}
          {fair.status === "upcoming" && fair.preparation && (
            <>
              <div className="card p-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" /> Hedefler
                </h3>
                <div className="space-y-2">
                  {fair.preparation.goals.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20">
                      <div className="w-5 h-5 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300">{i + 1}</div>
                      <p className="text-xs text-gray-700 dark:text-slate-300">{g}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" /> Hazirlik Listesi
                </h3>
                <div className="space-y-2">
                  {fair.preparation.todoList.map((t, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${t.done ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900" : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${t.done ? "bg-emerald-500" : "border-2 border-gray-300 dark:border-slate-600"}`}>
                        {t.done && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`text-xs flex-1 ${t.done ? "text-gray-500 line-through" : "text-gray-900 dark:text-white font-medium"}`}>{t.task}</span>
                      <span className="text-[10px] text-gray-400">{t.assignee}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(fair.preparation.todoList.filter(t => t.done).length / fair.preparation.todoList.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500">{fair.preparation.todoList.filter(t => t.done).length}/{fair.preparation.todoList.length}</span>
                </div>
              </div>
            </>
          )}

          {/* Top Leads */}
          {fair.topLeads.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" /> Onemli Leadler
              </h3>
              <div className="space-y-2">
                {fair.topLeads.map((lead, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {lead.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{lead.name}</span>
                        <span className="text-xs text-gray-400">({lead.company})</span>
                      </div>
                      <p className="text-[10px] text-gray-500">{lead.result}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColors[lead.status]}`}>
                      {lead.status === "won" ? "Kazanildi" : lead.status === "pending" ? "Devam Ediyor" : lead.status === "stuck" ? "Takilda" : "Kaybedildi"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Fuar Notlari</h3>
            <p className="text-xs text-gray-600 dark:text-slate-400">{fair.notes}</p>
          </div>

          {/* Investment Breakdown */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Yatirim Detayi</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800">
                <p className="text-[10px] text-gray-400">Stand</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">${fair.investment.booth.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800">
                <p className="text-[10px] text-gray-400">Seyahat</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">${fair.investment.travel.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800">
                <p className="text-[10px] text-gray-400">Materyal</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">${fair.investment.materials.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-[10px] text-gray-400">Toplam</p>
                <p className="text-sm font-bold text-emerald-600">${fair.investment.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
