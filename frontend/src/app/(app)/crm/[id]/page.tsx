"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, Globe, MessageSquare, Building2, MapPin,
  Edit3, TrendingUp, Calendar, Tag, Send, DollarSign, Package,
  AlertTriangle, Clock, CheckCircle, ShoppingCart, Repeat, Target,
  BarChart3, Star, FileText, Truck, CreditCard, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// ============ FULL DEMO DATA FOR 360 VIEW ============

const DEMO_CONTACTS: Record<string, any> = {
  "1": {
    name: "Anna Morozova", company: "VIPTEX", country: "Rusya", segment: 1,
    fair: "BTK 2025", phone: "+7 905 106 53 53", email: "anna@viptex.ru",
    instagram: "@viptex_official", orders: "8609, 8733",
    // Financial
    cariCode: "120.01.001", creditLimit: 75000, balance: -18500, overdue: 0,
    // Purchase stats
    lifetimeRevenue: 245000, totalOrders: 8, totalMeters: 12400,
    avgOrderValue: 30625, orderCycle: 42, lastOrderDate: "2026-03-20",
    nextOrderEstimate: "2026-05-01", trend: "+15%",
    // Top products
    topProducts: [
      { name: "Krep", meters: 4500, revenue: 97200, pct: 40 },
      { name: "Saten", meters: 3200, revenue: 81600, pct: 33 },
      { name: "Viskon", meters: 2800, revenue: 43400, pct: 18 },
      { name: "Astar", meters: 1900, revenue: 22800, pct: 9 },
    ],
    // Risk & recommendations
    riskScore: 12, riskLabel: "Dusuk", riskColor: "text-emerald-600",
    recommendations: [
      { type: "cross-sell", text: "Kadife henuz denemedi - benzer profildeki musterilerin %60'i aliyor", priority: "high" },
      { type: "upsell", text: "Saten siparislerini 2000m'den 3000m'ye cikarma potansiyeli", priority: "medium" },
      { type: "timing", text: "Siparis dongusu 42 gun - sonraki siparis tahmini 1 Mayis", priority: "info" },
    ],
    // Orders
    orderHistory: [
      { id: "SIP-2026-043", date: "2026-03-27", amount: 48000, items: "Saten 2000m, Krep 1500m, Astar 1000m", status: "Onaylandi", stage: 1 },
      { id: "SIP-2026-040", date: "2026-03-01", amount: 38000, items: "Krep 2000m, Saten 1500m", status: "Teslim Edildi", stage: 7 },
      { id: "SIP-2025-087", date: "2026-01-18", amount: 42000, items: "Saten 1800m, Viskon 1400m, Astar 900m", status: "Teslim Edildi", stage: 7 },
      { id: "SIP-2025-065", date: "2025-11-05", amount: 35000, items: "Krep 1500m, Viskon 1200m", status: "Teslim Edildi", stage: 7 },
      { id: "SIP-2025-041", date: "2025-09-12", amount: 28000, items: "Saten 1200m, Astar 800m", status: "Teslim Edildi", stage: 7 },
    ],
    // Samples
    sampleHistory: [
      { date: "2026-03-10", products: "Saten + Krep + Astar (yeni renkler)", status: "Onaylandi", result: "Siparis verildi ($48,000)" },
      { date: "2026-01-05", products: "Viskon + Saten (kis koleksiyonu)", status: "Onaylandi", result: "Siparis verildi ($42,000)" },
      { date: "2025-08-20", products: "Krep (ilk numune)", status: "Onaylandi", result: "Siparis verildi ($28,000)" },
    ],
  },
  "2": {
    name: "Oleg Petrov", company: "Elena Chezelle", country: "Rusya", segment: 1,
    fair: "VIPTEX 2025", phone: "+7 921 963 88 82", email: "oleg@chezelle.ru",
    instagram: "@elenachezelle", orders: "8601, 7058, 7768",
    cariCode: "120.01.002", creditLimit: 50000, balance: -8200, overdue: 0,
    lifetimeRevenue: 178400, totalOrders: 6, totalMeters: 9800,
    avgOrderValue: 29733, orderCycle: 58, lastOrderDate: "2026-02-15",
    nextOrderEstimate: "2026-04-14", trend: "stabil",
    topProducts: [
      { name: "Krep", meters: 3800, revenue: 82080, pct: 46 },
      { name: "Denim", meters: 2400, revenue: 44640, pct: 25 },
      { name: "Scuba", meters: 2200, revenue: 49800, pct: 23 },
      { name: "Astar", meters: 1400, revenue: 7360, pct: 6 },
    ],
    riskScore: 25, riskLabel: "Dusuk-Orta", riskColor: "text-amber-600",
    recommendations: [
      { type: "timing", text: "58 gunluk siparis dongusu - sonraki beklenen 14 Nisan", priority: "info" },
      { type: "cross-sell", text: "Saten henuz almamis - Krep alicilari genelde Saten de aliyor", priority: "medium" },
    ],
    orderHistory: [
      { id: "SIP-2026-039", date: "2026-02-15", amount: 35000, items: "Krep 1800m, Scuba 1200m", status: "Teslim Edildi", stage: 7 },
      { id: "SIP-2025-078", date: "2025-12-20", amount: 42000, items: "Denim 2400m, Krep 1200m", status: "Teslim Edildi", stage: 7 },
      { id: "SIP-2025-055", date: "2025-10-08", amount: 38400, items: "Krep 1800m, Scuba 1000m, Astar 800m", status: "Teslim Edildi", stage: 7 },
    ],
    sampleHistory: [
      { date: "2026-03-20", products: "Krep + Scuba (yeni renkler)", status: "Degerlendiriliyor", result: "Krep begendi, scuba renk farkli" },
      { date: "2025-12-01", products: "Denim (yeni gramaj)", status: "Onaylandi", result: "Siparis verildi ($42,000)" },
    ],
  },
  "3": {
    name: "Svetlana Sivaeva", company: "Terra", country: "Rusya", segment: 2,
    fair: "VIPTEX 2025", phone: "+7 916 106 03 20", email: "svetlana.terramd@mail.ru",
    instagram: "@terra_fashion", orders: "-",
    cariCode: "-", creditLimit: 0, balance: 0, overdue: 0,
    lifetimeRevenue: 0, totalOrders: 0, totalMeters: 0,
    avgOrderValue: 0, orderCycle: 0, lastOrderDate: "-",
    nextOrderEstimate: "-", trend: "-",
    topProducts: [],
    riskScore: 65, riskLabel: "Yuksek", riskColor: "text-red-600",
    recommendations: [
      { type: "urgent", text: "12 gundur iletisim yok - numune gonderilmeli", priority: "high" },
      { type: "action", text: "Saten + Krep numune paketi hazirla, WhatsApp'tan bildir", priority: "high" },
    ],
    orderHistory: [],
    sampleHistory: [
      { date: "2026-03-23", products: "Saten + Viskon numune", status: "Kargoda", result: "Bekleniyor" },
    ],
  },
  "6": {
    name: "Alexandr", company: "Edit Production", country: "Rusya", segment: 3,
    fair: "VIPTEX 2025", phone: "+7 977 420 48 73", email: "",
    instagram: "@production.edit", orders: "-",
    cariCode: "-", creditLimit: 0, balance: 0, overdue: 0,
    lifetimeRevenue: 0, totalOrders: 0, totalMeters: 0,
    avgOrderValue: 0, orderCycle: 0, lastOrderDate: "-",
    nextOrderEstimate: "-", trend: "-",
    topProducts: [],
    riskScore: 80, riskLabel: "Cok Yuksek", riskColor: "text-red-600",
    recommendations: [
      { type: "urgent", text: "Buyuk firma ama 17 gundur iletisim yok", priority: "high" },
      { type: "action", text: "Alternatif kanal dene: telefon veya email", priority: "high" },
      { type: "info", text: "Instagram'dan 2 kez yazildi, goruldu ama cevap gelmedi", priority: "medium" },
    ],
    orderHistory: [],
    sampleHistory: [],
  },
};

const segmentLabels: Record<number, string> = {
  1: "Satis + Iletisim", 2: "Iletisim Var, Satis Yok", 3: "Buyuk Firma, Ulasilamiyor", 4: "Normal Firma, Ulasilamiyor"
};
const segmentColors: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  3: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  4: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const DEMO_TIMELINE = [
  { type: "order", date: "27 Mar 2026", author: "Sistem", content: "Yeni siparis: SIP-2026-043 - $48,000 (Saten 2000m, Krep 1500m, Astar 1000m)" },
  { type: "note", date: "25 Mar 2026", author: "Ahmet Y.", content: "Teklif onaylandi. Siparis olusturuldu. Uretim bu hafta basliyor." },
  { type: "quote", date: "24 Mar 2026", author: "Ahmet Y.", content: "Fiyat teklifi gonderildi: $48,000 (4500m toplam, %10 iskonto)" },
  { type: "sample", date: "18 Mar 2026", author: "Sistem", content: "Numune teslim edildi. Musteri degerlendirme surecinde." },
  { type: "note", date: "15 Mar 2026", author: "Ahmet Y.", content: "Yeni sezon numuneleri gonderildi. 3 model begendi, siparis hazirlaniyor." },
  { type: "segment", date: "20 Mar 2026", author: "Sistem", content: "Segment degisikligi: 2 → 1 (Iletisim Var → Satis + Iletisim)", from: 2, to: 1 },
  { type: "campaign", date: "18 Mar 2026", author: "Kampanya", content: "\"Yeni Sezon Tanitimi\" kampanyasi gonderildi — Cevap: Soru sordu, numune istedi" },
  { type: "shipment", date: "15 Mar 2026", author: "Sistem", content: "SIP-2026-040 teslim edildi. DHL TR-871625. Imzalayan: Anna M." },
  { type: "note", date: "12 Mar 2026", author: "Mehmet K.", content: "WhatsApp uzerinden arandi, fiyat listesi gonderildi. Ilgilendigini belirtti." },
  { type: "message", date: "10 Mar 2026", author: "Musteri", content: "\"Hello, we are interested in your new collection. Can you send us samples?\"", channel: "WhatsApp" },
  { type: "note", date: "5 Mar 2026", author: "Ahmet Y.", content: "Fuarda tanistik, kartvizit aldik. VIPTEX fuarindan. Buyuk firma, potansiyeli yuksek." },
  { type: "segment", date: "5 Mar 2026", author: "Sistem", content: "Musteri olusturuldu, Segment: 2 (Iletisim Var, Satis Yok)", from: 0, to: 2 },
];

const DEMO_CONVERSATIONS = [
  { id: 1, channel: "WhatsApp", date: "25 Mar 2026", lastMsg: "Teklifi onayliyorum, siparisi olusturabilirsiniz", direction: "inbound", status: "open" },
  { id: 2, channel: "WhatsApp", date: "22 Mar 2026", lastMsg: "Numuneler kargoya verildi, takip numarasi: TR923847", direction: "outbound", status: "resolved" },
  { id: 3, channel: "Instagram", date: "18 Mar 2026", lastMsg: "Thank you for the catalog!", direction: "inbound", status: "resolved" },
  { id: 4, channel: "Email", date: "10 Mar 2026", lastMsg: "Price list attached", direction: "outbound", status: "resolved" },
];

const timelineIcons: Record<string, { icon: string; color: string }> = {
  note: { icon: "N", color: "bg-blue-500" },
  segment: { icon: "S", color: "bg-purple-500" },
  campaign: { icon: "K", color: "bg-orange-500" },
  message: { icon: "M", color: "bg-green-500" },
  order: { icon: "$", color: "bg-emerald-600" },
  quote: { icon: "T", color: "bg-violet-500" },
  sample: { icon: "N", color: "bg-pink-500" },
  shipment: { icon: "S", color: "bg-cyan-500" },
};

type TabKey = "overview" | "timeline" | "orders" | "products" | "notes";

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [newNote, setNewNote] = useState("");

  const contact = DEMO_CONTACTS[id as string] || DEMO_CONTACTS["1"];
  const tabs = [
    { key: "overview" as TabKey, label: "360 Ozet" },
    { key: "timeline" as TabKey, label: "Zaman Cizelgesi" },
    { key: "orders" as TabKey, label: "Siparisler" },
    { key: "products" as TabKey, label: "Urun Analizi" },
    { key: "notes" as TabKey, label: "Notlar" },
  ];

  const orderStages = ["Onaylandi", "Uretim", "Kalite", "Paket", "Hazir", "Kargo", "Teslim"];

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto animate-fade-in">
      {/* Back */}
      <button onClick={() => router.push("/crm")} className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Musteri Listesi
      </button>

      {/* Contact Header */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5 mb-4">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-blue-600/20 flex-shrink-0">
            {contact.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{contact.name}</h1>
              <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-[11px] font-semibold ${segmentColors[contact.segment]}`}>
                S{contact.segment} — {segmentLabels[contact.segment]}
              </span>
              {contact.riskScore > 50 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-[10px] font-bold">
                  <AlertTriangle className="h-3 w-3" /> Risk: {contact.riskLabel}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {contact.company}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {contact.country}</span>
              <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {contact.fair}</span>
              {contact.lifetimeRevenue > 0 && (
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <DollarSign className="h-3.5 w-3.5" /> ${contact.lifetimeRevenue.toLocaleString()} toplam
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-slate-800 rounded-lg text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <Phone className="h-3 w-3" /> {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-slate-800 rounded-lg text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <Mail className="h-3 w-3" /> {contact.email}
                </a>
              )}
              {contact.instagram && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-slate-800 rounded-lg text-xs text-gray-600 dark:text-slate-300">
                  <Globe className="h-3 w-3" /> {contact.instagram}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
              <Edit3 className="h-3.5 w-3.5" /> Duzenle
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-medium shadow-md hover:shadow-lg transition-all">
              <Send className="h-3.5 w-3.5" /> Mesaj Gonder
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-5 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== 360 OZET ==================== */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Financial + Stats KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[10px] text-gray-400">Toplam Gelir</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">${contact.lifetimeRevenue.toLocaleString()}</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ShoppingCart className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] text-gray-400">Siparis</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{contact.totalOrders}</p>
              <p className="text-[10px] text-gray-400">{contact.totalMeters.toLocaleString()}m</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-[10px] text-gray-400">Ort. Siparis</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">${contact.avgOrderValue.toLocaleString()}</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Repeat className="h-3.5 w-3.5 text-pink-500" />
                <span className="text-[10px] text-gray-400">Siparis Dongusu</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{contact.orderCycle || "-"}</p>
              <p className="text-[10px] text-gray-400">gun</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] text-gray-400">Cari Bakiye</span>
              </div>
              <p className={`text-lg font-bold ${contact.balance < 0 ? "text-red-600" : "text-gray-900 dark:text-white"}`}>
                {contact.balance < 0 ? `-$${Math.abs(contact.balance).toLocaleString()}` : contact.balance === 0 ? "$0" : `$${contact.balance.toLocaleString()}`}
              </p>
              {contact.creditLimit > 0 && <p className="text-[10px] text-gray-400">Limit: ${contact.creditLimit.toLocaleString()}</p>}
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-cyan-500" />
                <span className="text-[10px] text-gray-400">Sonraki Siparis</span>
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{contact.nextOrderEstimate !== "-" ? contact.nextOrderEstimate.slice(5) : "-"}</p>
              {contact.trend !== "-" && <p className={`text-[10px] ${contact.trend.includes("+") ? "text-emerald-600" : "text-gray-400"}`}>{contact.trend}</p>}
            </div>
          </div>

          {/* Recommendations + Risk */}
          {contact.recommendations && contact.recommendations.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Oneriler ve Aksiyonlar
              </h3>
              <div className="space-y-2">
                {contact.recommendations.map((rec: any, i: number) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                    rec.priority === "high" ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900" :
                    rec.priority === "medium" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900" :
                    "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900"
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      rec.priority === "high" ? "bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200" :
                      rec.priority === "medium" ? "bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200" :
                      "bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200"
                    }`}>
                      {rec.type === "cross-sell" ? "CS" : rec.type === "upsell" ? "UP" : rec.type === "urgent" ? "!" : rec.type === "action" ? "A" : "i"}
                    </div>
                    <p className="text-xs text-gray-700 dark:text-slate-300">{rec.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Products */}
          {contact.topProducts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-500" />
                  En Cok Alinan Urunler
                </h3>
                <div className="space-y-3">
                  {contact.topProducts.map((p: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-slate-300">{p.name}</span>
                        <span className="text-gray-500">{p.meters.toLocaleString()}m — ${p.revenue.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all" style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders Quick View */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-500" />
                  Son Siparisler
                </h3>
                <div className="space-y-2">
                  {contact.orderHistory.slice(0, 4).map((o: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                      <div className={`w-2 h-8 rounded-full ${o.stage === 7 ? "bg-emerald-400" : "bg-blue-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-900 dark:text-white">{o.id}</span>
                          <span className="text-xs font-bold text-emerald-600">${o.amount.toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{o.items}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${o.stage === 7 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"}`}>
                        {o.status}
                      </span>
                    </div>
                  ))}
                  {contact.orderHistory.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Henuz siparis yok</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sample History Quick */}
          {contact.sampleHistory.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-pink-500" />
                Numune Gecmisi
              </h3>
              <div className="space-y-2">
                {contact.sampleHistory.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                    <div className={`w-2 h-8 rounded-full ${s.status === "Onaylandi" ? "bg-emerald-400" : s.status === "Degerlendiriliyor" ? "bg-amber-400" : "bg-blue-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white">{s.products}</p>
                      <p className="text-[10px] text-gray-500">{s.result}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        s.status === "Onaylandi" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" :
                        s.status === "Degerlendiriliyor" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" :
                        "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      }`}>
                        {s.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversations */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              Son Konusmalar
            </h3>
            <div className="space-y-2">
              {DEMO_CONVERSATIONS.map(conv => (
                <div key={conv.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                  <span className="text-xs font-medium text-gray-900 dark:text-white w-20">{conv.channel}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${conv.direction === "inbound" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                    {conv.direction === "inbound" ? "Gelen" : "Giden"}
                  </span>
                  <p className="flex-1 text-xs text-gray-500 truncate">{conv.lastMsg}</p>
                  <span className="text-[10px] text-gray-400">{conv.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ZAMAN CIZELGESI ==================== */}
      {activeTab === "timeline" && (
        <div className="space-y-3">
          {DEMO_TIMELINE.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${timelineIcons[item.type]?.color || "bg-gray-400"}`}>
                  {timelineIcons[item.type]?.icon || "?"}
                </div>
                {i < DEMO_TIMELINE.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 dark:bg-slate-700 mt-1" />}
              </div>
              <div className="flex-1 pb-4">
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-gray-500">{item.author}</span>
                    <span className="text-[10px] text-gray-400">{item.date}</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-slate-300">{item.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== SIPARISLER ==================== */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {contact.orderHistory.length === 0 ? (
            <div className="card p-8 text-center">
              <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Henuz siparis yok</p>
              <p className="text-xs text-gray-400 mt-1">Numune gondererek satisa donusturmeyi deneyin</p>
            </div>
          ) : (
            contact.orderHistory.map((order: any, i: number) => (
              <div key={i} className="card p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{order.id}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${order.stage === 7 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{order.items}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">{order.date}</span>
                    <span className="text-sm font-bold text-emerald-600">${order.amount.toLocaleString()}</span>
                  </div>
                </div>
                {/* Stage Progress */}
                <div className="flex items-center gap-1">
                  {orderStages.map((stage, si) => (
                    <div key={si} className="flex-1">
                      <div className={`h-1.5 rounded-full ${si < order.stage ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-700"}`} />
                      <p className="text-[8px] text-gray-400 mt-0.5 text-center">{stage}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ==================== URUN ANALIZI ==================== */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {contact.topProducts.length === 0 ? (
            <div className="card p-8 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Henuz urun satisi yok</p>
            </div>
          ) : (
            <>
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Urun Bazli Satis Dagilimi</h3>
                <div className="space-y-4">
                  {contact.topProducts.map((p: any, i: number) => {
                    const colors = ["from-blue-500 to-indigo-500", "from-emerald-500 to-teal-500", "from-violet-500 to-purple-500", "from-amber-500 to-orange-500"];
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${colors[i % colors.length]}`} />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-gray-500">{p.meters.toLocaleString()}m</span>
                            <span className="font-bold text-gray-900 dark:text-white">${p.revenue.toLocaleString()}</span>
                            <span className="text-gray-400">%{p.pct}</span>
                          </div>
                        </div>
                        <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r ${colors[i % colors.length]} transition-all duration-700`} style={{ width: `${p.pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cross-sell Opportunities */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Cross-sell Firsatlari</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {["Kadife", "Scuba", "Denim"].filter(p => !contact.topProducts.some((tp: any) => tp.name === p)).map((product, i) => (
                    <div key={i} className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{product}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Benzer profildeki musterilerin %{55 + i * 8}'i aliyor</p>
                      <button className="mt-2 text-[10px] font-medium text-amber-600 hover:text-amber-700">Numune Onerisi Gonder →</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== NOTLAR ==================== */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Haftalik gelisim notu ekle..."
              className="w-full border-0 bg-transparent text-sm text-gray-700 dark:text-slate-300 placeholder-gray-400 resize-none focus:ring-0 min-h-[80px]" />
            <div className="flex justify-end mt-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">Not Ekle</button>
            </div>
          </div>
          {DEMO_TIMELINE.filter(t => t.type === "note").map((note, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{note.author}</span>
                <span className="text-xs text-gray-400">{note.date}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-slate-400">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
