"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg } from "@/lib/demo-data";
import {
  TrendingUp, DollarSign, Users, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Target, Repeat, Clock,
  CheckCircle, XCircle, BarChart3, PieChart,
  AlertTriangle, FileText, MessageSquare, Phone,
  UserCheck, Eye, ChevronRight, Calendar,
  ClipboardCheck, AlertCircle, Star, Activity,
} from "lucide-react";

// ============ DEMO DATA ============

const DEMO_SALES = {
  summary: {
    totalRevenue: 487500,
    monthlyRevenue: 142300,
    avgOrderValue: 8750,
    conversionRate: 26.7,
    activeDeals: 8,
    wonDeals: 12,
    lostDeals: 5,
    totalCustomers: 15,
    repeatCustomers: 4,
    avgDealCycle: 18,
  },
  channelConversion: [
    { channel: "WhatsApp", leads: 24, converted: 8, rate: 33.3, revenue: 215000 },
    { channel: "Telegram", leads: 8, converted: 3, rate: 37.5, revenue: 98500 },
    { channel: "Instagram", leads: 7, converted: 1, rate: 14.3, revenue: 32000 },
    { channel: "Email", leads: 5, converted: 2, rate: 40.0, revenue: 87000 },
    { channel: "VK", leads: 3, converted: 0, rate: 0, revenue: 0 },
  ],
  fairPerformance: [
    { fair: "VIPTEX 2025", contacts: 22, converted: 7, rate: 31.8, revenue: 298000 },
    { fair: "BTK 2025", contacts: 12, converted: 3, rate: 25.0, revenue: 112500 },
    { fair: "TS 2025", contacts: 13, converted: 2, rate: 15.4, revenue: 77000 },
  ],
  monthlyTrend: [
    { month: "Oca", revenue: 45000, orders: 3 },
    { month: "Sub", revenue: 68000, orders: 5 },
    { month: "Mar", revenue: 142300, orders: 9 },
  ],
  recentDeals: [
    { customer: "Kristina Boutique", amount: 32500, items: 2800, status: "won", date: "2026-03-22", models: "Saten 1200m, Sifon 1000m, Viskon 600m" },
    { customer: "Anna Morozova", amount: 48000, items: 4500, status: "pending", date: "2026-03-25", models: "Saten 2000m, Krep 1500m, Astar 1000m" },
    { customer: "Oleg Petrov", amount: 35000, items: 0, status: "pending", date: "2026-03-25", models: "Krep ve scuba numune inceleniyor" },
    { customer: "Nadezdha Akulshina", amount: 18000, items: 0, status: "pending", date: "2026-03-25", models: "Viskon ve pamuk numune asamasinda" },
    { customer: "Irina Kurganova", amount: 27500, items: 2400, status: "won", date: "2026-03-21", models: "Viskon 1400m, Pamuk Poplin 1000m" },
    { customer: "Ludmila Tetsko", amount: 15000, items: 0, status: "pending", date: "2026-03-23", models: "Saten renk secenekleri sorguluyor" },
    { customer: "Tatiana Perni", amount: 0, items: 0, status: "lost", date: "2026-03-24", models: "Butce kisitli - gelecek sezon" },
    { customer: "Alexandr Volkov", amount: 0, items: 0, status: "lost", date: "2026-03-10", models: "Cevap gelmiyor" },
  ],
};

// Musteri aksiyonlari - her musteri icin spesifik sonraki adim
const DEMO_CUSTOMER_ACTIONS = [
  {
    customer: "Anna Morozova", company: "VIPTEX", segment: 1, assignee: "Ahmet Y.",
    lastContact: "2026-03-25", lastNote: "Siparis detaylari konusuldu, 4500m kumas teklifi hazirlandi",
    lastSale: { date: "2026-03-20", amount: 48000, detail: "Saten 2000m, Krep 1500m, Astar 1000m" },
    nextAction: { type: "Siparis Onay Takibi", deadline: "2026-03-28", description: "Teklif gonderildi, onay bekleniyor. 28 Mart'a kadar cevap gelmezse WhatsApp'tan ara." },
    status: "pending", priority: "high",
    noteCount7d: 3, contactCount7d: 4,
  },
  {
    customer: "Oleg Petrov", company: "Elena Chezelle", segment: 1, assignee: "Ahmet Y.",
    lastContact: "2026-03-25", lastNote: "Krep ve scuba numuneleri kargoya verildi",
    lastSale: { date: "2026-02-15", amount: 35000, detail: "Krep 1800m, Scuba 1200m" },
    nextAction: { type: "Numune Degerlendirme", deadline: "2026-03-29", description: "Numuneler ulastiktan sonra geri bildirim al. Begenmezse alternatif renkler gonder." },
    status: "pending", priority: "high",
    noteCount7d: 2, contactCount7d: 3,
  },
  {
    customer: "Kristina Boutique", company: "Kristina Boutique", segment: 1, assignee: "Mehmet K.",
    lastContact: "2026-03-22", lastNote: "2800m siparis tamamlandi, sevkiyat hazirlaniyor",
    lastSale: { date: "2026-03-22", amount: 32500, detail: "Saten 1200m, Sifon 1000m, Viskon 600m" },
    nextAction: { type: "Sevkiyat Bildirimi", deadline: "2026-03-27", description: "Kargo takip numarasini gonder. Teslimattan sonra memnuniyet ara." },
    status: "pending", priority: "medium",
    noteCount7d: 2, contactCount7d: 2,
  },
  {
    customer: "Irina Kurganova", company: "Kurganova Moda", segment: 1, assignee: "Mehmet K.",
    lastContact: "2026-03-21", lastNote: "Siparis teslim edildi, memnun",
    lastSale: { date: "2026-03-21", amount: 27500, detail: "Viskon 1400m, Pamuk Poplin 1000m" },
    nextAction: { type: "Yeni Sezon Teklifi", deadline: "2026-03-30", description: "Memnun musteri - yeni sezon koleksiyonunu goster, cross-sell firsati (Saten, Kadife)." },
    status: "completed", priority: "medium",
    noteCount7d: 1, contactCount7d: 1,
  },
  {
    customer: "Svetlana Sivaeva", company: "Terra", segment: 2, assignee: "Ahmet Y.",
    lastContact: "2026-03-15", lastNote: "Fiyat talebi geldi, liste gonderildi",
    lastSale: null,
    nextAction: { type: "Numune Gonderimi", deadline: "2026-03-26", description: "Fiyat listesini inceledi, numune istiyor. Saten ve Viskon numunesi hazirla, kargoya ver." },
    status: "overdue", priority: "high",
    noteCount7d: 0, contactCount7d: 0,
  },
  {
    customer: "Olesya Petrova", company: "Nextex", segment: 2, assignee: "Mehmet K.",
    lastContact: "2026-03-18", lastNote: "Kumas numunesi begendi, fiyat gorusmeleri basladi",
    lastSale: null,
    nextAction: { type: "Fiyat Teklifi Hazirla", deadline: "2026-03-28", description: "500m Saten + 300m Krep icin ozel fiyat teklifi hazirla. Hizli kapanabilir." },
    status: "pending", priority: "high",
    noteCount7d: 1, contactCount7d: 2,
  },
  {
    customer: "Nadezdha Akulshina", company: "Nadezdha Design", segment: 2, assignee: "Ahmet Y.",
    lastContact: "2026-03-25", lastNote: "Viskon ve pamuk numuneleri gonderildi",
    lastSale: null,
    nextAction: { type: "Numune Takibi", deadline: "2026-03-30", description: "Numuneler kargoda, ulasinca WhatsApp'tan sor. Begenirse 18.000$ potansiyel." },
    status: "pending", priority: "medium",
    noteCount7d: 1, contactCount7d: 1,
  },
  {
    customer: "Ludmila Tetsko", company: "Ludmila Atelier", segment: 2, assignee: "Mehmet K.",
    lastContact: "2026-03-23", lastNote: "Saten renk secenekleri sorguluyor",
    lastSale: null,
    nextAction: { type: "Renk Karti Gonder", deadline: "2026-03-27", description: "Saten renk kartini (12 renk) fotografla gonder. Secim yapinca fiyat teklifi hazirla." },
    status: "overdue", priority: "medium",
    noteCount7d: 1, contactCount7d: 1,
  },
  {
    customer: "Alexandr", company: "Edit Production", segment: 3, assignee: "Ahmet Y.",
    lastContact: "2026-03-10", lastNote: "Instagram'dan ulasim denendi, goruldu ama cevap yok",
    lastSale: null,
    nextAction: { type: "Alternatif Kanal Dene", deadline: "2026-03-25", description: "Instagram cevap vermiyor. Email veya telefon dene. Buyuk firma, potansiyel yuksek." },
    status: "overdue", priority: "high",
    noteCount7d: 0, contactCount7d: 0,
  },
  {
    customer: "Daria Levchenko", company: "Levchenko", segment: 4, assignee: "Mehmet K.",
    lastContact: "2026-03-05", lastNote: "Hala cevap yok",
    lastSale: null,
    nextAction: { type: "Son Deneme", deadline: "2026-03-20", description: "3. kez ulasim denenecek. Cevap gelmezse pasif listesine al." },
    status: "overdue", priority: "low",
    noteCount7d: 0, contactCount7d: 0,
  },
  {
    customer: "Viktor Sokolov", company: "Viktor Trade", segment: 4, assignee: "Ahmet Y.",
    lastContact: "2026-03-01", lastNote: "Iletisim kurulamiyor",
    lastSale: null,
    nextAction: { type: "Pasife Al", deadline: "2026-03-15", description: "Birden fazla kanaldan denendi, cevap yok. Pasif listeye tasinacak." },
    status: "overdue", priority: "low",
    noteCount7d: 0, contactCount7d: 0,
  },
];

// Personel performans verileri
const DEMO_STAFF_PERFORMANCE = [
  {
    name: "Ahmet Y.", role: "Satis Temsilcisi",
    customers: 7, activeDeals: 5,
    weeklyNotes: 5, weeklyContacts: 7, weeklyMessages: 18,
    overdueActions: 3, completedActions: 4,
    revenue: 83000, deals: 2,
    lastActivity: "2026-03-27 09:15",
    // Monthly targets
    monthlyTarget: 150000, monthlyActual: 83000,
    weeklyNoteTarget: 7, weeklyContactTarget: 10,
    samplesSent: 5, samplesConverted: 2,
    quotesCreated: 4, quotesApproved: 2,
    recentActions: [
      { time: "09:15", action: "Anna Morozova - Siparis onay takibi notu ekledi", type: "note" },
      { time: "08:40", action: "Oleg Petrov - WhatsApp mesaji gonderdi", type: "message" },
      { time: "Dun 17:30", action: "Nadezdha Akulshina - Numune kargo bilgisi paylasti", type: "message" },
      { time: "Dun 14:20", action: "Svetlana Sivaeva - Fiyat listesi guncellendi", type: "note" },
      { time: "Dun 11:00", action: "Alexandr (Edit Prod.) - Instagram'dan tekrar yazdi", type: "message" },
    ],
  },
  {
    name: "Mehmet K.", role: "Satis Temsilcisi",
    customers: 6, activeDeals: 4,
    weeklyNotes: 4, weeklyContacts: 5, weeklyMessages: 12,
    overdueActions: 2, completedActions: 3,
    revenue: 60000, deals: 2,
    lastActivity: "2026-03-27 08:50",
    monthlyTarget: 120000, monthlyActual: 60000,
    weeklyNoteTarget: 6, weeklyContactTarget: 8,
    samplesSent: 4, samplesConverted: 2,
    quotesCreated: 3, quotesApproved: 1,
    recentActions: [
      { time: "08:50", action: "Kristina Boutique - Sevkiyat hazirligi notu", type: "note" },
      { time: "Dun 16:45", action: "Olesya Petrova - Fiyat gorusmesi notu", type: "note" },
      { time: "Dun 15:00", action: "Ludmila Tetsko - Renk secenekleri paylasti", type: "message" },
      { time: "Dun 10:30", action: "Irina Kurganova - Memnuniyet aramasi yapti", type: "message" },
    ],
  },
  {
    name: "Fatma D.", role: "Destek Uzmani",
    customers: 2, activeDeals: 0,
    weeklyNotes: 2, weeklyContacts: 3, weeklyMessages: 8,
    overdueActions: 0, completedActions: 1,
    revenue: 0, deals: 0,
    lastActivity: "2026-03-26 16:00",
    monthlyTarget: 0, monthlyActual: 0,
    weeklyNoteTarget: 3, weeklyContactTarget: 5,
    samplesSent: 0, samplesConverted: 0,
    quotesCreated: 0, quotesApproved: 0,
    recentActions: [
      { time: "Dun 16:00", action: "Genel musteri sorularina cevap verdi", type: "message" },
      { time: "Dun 11:30", action: "Bilgi bankasi makalesi guncelledi", type: "note" },
    ],
  },
];

// Not yazilmayan / takip edilmeyen musteriler
const DEMO_NEGLECTED = [
  { customer: "Svetlana Sivaeva", company: "Terra", assignee: "Ahmet Y.", daysSinceNote: 12, daysSinceContact: 12, segment: 2, reason: "Fiyat talebi geldi ama takip yapilmadi" },
  { customer: "Alexandr", company: "Edit Production", assignee: "Ahmet Y.", daysSinceNote: 17, daysSinceContact: 17, segment: 3, reason: "Buyuk firma ama 2+ haftadir iletisim yok" },
  { customer: "Daria Levchenko", company: "Levchenko", assignee: "Mehmet K.", daysSinceNote: 22, daysSinceContact: 22, segment: 4, reason: "3 haftadir kayit girilmedi" },
  { customer: "Viktor Sokolov", company: "Viktor Trade", assignee: "Ahmet Y.", daysSinceNote: 26, daysSinceContact: 26, segment: 4, reason: "1 aydir hicbir aktivite yok" },
];

const segmentLabels: Record<number, string> = {
  1: "Satis + Iletisim",
  2: "Iletisim Var",
  3: "Buyuk Firma",
  4: "Normal Firma",
};

const segmentColors: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  3: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  4: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const statusColors: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const statusLabels: Record<string, string> = {
  completed: "Tamamlandi",
  pending: "Bekliyor",
  overdue: "Gecikti",
};

const priorityColors: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-gray-400",
};

type TabKey = "overview" | "actions" | "staff" | "deals";

export default function SalesPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("actions");
  const [actionFilter, setActionFilter] = useState<"all" | "overdue" | "pending" | "completed">("all");

  const data = DEMO_SALES;

  useEffect(() => {
    if (!organization) return;
    setLoading(false);
  }, [organization]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredActions = actionFilter === "all"
    ? DEMO_CUSTOMER_ACTIONS
    : DEMO_CUSTOMER_ACTIONS.filter(a => a.status === actionFilter);

  const overdueCount = DEMO_CUSTOMER_ACTIONS.filter(a => a.status === "overdue").length;
  const pendingCount = DEMO_CUSTOMER_ACTIONS.filter(a => a.status === "pending").length;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Satis Analizi</h1>
          <p className="text-sm text-gray-500 mt-1">Musteri aksiyonlari, personel takibi ve satis metrikleri</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {([
            { key: "actions" as TabKey, label: "Aksiyonlar", badge: overdueCount },
            { key: "staff" as TabKey, label: "Personel" },
            { key: "overview" as TabKey, label: "Genel" },
            { key: "deals" as TabKey, label: "Firsatlar" },
          ]).map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 lg:px-4 py-1.5 text-sm font-medium rounded-lg transition-all relative ${
                activeTab === tab.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== AKSIYONLAR TAB ==================== */}
      {activeTab === "actions" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => setActionFilter("overdue")}
              className={`card p-4 text-left transition-all ${actionFilter === "overdue" ? "ring-2 ring-red-500" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950"><AlertTriangle className="h-4 w-4 text-red-600" /></div>
                <span className="text-xs text-gray-500">Geciken</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
              <p className="text-[10px] text-gray-500 mt-1">Acil aksiyon gerekli</p>
            </button>
            <button onClick={() => setActionFilter("pending")}
              className={`card p-4 text-left transition-all ${actionFilter === "pending" ? "ring-2 ring-blue-500" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950"><Clock className="h-4 w-4 text-blue-600" /></div>
                <span className="text-xs text-gray-500">Bekleyen</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
              <p className="text-[10px] text-gray-500 mt-1">Suresi dolmamis</p>
            </button>
            <button onClick={() => setActionFilter("completed")}
              className={`card p-4 text-left transition-all ${actionFilter === "completed" ? "ring-2 ring-emerald-500" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950"><CheckCircle className="h-4 w-4 text-emerald-600" /></div>
                <span className="text-xs text-gray-500">Tamamlanan</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{DEMO_CUSTOMER_ACTIONS.filter(a => a.status === "completed").length}</p>
              <p className="text-[10px] text-gray-500 mt-1">Bu hafta</p>
            </button>
            <button onClick={() => setActionFilter("all")}
              className={`card p-4 text-left transition-all ${actionFilter === "all" ? "ring-2 ring-gray-400" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800"><ClipboardCheck className="h-4 w-4 text-gray-600" /></div>
                <span className="text-xs text-gray-500">Toplam</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{DEMO_CUSTOMER_ACTIONS.length}</p>
              <p className="text-[10px] text-gray-500 mt-1">Aktif musteri</p>
            </button>
          </div>

          {/* Customer Action Cards */}
          <div className="space-y-3">
            {filteredActions.map((action, i) => (
              <div key={i} className={`card p-0 overflow-hidden border-l-4 ${priorityColors[action.priority]}`}>
                <div className="p-4 lg:p-5">
                  {/* Top Row: Customer + Status */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {action.customer.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{action.customer}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{action.company}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${segmentColors[action.segment]}`}>
                            S{action.segment}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${statusColors[action.status]}`}>
                        {statusLabels[action.status]}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> {action.assignee}
                      </span>
                    </div>
                  </div>

                  {/* Action Box */}
                  <div className={`rounded-xl p-3 mb-3 ${
                    action.status === "overdue" ? "bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900" :
                    action.status === "completed" ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900" :
                    "bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        {action.nextAction.type}
                      </span>
                      <span className={`text-[10px] font-medium flex items-center gap-1 ${
                        action.status === "overdue" ? "text-red-600" : "text-gray-500"
                      }`}>
                        <Calendar className="h-3 w-3" />
                        Son: {action.nextAction.deadline.slice(5)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-400">{action.nextAction.description}</p>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block mb-0.5">Son Iletisim</span>
                      <span className="text-gray-700 dark:text-slate-300 font-medium">{action.lastContact.slice(5)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Son Not</span>
                      <span className="text-gray-700 dark:text-slate-300 font-medium truncate block">{action.lastNote.length > 40 ? action.lastNote.slice(0, 40) + "..." : action.lastNote}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Son Satis</span>
                      {action.lastSale ? (
                        <span className="text-emerald-600 font-bold">${action.lastSale.amount.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">Henuz yok</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Haftalik Aktivite</span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5" title="Not sayisi">
                          <FileText className="h-3 w-3 text-blue-500" />
                          <span className={`font-medium ${action.noteCount7d === 0 ? "text-red-500" : "text-gray-700 dark:text-slate-300"}`}>{action.noteCount7d}</span>
                        </span>
                        <span className="flex items-center gap-0.5" title="Temas sayisi">
                          <MessageSquare className="h-3 w-3 text-green-500" />
                          <span className={`font-medium ${action.contactCount7d === 0 ? "text-red-500" : "text-gray-700 dark:text-slate-300"}`}>{action.contactCount7d}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last Sale Detail (if exists) */}
                  {action.lastSale && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                      <p className="text-[10px] text-gray-400">Son siparis ({action.lastSale.date.slice(5)}): <span className="text-gray-600 dark:text-slate-400">{action.lastSale.detail}</span></p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ==================== PERSONEL TAKIBI TAB ==================== */}
      {activeTab === "staff" && (
        <>
          {/* Uyari Banner */}
          {DEMO_NEGLECTED.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Takip Edilmeyen Musteriler ({DEMO_NEGLECTED.length})</h3>
              </div>
              <div className="space-y-2">
                {DEMO_NEGLECTED.map((n, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-red-100 dark:border-red-900">
                    <div className="w-1.5 h-8 rounded-full bg-red-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{n.customer}</span>
                        <span className="text-xs text-gray-400">({n.company})</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${segmentColors[n.segment]}`}>S{n.segment}</span>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-400">{n.reason}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Son kayit</p>
                        <p className="text-xs font-bold text-red-600">{n.daysSinceNote} gun once</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Sorumlu</p>
                        <p className="text-xs font-medium text-gray-700 dark:text-slate-300">{n.assignee}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {DEMO_STAFF_PERFORMANCE.map((staff, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {staff.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{staff.name}</h3>
                    <p className="text-[10px] text-gray-400">{staff.role} - {staff.customers} musteri</p>
                  </div>
                  {staff.overdueActions > 0 && (
                    <span className="ml-auto px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-[10px] font-bold rounded-lg">
                      {staff.overdueActions} geciken
                    </span>
                  )}
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="h-3 w-3 text-blue-500" />
                      <span className="text-[10px] text-gray-400">Haftalik Not</span>
                    </div>
                    <p className={`text-lg font-bold ${staff.weeklyNotes >= 4 ? "text-emerald-600" : staff.weeklyNotes >= 2 ? "text-amber-600" : "text-red-600"}`}>
                      {staff.weeklyNotes}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="h-3 w-3 text-green-500" />
                      <span className="text-[10px] text-gray-400">Temas</span>
                    </div>
                    <p className={`text-lg font-bold ${staff.weeklyContacts >= 5 ? "text-emerald-600" : staff.weeklyContacts >= 3 ? "text-amber-600" : "text-red-600"}`}>
                      {staff.weeklyContacts}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] text-gray-400">Gelir</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">${staff.revenue.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle className="h-3 w-3 text-violet-500" />
                      <span className="text-[10px] text-gray-400">Tamamlanan</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{staff.completedActions}/{staff.completedActions + staff.overdueActions}</p>
                  </div>
                </div>

                {/* Monthly Revenue Target */}
                {staff.monthlyTarget > 0 && (
                  <div className="mb-3 p-2.5 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-900">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">Aylik Satis Hedefi</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">${staff.monthlyActual.toLocaleString()} / ${staff.monthlyTarget.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${(staff.monthlyActual / staff.monthlyTarget) >= 0.7 ? "bg-emerald-500" : (staff.monthlyActual / staff.monthlyTarget) >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, (staff.monthlyActual / staff.monthlyTarget) * 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-1">%{((staff.monthlyActual / staff.monthlyTarget) * 100).toFixed(0)} tamamlandi - ${(staff.monthlyTarget - staff.monthlyActual).toLocaleString()} kaldi</p>
                  </div>
                )}

                {/* Numune & Teklif Performance */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900 text-center">
                    <p className="text-[10px] text-pink-600 dark:text-pink-400 font-medium">Numune</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.samplesConverted}/{staff.samplesSent}</p>
                    <p className="text-[9px] text-gray-400">donusum</p>
                  </div>
                  <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 text-center">
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">Teklif</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.quotesApproved}/{staff.quotesCreated}</p>
                    <p className="text-[9px] text-gray-400">onaylanan</p>
                  </div>
                </div>

                {/* Performance Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Aksiyon tamamlama</span>
                    <span>%{staff.completedActions + staff.overdueActions > 0 ? ((staff.completedActions / (staff.completedActions + staff.overdueActions)) * 100).toFixed(0) : 0}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        staff.completedActions / (staff.completedActions + staff.overdueActions) >= 0.7 ? "bg-emerald-500" :
                        staff.completedActions / (staff.completedActions + staff.overdueActions) >= 0.4 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${staff.completedActions + staff.overdueActions > 0 ? (staff.completedActions / (staff.completedActions + staff.overdueActions)) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Son Aktiviteler</h4>
                  <div className="space-y-1.5">
                    {staff.recentActions.slice(0, 4).map((a, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.type === "note" ? "bg-blue-500" : "bg-green-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-600 dark:text-slate-400 truncate">{a.action}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{a.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Haftalik Ozet */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              Haftalik Karsilastirma
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-2 font-medium text-gray-500">Personel</th>
                    <th className="text-center py-2 font-medium text-gray-500">Musteri</th>
                    <th className="text-center py-2 font-medium text-gray-500">Not</th>
                    <th className="text-center py-2 font-medium text-gray-500">Temas</th>
                    <th className="text-center py-2 font-medium text-gray-500">Mesaj</th>
                    <th className="text-center py-2 font-medium text-gray-500">Geciken</th>
                    <th className="text-right py-2 font-medium text-gray-500">Gelir</th>
                    <th className="text-center py-2 font-medium text-gray-500">Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_STAFF_PERFORMANCE.map((s, i) => {
                    const score = Math.min(100, Math.round(
                      (s.weeklyNotes / 5) * 25 + (s.weeklyContacts / 7) * 25 + (s.completedActions / Math.max(1, s.completedActions + s.overdueActions)) * 30 + (s.revenue > 0 ? 20 : 0)
                    ));
                    return (
                      <tr key={i} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                        <td className="py-3 text-center text-gray-600 dark:text-slate-400">{s.customers}</td>
                        <td className="py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.weeklyNotes >= 4 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : s.weeklyNotes >= 2 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>
                            {s.weeklyNotes}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.weeklyContacts >= 5 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : s.weeklyContacts >= 3 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>
                            {s.weeklyContacts}
                          </span>
                        </td>
                        <td className="py-3 text-center text-gray-600 dark:text-slate-400">{s.weeklyMessages}</td>
                        <td className="py-3 text-center">
                          {s.overdueActions > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">{s.overdueActions}</span>
                          ) : (
                            <span className="text-emerald-600">-</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-medium text-gray-900 dark:text-white">${s.revenue.toLocaleString()}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${score >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : score >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">Skor: Not (%25) + Temas (%25) + Aksiyon tamamlama (%30) + Gelir (%20)</p>
          </div>
        </>
      )}

      {/* ==================== GENEL TAB ==================== */}
      {activeTab === "overview" && (
        <>
          {/* Revenue KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950"><DollarSign className="h-4 w-4 text-green-600" /></div>
                <span className="text-xs text-gray-500">Toplam Gelir</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${data.summary.totalRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5 mt-1"><ArrowUpRight className="h-3 w-3" />+42% gecen aya gore</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950"><ShoppingCart className="h-4 w-4 text-blue-600" /></div>
                <span className="text-xs text-gray-500">Bu Ay</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${data.summary.monthlyRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5 mt-1"><ArrowUpRight className="h-3 w-3" />9 siparis</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950"><Target className="h-4 w-4 text-violet-600" /></div>
                <span className="text-xs text-gray-500">Donusum Orani</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">%{data.summary.conversionRate}</p>
              <p className="text-[10px] text-gray-500 mt-1">47 leadden 12 siparis</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950"><BarChart3 className="h-4 w-4 text-amber-600" /></div>
                <span className="text-xs text-gray-500">Ort. Siparis</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${data.summary.avgOrderValue.toLocaleString()}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-950"><Repeat className="h-4 w-4 text-pink-600" /></div>
                <span className="text-xs text-gray-500">Tekrar Musteri</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{data.summary.repeatCustomers}/{data.summary.totalCustomers}</p>
              <p className="text-[10px] text-gray-500 mt-1">%{((data.summary.repeatCustomers / data.summary.totalCustomers) * 100).toFixed(0)} sadakat</p>
            </div>
          </div>

          {/* Revenue by Month + Channel Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Aylik Gelir Trendi
              </h3>
              <div className="space-y-3">
                {data.monthlyTrend.map((m) => {
                  const maxRev = Math.max(...data.monthlyTrend.map(t => t.revenue));
                  const pct = (m.revenue / maxRev) * 100;
                  return (
                    <div key={m.month}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-slate-300">{m.month} 2026</span>
                        <span className="text-gray-500">${m.revenue.toLocaleString()} ({m.orders} siparis)</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-blue-600" />
                Kanal Bazli Donusum
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <th className="text-left py-2 font-medium text-gray-500">Kanal</th>
                      <th className="text-right py-2 font-medium text-gray-500">Lead</th>
                      <th className="text-right py-2 font-medium text-gray-500">Donusum</th>
                      <th className="text-right py-2 font-medium text-gray-500">Oran</th>
                      <th className="text-right py-2 font-medium text-gray-500">Gelir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channelConversion.map((ch) => (
                      <tr key={ch.channel} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="py-2.5 font-medium text-gray-900 dark:text-white">{ch.channel}</td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-slate-400">{ch.leads}</td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-slate-400">{ch.converted}</td>
                        <td className="py-2.5 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ch.rate >= 30 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : ch.rate > 0 ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-500"}`}>
                            %{ch.rate.toFixed(0)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-gray-900 dark:text-white">${ch.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Fair Performance */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              Fuar Performansi
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {data.fairPerformance.map((f) => (
                <div key={f.fair} className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{f.fair}</h4>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Temas</span>
                      <span className="font-medium text-gray-900 dark:text-white">{f.contacts}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Donusum</span>
                      <span className="font-medium text-green-600">{f.converted} (%{f.rate.toFixed(0)})</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Gelir</span>
                      <span className="font-bold text-gray-900 dark:text-white">${f.revenue.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mt-1">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${f.rate}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ==================== FIRSATLAR TAB ==================== */}
      {activeTab === "deals" && (
        <>
          {/* Deal Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Aktif ({data.recentDeals.filter(d => d.status === "pending").length})</h3>
                <span className="ml-auto text-xs font-medium text-blue-600">
                  ${data.recentDeals.filter(d => d.status === "pending").reduce((s, d) => s + d.amount, 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2">
                {data.recentDeals.filter(d => d.status === "pending").map((deal, i) => (
                  <div key={i} className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{deal.customer}</p>
                      {deal.amount > 0 && <span className="text-xs font-bold text-blue-600">${deal.amount.toLocaleString()}</span>}
                    </div>
                    <p className="text-[11px] text-gray-500">{deal.models}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{deal.date}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Kazanilan ({data.recentDeals.filter(d => d.status === "won").length})</h3>
                <span className="ml-auto text-xs font-medium text-emerald-600">
                  ${data.recentDeals.filter(d => d.status === "won").reduce((s, d) => s + d.amount, 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2">
                {data.recentDeals.filter(d => d.status === "won").map((deal, i) => (
                  <div key={i} className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{deal.customer}</p>
                      <span className="text-xs font-bold text-emerald-600">${deal.amount.toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-gray-500">{deal.items} adet - {deal.models}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{deal.date}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Kaybedilen ({data.recentDeals.filter(d => d.status === "lost").length})</h3>
              </div>
              <div className="space-y-2">
                {data.recentDeals.filter(d => d.status === "lost").map((deal, i) => (
                  <div key={i} className="p-3 rounded-xl bg-red-50/50 dark:bg-red-950/30 border border-red-100 dark:border-red-900">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{deal.customer}</p>
                    </div>
                    <p className="text-[11px] text-gray-500">{deal.models}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{deal.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pipeline Summary */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Pipeline Ozeti</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-4 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${(data.summary.wonDeals / (data.summary.wonDeals + data.summary.lostDeals + data.summary.activeDeals)) * 100}%` }} />
                <div className="h-full bg-blue-500" style={{ width: `${(data.summary.activeDeals / (data.summary.wonDeals + data.summary.lostDeals + data.summary.activeDeals)) * 100}%` }} />
                <div className="h-full bg-red-400 rounded-r-full" style={{ width: `${(data.summary.lostDeals / (data.summary.wonDeals + data.summary.lostDeals + data.summary.activeDeals)) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3 text-xs">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Kazanilan %{((data.summary.wonDeals / (data.summary.wonDeals + data.summary.lostDeals + data.summary.activeDeals)) * 100).toFixed(0)}</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Aktif %{((data.summary.activeDeals / (data.summary.wonDeals + data.summary.lostDeals + data.summary.activeDeals)) * 100).toFixed(0)}</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400" /> Kaybedilen %{((data.summary.lostDeals / (data.summary.wonDeals + data.summary.lostDeals + data.summary.activeDeals)) * 100).toFixed(0)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
