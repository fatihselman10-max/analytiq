"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg } from "@/lib/demo-data";
import {
  FileText, ShoppingCart, Truck, DollarSign, Clock, CheckCircle,
  XCircle, AlertTriangle, Calendar, Download, ArrowRight,
  Package, MapPin, Globe, MessageSquare, ChevronRight,
} from "lucide-react";

// ============ QUOTES ============
const DEMO_QUOTES = [
  {
    id: "TKL-2026-018", customer: "Anna Morozova", company: "VIPTEX", date: "2026-03-24",
    status: "awaiting", validUntil: "2026-03-31", preparedBy: "Ahmet Y.", discount: 10, discountReason: "1000m+",
    items: [
      { product: "Premium Saten", code: "KM-301", color: "Siyah + Bordo", qty: 2000, unit: "m", price: 85, total: 170000 },
      { product: "Krep Kumas", code: "KM-305", color: "Siyah + Bej", qty: 1500, unit: "m", price: 72, total: 108000 },
      { product: "Astar Kumas", code: "KM-345", color: "Siyah", qty: 1000, unit: "m", price: 22, total: 22000 },
    ],
    subtotal: 300000, discountAmount: 30000, total: 48000, currency: "$", note: "TL/USD kuru uzerinden $48,000",
  },
  {
    id: "TKL-2026-017", customer: "Olesya Petrova", company: "Nextex", date: "2026-03-23",
    status: "preparing", validUntil: "-", preparedBy: "Mehmet K.", discount: 5, discountReason: "500m+",
    items: [
      { product: "Premium Saten", code: "KM-301", color: "Krem + Lacivert", qty: 500, unit: "m", price: 85, total: 42500 },
      { product: "Krep Kumas", code: "KM-305", color: "Pudra", qty: 300, unit: "m", price: 72, total: 21600 },
    ],
    subtotal: 64100, discountAmount: 3205, total: 12500, currency: "$", note: "",
  },
  {
    id: "TKL-2026-016", customer: "Ludmila Tetsko", company: "Ludmila Atelier", date: "2026-03-22",
    status: "draft", validUntil: "-", preparedBy: "Mehmet K.", discount: 0, discountReason: "",
    items: [
      { product: "Premium Saten", code: "KM-301", color: "Renk secimi bekleniyor", qty: 400, unit: "m", price: 85, total: 34000 },
    ],
    subtotal: 34000, discountAmount: 0, total: 8200, currency: "$", note: "Renk karti gonderilecek",
  },
  {
    id: "TKL-2026-015", customer: "Nadezdha Akulshina", company: "Tom Klaim", date: "2026-03-21",
    status: "sent", validUntil: "2026-04-01", preparedBy: "Ahmet Y.", discount: 5, discountReason: "500m+",
    items: [
      { product: "Viskon Dokuma", code: "KM-310", color: "Siyah + Haki", qty: 800, unit: "m", price: 65, total: 52000 },
      { product: "Pamuk Poplin", code: "KM-315", color: "Beyaz + Mavi", qty: 600, unit: "m", price: 58, total: 34800 },
    ],
    subtotal: 86800, discountAmount: 4340, total: 18000, currency: "$", note: "",
  },
  {
    id: "TKL-2026-014", customer: "Kristina Boutique", company: "Kristina Boutique", date: "2026-03-18",
    status: "approved", validUntil: "2026-03-25", preparedBy: "Mehmet K.", discount: 12, discountReason: "Hacim",
    items: [
      { product: "Premium Saten", code: "KM-301", color: "Siyah + Bordo + Krem", qty: 1500, unit: "m", price: 85, total: 127500 },
      { product: "Sifon Kumas", code: "KM-325", color: "Beyaz + Pudra", qty: 1200, unit: "m", price: 48, total: 57600 },
      { product: "Viskon Dokuma", code: "KM-310", color: "Pembe", qty: 800, unit: "m", price: 65, total: 52000 },
    ],
    subtotal: 237100, discountAmount: 28452, total: 45000, currency: "$", note: "Siparis olusturuldu: SIP-2026-042",
  },
  {
    id: "TKL-2026-013", customer: "Irina Kurganova", company: "Kurganova Moda", date: "2026-03-10",
    status: "expired", validUntil: "2026-03-17", preparedBy: "Ahmet Y.", discount: 0, discountReason: "",
    items: [
      { product: "Kadife Kumas", code: "KM-330", color: "Bordo + Lacivert", qty: 300, unit: "m", price: 110, total: 33000 },
      { product: "Viskon Dokuma", code: "KM-310", color: "Siyah", qty: 500, unit: "m", price: 65, total: 32500 },
    ],
    subtotal: 65500, discountAmount: 0, total: 15000, currency: "$", note: "Sure doldu - yenilenmesi gerekiyor",
  },
];

const quoteStatusMap: Record<string, { label: string; color: string }> = {
  draft: { label: "Taslak", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  preparing: { label: "Hazirlaniyor", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" },
  sent: { label: "Gonderildi", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  awaiting: { label: "Onay Bekleniyor", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
  approved: { label: "Onaylandi", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  expired: { label: "Suresi Doldu", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
};

// ============ ORDERS ============
const ORDER_STAGES = ["Onaylandi", "Uretim", "Kalite Kontrol", "Paketleme", "Hazir", "Kargoda", "Teslim"];

const DEMO_ORDERS = [
  {
    id: "SIP-2026-043", customer: "Anna Morozova", company: "VIPTEX", amount: 48000,
    items: "Saten 2000m + Krep 1500m + Astar 1000m", stage: 1, stageLabel: "Onaylandi",
    orderDate: "2026-03-27", estDelivery: "2026-04-08", assignee: "Ahmet Y.",
    history: [{ stage: "Onaylandi", date: "27 Mar 09:00" }],
  },
  {
    id: "SIP-2026-042", customer: "Kristina Boutique", company: "Kristina Boutique", amount: 32500,
    items: "Saten 1200m + Sifon 1000m + Viskon 600m", stage: 4, stageLabel: "Paketleme",
    orderDate: "2026-03-22", estDelivery: "2026-04-02", assignee: "Mehmet K.",
    history: [
      { stage: "Onaylandi", date: "22 Mar 10:30" }, { stage: "Uretim", date: "23 Mar 08:00" },
      { stage: "Kalite Kontrol", date: "25 Mar 14:00" }, { stage: "Paketleme", date: "26 Mar 16:00" },
    ],
  },
  {
    id: "SIP-2026-041", customer: "Irina Kurganova", company: "Kurganova Moda", amount: 27500,
    items: "Viskon 1400m + Pamuk Poplin 1000m", stage: 6, stageLabel: "Kargoda",
    orderDate: "2026-03-21", estDelivery: "2026-03-28", assignee: "Mehmet K.", tracking: "TR-DHL-928374",
    history: [
      { stage: "Onaylandi", date: "21 Mar" }, { stage: "Uretim", date: "22 Mar" },
      { stage: "Kalite Kontrol", date: "23 Mar" }, { stage: "Paketleme", date: "24 Mar" },
      { stage: "Hazir", date: "24 Mar" }, { stage: "Kargoda", date: "25 Mar" },
    ],
  },
  {
    id: "SIP-2026-040", customer: "Anna Morozova", company: "VIPTEX", amount: 38000,
    items: "Krep 2000m + Saten 1500m", stage: 7, stageLabel: "Teslim Edildi",
    orderDate: "2026-03-01", estDelivery: "2026-03-15", assignee: "Ahmet Y.", tracking: "TR-DHL-871625",
    history: [
      { stage: "Onaylandi", date: "1 Mar" }, { stage: "Uretim", date: "2 Mar" },
      { stage: "Kalite Kontrol", date: "5 Mar" }, { stage: "Paketleme", date: "7 Mar" },
      { stage: "Hazir", date: "8 Mar" }, { stage: "Kargoda", date: "9 Mar" },
      { stage: "Teslim Edildi", date: "15 Mar" },
    ],
  },
  {
    id: "SIP-2026-039", customer: "Oleg Petrov", company: "Elena Chezelle", amount: 35000,
    items: "Krep 1800m + Scuba 1200m", stage: 7, stageLabel: "Teslim Edildi",
    orderDate: "2026-02-15", estDelivery: "2026-03-10", assignee: "Ahmet Y.", tracking: "TR-DHL-762514",
    history: [
      { stage: "Onaylandi", date: "15 Sub" }, { stage: "Teslim Edildi", date: "10 Mar" },
    ],
  },
];

// ============ SHIPMENTS ============
const DEMO_SHIPMENTS = [
  {
    id: "SIP-2026-041", customer: "Irina Kurganova", destination: "Moskova, Rusya",
    carrier: "DHL", tracking: "TR-DHL-928374",
    status: "customs", statusLabel: "Gumrukte",
    shipped: "2026-03-25", estArrival: "2026-03-28", lastUpdate: "Rusya gumrugune ulasti, islem bekleniyor",
    docs: { packingList: true, invoice: true, certificate: false },
    stages: [
      { name: "Hazirlandi", done: true }, { name: "Kargoya Verildi", done: true },
      { name: "Yolda", done: true }, { name: "Gumrukte", done: true, current: true },
      { name: "Dagitimda", done: false }, { name: "Teslim", done: false },
    ],
  },
  {
    id: "SIP-2026-042", customer: "Kristina Boutique", destination: "St. Petersburg, Rusya",
    carrier: "-", tracking: "-",
    status: "preparing", statusLabel: "Hazirlaniyor",
    shipped: "-", estArrival: "2026-04-02", lastUpdate: "Paketleme devam ediyor, tahmini kargo: 29 Mart",
    docs: { packingList: true, invoice: false, certificate: false },
    stages: [
      { name: "Hazirlandi", done: false, current: true }, { name: "Kargoya Verildi", done: false },
      { name: "Yolda", done: false }, { name: "Gumrukte", done: false },
      { name: "Dagitimda", done: false }, { name: "Teslim", done: false },
    ],
  },
  {
    id: "SIP-2026-040", customer: "Anna Morozova", destination: "Moskova, Rusya",
    carrier: "DHL", tracking: "TR-DHL-871625",
    status: "delivered", statusLabel: "Teslim Edildi",
    shipped: "2026-03-09", estArrival: "2026-03-15", lastUpdate: "Teslim edildi - Imzalayan: Anna M.",
    docs: { packingList: true, invoice: true, certificate: true },
    stages: [
      { name: "Hazirlandi", done: true }, { name: "Kargoya Verildi", done: true },
      { name: "Yolda", done: true }, { name: "Gumrukte", done: true },
      { name: "Dagitimda", done: true }, { name: "Teslim", done: true },
    ],
  },
];

const shipmentStatusColors: Record<string, string> = {
  preparing: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  customs: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
};

type TabKey = "quotes" | "orders" | "shipments";

export default function OrdersPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("orders");
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setLoading(false);
  }, [organization]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Siparisler & Teklifler</h1>
          <p className="text-sm text-gray-500 mt-1">Teklif, siparis ve sevkiyat yonetimi</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {([
            { key: "quotes" as TabKey, label: "Teklifler", count: DEMO_QUOTES.length },
            { key: "orders" as TabKey, label: "Siparisler", count: DEMO_ORDERS.filter(o => o.stage < 7).length },
            { key: "shipments" as TabKey, label: "Sevkiyat", count: DEMO_SHIPMENTS.filter(s => s.status !== "delivered").length },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {tab.label} <span className="text-[10px] ml-1 opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ==================== TEKLIFLER ==================== */}
      {activeTab === "quotes" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Toplam Teklif</div><p className="text-xl font-bold text-gray-900 dark:text-white">{DEMO_QUOTES.length}</p></div>
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Bekleyen Deger</div><p className="text-xl font-bold text-blue-600">${DEMO_QUOTES.filter(q => ["sent","awaiting","preparing"].includes(q.status)).reduce((s, q) => s + q.total, 0).toLocaleString()}</p></div>
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Onaylanan</div><p className="text-xl font-bold text-emerald-600">${DEMO_QUOTES.filter(q => q.status === "approved").reduce((s, q) => s + q.total, 0).toLocaleString()}</p></div>
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Suresi Dolan</div><p className="text-xl font-bold text-red-600">${DEMO_QUOTES.filter(q => q.status === "expired").reduce((s, q) => s + q.total, 0).toLocaleString()}</p></div>
          </div>

          <div className="space-y-3">
            {DEMO_QUOTES.map(q => (
              <div key={q.id} className="card overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => setExpandedQuote(expandedQuote === q.id ? null : q.id)}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{q.customer.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{q.id}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${quoteStatusMap[q.status].color}`}>{quoteStatusMap[q.status].label}</span>
                        </div>
                        <p className="text-xs text-gray-500">{q.customer} - {q.company}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {q.discount > 0 && <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded-full dark:bg-green-950 dark:text-green-400">%{q.discount} iskonto</span>}
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{q.currency}{q.total.toLocaleString()}</span>
                      <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expandedQuote === q.id ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                </div>
                {expandedQuote === q.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-800 pt-3">
                    <table className="w-full text-xs mb-3">
                      <thead><tr className="border-b border-gray-100 dark:border-slate-700">
                        <th className="text-left py-1.5 text-gray-400">Urun</th><th className="text-left py-1.5 text-gray-400">Renk</th>
                        <th className="text-right py-1.5 text-gray-400">Miktar</th><th className="text-right py-1.5 text-gray-400">Fiyat</th><th className="text-right py-1.5 text-gray-400">Toplam</th>
                      </tr></thead>
                      <tbody>{q.items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-slate-800">
                          <td className="py-2 font-medium text-gray-900 dark:text-white">{item.product} <span className="text-gray-400">({item.code})</span></td>
                          <td className="py-2 text-gray-500">{item.color}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-slate-400">{item.qty.toLocaleString()}{item.unit}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-slate-400">{item.price} TL</td>
                          <td className="py-2 text-right font-medium text-gray-900 dark:text-white">{item.total.toLocaleString()} TL</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    <div className="flex flex-col lg:flex-row justify-between gap-3">
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Hazirlayan: <span className="font-medium text-gray-700 dark:text-slate-300">{q.preparedBy}</span></p>
                        <p>Tarih: {q.date}</p>
                        {q.validUntil !== "-" && <p>Gecerlilik: <span className="font-medium">{q.validUntil}</span></p>}
                        {q.note && <p className="text-amber-600">{q.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-200 transition-colors flex items-center gap-1">
                          <Download className="h-3 w-3" /> PDF
                        </button>
                        {!["approved", "expired"].includes(q.status) && (
                          <button className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> Siparise Cevir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ==================== SIPARISLER ==================== */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Aktif Siparis</div><p className="text-xl font-bold text-blue-600">{DEMO_ORDERS.filter(o => o.stage < 7).length}</p></div>
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Aktif Deger</div><p className="text-xl font-bold text-gray-900 dark:text-white">${DEMO_ORDERS.filter(o => o.stage < 7).reduce((s, o) => s + o.amount, 0).toLocaleString()}</p></div>
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Teslim Edilen</div><p className="text-xl font-bold text-emerald-600">{DEMO_ORDERS.filter(o => o.stage === 7).length}</p></div>
            <div className="card p-3"><div className="text-[10px] text-gray-400 mb-1">Toplam Gelir</div><p className="text-xl font-bold text-gray-900 dark:text-white">${DEMO_ORDERS.reduce((s, o) => s + o.amount, 0).toLocaleString()}</p></div>
          </div>

          {DEMO_ORDERS.map(order => (
            <div key={order.id} className="card p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{order.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${order.stage === 7 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"}`}>
                      {order.stageLabel}
                    </span>
                    {order.tracking && <span className="text-[10px] text-gray-400 font-mono">{order.tracking}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{order.customer} ({order.company}) - {order.items}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{order.assignee}</span>
                  <span className="text-sm font-bold text-emerald-600">${order.amount.toLocaleString()}</span>
                </div>
              </div>
              {/* Stage Progress */}
              <div className="flex items-center gap-0.5">
                {ORDER_STAGES.map((stage, i) => (
                  <div key={i} className="flex-1">
                    <div className={`h-2 rounded-full ${i < order.stage ? "bg-emerald-500" : i === order.stage ? "bg-blue-500 animate-pulse" : "bg-gray-200 dark:bg-slate-700"}`} />
                    <p className="text-[7px] text-gray-400 mt-0.5 text-center truncate">{stage}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                <span>Siparis: {order.orderDate}</span>
                <span>Tahmini: {order.estDelivery}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== SEVKIYAT ==================== */}
      {activeTab === "shipments" && (
        <div className="space-y-4">
          {DEMO_SHIPMENTS.map(ship => (
            <div key={ship.id} className="card p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{ship.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${shipmentStatusColors[ship.status]}`}>{ship.statusLabel}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{ship.customer} → {ship.destination}</p>
                </div>
                <div className="flex items-center gap-2">
                  {ship.tracking !== "-" && <span className="text-xs font-mono text-gray-500 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-lg">{ship.carrier}: {ship.tracking}</span>}
                  <button className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-medium hover:bg-green-700 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Musteriye Bildir
                  </button>
                </div>
              </div>

              {/* Shipment Stages */}
              <div className="flex items-center gap-1 mb-4">
                {ship.stages.map((st, i) => (
                  <div key={i} className="flex-1">
                    <div className={`h-2.5 rounded-full ${st.done ? "bg-emerald-500" : st.current ? "bg-blue-500 animate-pulse" : "bg-gray-200 dark:bg-slate-700"}`} />
                    <p className={`text-[8px] mt-0.5 text-center ${st.current ? "text-blue-600 font-semibold" : "text-gray-400"}`}>{st.name}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col lg:flex-row justify-between gap-3">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Son guncelleme: <span className="font-medium text-gray-700 dark:text-slate-300">{ship.lastUpdate}</span></p>
                  {ship.shipped !== "-" && <p>Gonderim: {ship.shipped} | Tahmini: {ship.estArrival}</p>}
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`px-2 py-1 rounded-lg ${ship.docs.packingList ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-gray-50 text-gray-400"}`}>Packing List {ship.docs.packingList ? "✓" : "○"}</span>
                  <span className={`px-2 py-1 rounded-lg ${ship.docs.invoice ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-gray-50 text-gray-400"}`}>Fatura {ship.docs.invoice ? "✓" : "○"}</span>
                  <span className={`px-2 py-1 rounded-lg ${ship.docs.certificate ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"}`}>Mensei {ship.docs.certificate ? "✓" : "Bekliyor"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
