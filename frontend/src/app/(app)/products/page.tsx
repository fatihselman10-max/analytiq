"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg } from "@/lib/demo-data";
import {
  Package, TrendingUp, Users, ShoppingCart, Search, ArrowUpRight,
  Calendar, Repeat, AlertCircle, Star, ChevronRight, BarChart3,
  Clock, DollarSign, Eye, ArrowRight, Layers, RefreshCw, CheckCircle2,
  Database,
} from "lucide-react";

// ===== DEMO DATA =====

// Nebim ERP sync status
const NEBIM_SYNC = {
  connected: true,
  lastSync: "2026-03-25 14:32",
  nextSync: "15 dk sonra",
  syncedProducts: 10,
  syncedCustomers: 15,
  syncedInvoices: 47,
  syncedStock: 10,
  warehouse: "Messe Ana Depo - Merter/Istanbul",
};

const PRODUCTS = [
  { id: "KM-301", name: "Premium Saten", category: "Saten", fabric: "%100 Polyester Saten", price: 85, cost: 38, sizes: "150cm en", colors: ["Siyah", "Bordo", "Lacivert", "Krem"], stock: 2400, totalSold: 8500, image: "", nebimCode: "NB-301-SAT", barcode: "8690003010001", warehouse: "A-1-01", cariCode: "110.01.001", reserved: 350, incoming: 1000, unit: "metre" },
  { id: "KM-305", name: "Krep Kumas", category: "Krep", fabric: "Polyester Krep", price: 72, cost: 32, sizes: "150cm en", colors: ["Siyah", "Bej", "Gri", "Pudra"], stock: 3100, totalSold: 11200, image: "", nebimCode: "NB-305-KRP", barcode: "8690003050001", warehouse: "A-1-05", cariCode: "110.02.001", reserved: 500, incoming: 2000, unit: "metre" },
  { id: "KM-310", name: "Viskon Dokuma", category: "Viskon", fabric: "%100 Viskon", price: 65, cost: 28, sizes: "140cm en", colors: ["Siyah", "Haki", "Pembe", "Mavi"], stock: 4200, totalSold: 14800, image: "", nebimCode: "NB-310-VSK", barcode: "8690003100001", warehouse: "A-2-01", cariCode: "110.03.001", reserved: 200, incoming: 0, unit: "metre" },
  { id: "KM-315", name: "Pamuk Poplin", category: "Pamuk", fabric: "Pamuk/Polyester 65/35", price: 58, cost: 24, sizes: "150cm en", colors: ["Beyaz", "Mavi", "Cizgili", "Ekru"], stock: 5500, totalSold: 18200, image: "", nebimCode: "NB-315-PML", barcode: "8690003150001", warehouse: "A-2-05", cariCode: "110.04.001", reserved: 800, incoming: 3000, unit: "metre" },
  { id: "KM-320", name: "Scuba Kumas", category: "Scuba", fabric: "Polyester/Elastan Scuba", price: 95, cost: 45, sizes: "150cm en", colors: ["Siyah", "Lacivert", "Bordo"], stock: 1800, totalSold: 6200, image: "", nebimCode: "NB-320-SCB", barcode: "8690003200001", warehouse: "B-1-01", cariCode: "110.05.001", reserved: 150, incoming: 500, unit: "metre" },
  { id: "KM-325", name: "Sifon Kumas", category: "Sifon", fabric: "Polyester Sifon", price: 48, cost: 18, sizes: "150cm en", colors: ["Siyah", "Beyaz", "Pudra", "Lila"], stock: 6800, totalSold: 9400, image: "", nebimCode: "NB-325-SFN", barcode: "8690003250001", warehouse: "A-3-01", cariCode: "110.06.001", reserved: 0, incoming: 0, unit: "metre" },
  { id: "KM-330", name: "Kadife Kumas", category: "Kadife", fabric: "Pamuk Kadife 320gr", price: 110, cost: 52, sizes: "140cm en", colors: ["Siyah", "Bordo", "Yesil", "Lacivert"], stock: 1200, totalSold: 4100, image: "", nebimCode: "NB-330-KDF", barcode: "8690003300001", warehouse: "B-2-01", cariCode: "110.07.001", reserved: 100, incoming: 800, unit: "metre" },
  { id: "KM-335", name: "Denim Kumas", category: "Denim", fabric: "Pamuk Denim 10oz", price: 78, cost: 35, sizes: "160cm en", colors: ["Koyu Mavi", "Acik Mavi", "Siyah"], stock: 2900, totalSold: 7600, image: "", nebimCode: "NB-335-DNM", barcode: "8690003350001", warehouse: "B-1-05", cariCode: "110.08.001", reserved: 200, incoming: 0, unit: "metre" },
  { id: "KM-340", name: "Triko Kumas", category: "Triko", fabric: "Akrilik/Yun Triko", price: 120, cost: 58, sizes: "170cm en", colors: ["Siyah", "Gri", "Bej", "Kahve"], stock: 950, totalSold: 3200, image: "", nebimCode: "NB-340-TRK", barcode: "8690003400001", warehouse: "B-3-01", cariCode: "110.09.001", reserved: 80, incoming: 600, unit: "metre" },
  { id: "KM-345", name: "Astar Kumas", category: "Astar", fabric: "Polyester Astar", price: 22, cost: 8, sizes: "150cm en", colors: ["Siyah", "Beyaz", "Bej"], stock: 12000, totalSold: 25000, image: "", nebimCode: "NB-345-AST", barcode: "8690003450001", warehouse: "A-3-10", cariCode: "110.10.001", reserved: 1000, incoming: 5000, unit: "metre" },
];

const CUSTOMER_PURCHASES = [
  {
    customer: "Anna Morozova", company: "VIPTEX", country: "Rusya", segment: 1,
    cariCode: "320.01.001", cariBalance: -18500, creditLimit: 80000,
    totalSpent: 245000, totalOrders: 8, totalItems: 12400, firstOrder: "2025-04-15", lastOrder: "2026-03-20",
    avgOrderValue: 30625, orderFrequencyDays: 42,
    nextVisitSuggestion: "2026-05-01",
    riskScore: "dusuk", demandTrend: "yukseliyor",
    purchases: [
      { productId: "KM-301", name: "Premium Saten", qty: 3200, total: 272000, dates: ["2025-04-15", "2025-08-20", "2025-12-10", "2026-03-20"] },
      { productId: "KM-305", name: "Krep Kumas", qty: 4500, total: 324000, dates: ["2025-04-15", "2025-08-20", "2026-01-05", "2026-03-20"] },
      { productId: "KM-310", name: "Viskon Dokuma", qty: 2800, total: 182000, dates: ["2025-08-20", "2026-01-05"] },
      { productId: "KM-345", name: "Astar Kumas", qty: 1900, total: 41800, dates: ["2025-04-15", "2025-12-10", "2026-03-20"] },
    ],
    insights: [
      "Her 42 gunde siparis veriyor → sonraki siparis tahmini: 1 Mayis 2026",
      "Saten ve krep en cok aldigi kumaslar - yeni renk secenekleri gonderilmeli",
      "Siparis hacmi artis trendinde: son 3 sipariste %15 artis",
      "Astar kumasiyla birlikte aliyor - paket teklif sunulabilir",
    ],
  },
  {
    customer: "Oleg Petrov", company: "Elena Chezelle", country: "Rusya", segment: 1,
    cariCode: "320.01.002", cariBalance: 0, creditLimit: 60000,
    totalSpent: 178400, totalOrders: 6, totalItems: 9800, firstOrder: "2025-03-10", lastOrder: "2026-02-15",
    avgOrderValue: 29733, orderFrequencyDays: 58,
    nextVisitSuggestion: "2026-04-14",
    riskScore: "dusuk", demandTrend: "sabit",
    purchases: [
      { productId: "KM-305", name: "Krep Kumas", qty: 3800, total: 273600, dates: ["2025-03-10", "2025-07-15", "2025-11-20", "2026-02-15"] },
      { productId: "KM-320", name: "Scuba Kumas", qty: 2200, total: 209000, dates: ["2025-07-15", "2025-11-20", "2026-02-15"] },
      { productId: "KM-335", name: "Denim Kumas", qty: 2400, total: 187200, dates: ["2025-03-10", "2025-11-20"] },
      { productId: "KM-315", name: "Pamuk Poplin", qty: 1400, total: 81200, dates: ["2025-07-15"] },
    ],
    insights: [
      "Krep ve scuba agirlikli alici - yeni scuba renkleri gosterilmeli",
      "58 gunluk siparis dongusu - 14 Nisan civarinda tekrar siparis bekleniyor",
      "Denim ilgisi var - yeni denim koleksiyonu sunulabilir",
      "Duzenli odeme yapan guvenilir musteri - kredi limiti artirilabilir",
    ],
  },
  {
    customer: "Kristina Boutique", company: "Kristina Boutique", country: "Rusya", segment: 1,
    cariCode: "320.01.003", cariBalance: -12800, creditLimit: 50000,
    totalSpent: 96500, totalOrders: 4, totalItems: 5600, firstOrder: "2025-09-05", lastOrder: "2026-03-22",
    avgOrderValue: 24125, orderFrequencyDays: 56,
    nextVisitSuggestion: "2026-05-17",
    riskScore: "dusuk", demandTrend: "yukseliyor",
    purchases: [
      { productId: "KM-301", name: "Premium Saten", qty: 1800, total: 153000, dates: ["2025-09-05", "2025-12-20", "2026-03-22"] },
      { productId: "KM-325", name: "Sifon Kumas", qty: 2200, total: 105600, dates: ["2025-09-05", "2026-03-22"] },
      { productId: "KM-310", name: "Viskon Dokuma", qty: 1600, total: 104000, dates: ["2025-12-20", "2026-03-22"] },
    ],
    insights: [
      "Hizla buyuyen musteri - son 4 ayda %40 artis",
      "Saten + sifon kombinasyonu aliyor - birlikte teklif sunulmali",
      "Son sipariste yeni kumas (viskon) denedi - portfoy genisliyor",
      "Kredi limiti %25 kullanilmis - guvenli musteri",
    ],
  },
  {
    customer: "Irina Kurganova", company: "Kurganova Fashion", country: "Rusya", segment: 1,
    cariCode: "320.01.004", cariBalance: 0, creditLimit: 25000,
    totalSpent: 42800, totalOrders: 2, totalItems: 2400, firstOrder: "2025-12-10", lastOrder: "2026-03-21",
    avgOrderValue: 21400, orderFrequencyDays: 101,
    nextVisitSuggestion: "2026-06-30",
    riskScore: "orta", demandTrend: "belirsiz",
    purchases: [
      { productId: "KM-310", name: "Viskon Dokuma", qty: 1400, total: 91000, dates: ["2025-12-10", "2026-03-21"] },
      { productId: "KM-315", name: "Pamuk Poplin", qty: 1000, total: 58000, dates: ["2026-03-21"] },
    ],
    insights: [
      "Henuz 2 siparis - 3. sipariste sadik musteriye donusebilir",
      "Viskon ilgisi yuksek - yeni viskon renkleri gonderilmeli",
      "Email kanali tercih ediyor - kisisellestirilmis mail kampanyasi olustur",
      "Siparis araligi uzun (101 gun) - hizlandirmak icin ozel teklif sunulabilir",
    ],
  },
  {
    customer: "Svetlana Sivaeva", company: "Terra", country: "Rusya", segment: 2,
    cariCode: "320.02.001", cariBalance: 0, creditLimit: 0,
    totalSpent: 0, totalOrders: 0, totalItems: 0, firstOrder: "-", lastOrder: "-",
    avgOrderValue: 0, orderFrequencyDays: 0,
    nextVisitSuggestion: "2026-04-01",
    riskScore: "yuksek", demandTrend: "belirsiz",
    purchases: [],
    insights: [
      "KAYIP RISKI: Fiyat listesi 18 Mart'ta gonderildi, 7 gundur donus yok",
      "Acil aksiyon: Numune paketi gonderilmeli (saten + krep karti)",
      "WhatsApp ile iletisim - 2 gunde bir takip mesaji onerilir",
      "Benzer profildeki Terra-tipi firmalar genelde krep ve viskon aliyor",
    ],
  },
  {
    customer: "Nadezdha Akulshina", company: "Tom Klaim", country: "Rusya", segment: 2,
    cariCode: "320.02.002", cariBalance: 0, creditLimit: 0,
    totalSpent: 0, totalOrders: 0, totalItems: 0, firstOrder: "-", lastOrder: "-",
    avgOrderValue: 0, orderFrequencyDays: 0,
    nextVisitSuggestion: "2026-04-01",
    riskScore: "orta", demandTrend: "belirsiz",
    purchases: [],
    insights: [
      "Numune talep etti ama karar vermedi - takip gerekiyor",
      "Tom Klaim kadin giyim markasi - saten ve sifon ilgi gorebilir",
      "3 kumas karti gonderilmeli: Premium Saten, Sifon, Krep",
      "VIPTEX fuarindan temas - fuar referansiyla yaklasim onerilir",
    ],
  },
];

const CATEGORIES = ["Tumu", "Saten", "Krep", "Viskon", "Pamuk", "Scuba", "Sifon", "Kadife", "Denim", "Triko", "Astar"];

const SEASONAL_DATA = [
  { season: "2025 Yaz", revenue: 185000, topProduct: "KM-310", orders: 14 },
  { season: "2025 Sonbahar", revenue: 245000, topProduct: "KM-305", orders: 18 },
  { season: "2025/26 Kis", revenue: 278000, topProduct: "KM-330", orders: 16 },
  { season: "2026 Ilkbahar", revenue: 312000, topProduct: "KM-301", orders: 22 },
];

// Proactive demand analysis
const PROACTIVE_ALERTS = [
  { type: "reorder", severity: "high", customer: "Anna Morozova", message: "Siparis dongusu dolmak uzere (42 gun). Son siparis: 20 Mart. Tahmini sonraki: 1 Mayis. Saten ve krep stok ayirma onerilir.", action: "Teklif Gonder" },
  { type: "reorder", severity: "medium", customer: "Oleg Petrov", message: "58 gunluk dongu - 14 Nisan'da siparis bekleniyor. Krep ve scuba hazirlanmali.", action: "Hatirlatma Gonder" },
  { type: "churn", severity: "high", customer: "Svetlana Sivaeva", message: "7 gundur yanit yok! Fiyat listesi gonderildi ama donus alinmadi. Kayip riski yuksek.", action: "Numune Gonder" },
  { type: "upsell", severity: "medium", customer: "Kristina Boutique", message: "Son 3 sipariste %40 artis. Kredi limiti yeterliligi kontrol edilmeli. VIP segmentine yukseltme onerilir.", action: "VIP Yukselt" },
  { type: "stock", severity: "high", customer: "-", message: "Triko Kumas (KM-340) stoku 950m - Anna ve Oleg'in talep edebilecegi sezon yaklasiyors. Tedarik planlanmali.", action: "Tedarik Baslat" },
  { type: "seasonal", severity: "medium", customer: "-", message: "Yaz sezonu yaklasiyorA: Sifon ve viskon talebi %35 artis bekleniyor. Gecen yaz verisine gore stok artirilmali.", action: "Stok Planla" },
  { type: "newlead", severity: "low", customer: "Nadezdha Akulshina", message: "Numune talep eden musteri 10 gundur bekliyor. 3 kumas karti gonderilmeli.", action: "Numune Gonder" },
];

export default function ProductsPage() {
  const { organization } = useAuthStore();
  const isDemo = isDemoOrg(organization?.name);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "customers" | "insights">("catalog");
  const [searchProduct, setSearchProduct] = useState("");
  const [filterCategory, setFilterCategory] = useState("Tumu");
  const [selectedCustomer, setSelectedCustomer] = useState<typeof CUSTOMER_PURCHASES[0] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<typeof PRODUCTS[0] | null>(null);

  useEffect(() => {
    if (!organization) return;
    setLoading(false);
  }, [organization]);

  const filteredProducts = PRODUCTS.filter(p => {
    if (filterCategory !== "Tumu" && p.category !== filterCategory) return false;
    if (searchProduct) {
      const q = searchProduct.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }
    return true;
  });

  const topProducts = [...PRODUCTS].sort((a, b) => b.totalSold - a.totalSold).slice(0, 5);
  const totalRevenue = PRODUCTS.reduce((s, p) => s + p.totalSold * p.price, 0);
  const totalProfit = PRODUCTS.reduce((s, p) => s + p.totalSold * (p.price - p.cost), 0);
  const avgMargin = ((totalProfit / totalRevenue) * 100);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Nebim Sync Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 flex items-center justify-center shadow-sm">
              <Database className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Nebim V3</span>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Bagli
                </span>
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Son sync: {NEBIM_SYNC.lastSync} | Sonraki: {NEBIM_SYNC.nextSync}</p>
            </div>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-4 text-[11px] text-emerald-700 dark:text-emerald-400">
          <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {NEBIM_SYNC.syncedProducts} urun</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {NEBIM_SYNC.syncedCustomers} cari</span>
          <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {NEBIM_SYNC.syncedInvoices} fatura</span>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 transition-colors">
            <RefreshCw className="h-3 w-3" /> Simdi Sync
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Urunler & Insight</h1>
          <p className="text-sm text-gray-500 mt-1">Nebim ERP + CRM verileri ile urun ve musteri analizi</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {[
            { key: "catalog", label: "Katalog" },
            { key: "customers", label: "Musteri Insight" },
            { key: "insights", label: "Urun Analizi" },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CATALOG TAB ===== */}
      {activeTab === "catalog" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950"><Package className="h-4 w-4 text-blue-600" /></div>
                <span className="text-xs text-gray-500">Toplam Urun</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{PRODUCTS.length}</p>
              <p className="text-[10px] text-gray-400 mt-1">{CATEGORIES.length - 1} kategori</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950"><ShoppingCart className="h-4 w-4 text-green-600" /></div>
                <span className="text-xs text-gray-500">Toplam Satilan</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{PRODUCTS.reduce((s, p) => s + p.totalSold, 0).toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-1">adet</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
                <span className="text-xs text-gray-500">Toplam Ciro</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${(totalRevenue / 1000).toFixed(0)}K</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950"><TrendingUp className="h-4 w-4 text-violet-600" /></div>
                <span className="text-xs text-gray-500">Kar Marji</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">%{avgMargin.toFixed(1)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)}
                placeholder="Urun ara (isim, kod, kategori)..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    filterCategory === cat ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => {
              const revenue = product.totalSold * product.price;
              const profit = product.totalSold * (product.price - product.cost);
              const margin = ((profit / revenue) * 100);
              return (
                <div key={product.id} className="card p-4 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setSelectedProduct(product)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">{product.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 font-medium">{product.category}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-1.5">{product.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{product.fabric} | {product.sizes} | {product.unit}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center flex-shrink-0">
                      <Layers className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-3">
                    {product.colors.map(c => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800 text-gray-500">{c}</span>
                    ))}
                  </div>
                  {/* Nebim badge */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">{product.nebimCode}</span>
                    <span className="text-[9px] text-gray-400">{product.warehouse}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                    <div>
                      <p className="text-[10px] text-gray-400">Fiyat</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">${product.price}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Satilan</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{product.totalSold}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Stok</p>
                      <p className={`text-sm font-bold ${product.stock < 50 ? "text-red-600" : product.stock < 100 ? "text-amber-600" : "text-green-600"}`}>{product.stock}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Rezerve</p>
                      <p className="text-sm font-bold text-orange-600">{product.reserved}</p>
                    </div>
                  </div>
                  {product.incoming > 0 && (
                    <p className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" /> {product.incoming} adet yolda (Nebim)
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Product Detail Modal */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedProduct(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-mono text-gray-400">{selectedProduct.id}</span>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h2>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 font-medium">{selectedProduct.category}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <p className="text-[10px] text-gray-400 mb-1">Satis Fiyati</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">${selectedProduct.price}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <p className="text-[10px] text-gray-400 mb-1">Maliyet</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">${selectedProduct.cost}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <p className="text-[10px] text-gray-400 mb-1">Kar Marji</p>
                    <p className="text-lg font-bold text-green-600">%{(((selectedProduct.price - selectedProduct.cost) / selectedProduct.price) * 100).toFixed(0)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <p className="text-[10px] text-gray-400 mb-1">Toplam Ciro</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">${(selectedProduct.totalSold * selectedProduct.price).toLocaleString()}</p>
                  </div>
                </div>
                {/* Nebim ERP Info */}
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Database className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Nebim V3 Verileri</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-emerald-600">Nebim Kodu</span><span className="font-mono font-medium text-gray-900 dark:text-white">{selectedProduct.nebimCode}</span></div>
                    <div className="flex justify-between"><span className="text-emerald-600">Barkod</span><span className="font-mono font-medium text-gray-900 dark:text-white">{selectedProduct.barcode}</span></div>
                    <div className="flex justify-between"><span className="text-emerald-600">Depo Raf</span><span className="font-medium text-gray-900 dark:text-white">{selectedProduct.warehouse}</span></div>
                    <div className="flex justify-between"><span className="text-emerald-600">Cari Kodu</span><span className="font-mono font-medium text-gray-900 dark:text-white">{selectedProduct.cariCode}</span></div>
                    <div className="flex justify-between"><span className="text-emerald-600">Rezerve</span><span className="font-medium text-orange-600">{selectedProduct.reserved} adet</span></div>
                    <div className="flex justify-between"><span className="text-emerald-600">Yolda</span><span className="font-medium text-blue-600">{selectedProduct.incoming} adet</span></div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-gray-500">Kumas</span><span className="font-medium text-gray-900 dark:text-white">{selectedProduct.fabric}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-gray-500">En / Birim</span><span className="font-medium text-gray-900 dark:text-white">{selectedProduct.sizes} | {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-gray-500">Renkler</span><span className="font-medium text-gray-900 dark:text-white">{selectedProduct.colors.join(", ")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-gray-500">Net Stok</span>
                    <span className={`font-medium ${selectedProduct.stock - selectedProduct.reserved < 50 ? "text-red-600" : "text-green-600"}`}>{selectedProduct.stock - selectedProduct.reserved} adet (stok {selectedProduct.stock} - rezerve {selectedProduct.reserved})</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">Toplam Satilan</span><span className="font-bold text-gray-900 dark:text-white">{selectedProduct.totalSold} adet</span>
                  </div>
                </div>
                {/* Who bought this */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-gray-500 mb-2">BU URUNU ALAN MUSTERILER</h4>
                  <div className="space-y-1.5">
                    {CUSTOMER_PURCHASES.filter(c => c.purchases.some(p => p.productId === selectedProduct.id)).map(c => {
                      const purchase = c.purchases.find(p => p.productId === selectedProduct.id)!;
                      return (
                        <div key={c.customer} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                          <span className="font-medium text-gray-900 dark:text-white">{c.customer}</span>
                          <span className="text-gray-500">{purchase.qty} adet | ${purchase.total.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">Kapat</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== CUSTOMER INSIGHT TAB ===== */}
      {activeTab === "customers" && (
        <>
          {selectedCustomer ? (
            /* Customer Detail */
            <div className="space-y-6">
              <button onClick={() => setSelectedCustomer(null)} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                ← Tum Musteriler
              </button>

              {/* Customer Header */}
              <div className="card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCustomer.customer}</h2>
                    <p className="text-sm text-gray-500">{selectedCustomer.company} | {selectedCustomer.country}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    selectedCustomer.segment === 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" :
                    selectedCustomer.segment === 2 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-gray-100 text-gray-600"
                  }`}>
                    Segment {selectedCustomer.segment}
                  </span>
                </div>
                {/* Nebim Cari Info */}
                {selectedCustomer.cariCode && (
                  <div className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
                    <Database className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-emerald-600">Cari: <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedCustomer.cariCode}</span></span>
                      {selectedCustomer.cariBalance !== 0 && (
                        <span className={selectedCustomer.cariBalance < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          Bakiye: ${Math.abs(selectedCustomer.cariBalance).toLocaleString()} {selectedCustomer.cariBalance < 0 ? "(Borc)" : "(Alacak)"}
                        </span>
                      )}
                      {selectedCustomer.creditLimit > 0 && (
                        <span className="text-gray-500">Kredi Limiti: ${selectedCustomer.creditLimit.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
                    <p className="text-[10px] text-gray-400">Toplam Harcama</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">${selectedCustomer.totalSpent.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
                    <p className="text-[10px] text-gray-400">Siparis Sayisi</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedCustomer.totalOrders}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
                    <p className="text-[10px] text-gray-400">Ort. Siparis</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">${selectedCustomer.avgOrderValue.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
                    <p className="text-[10px] text-gray-400">Siparis Sikligi</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedCustomer.orderFrequencyDays || "-"} gun</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950 text-center border border-amber-200 dark:border-amber-800">
                    <p className="text-[10px] text-amber-600">Sonraki Ziyaret</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{selectedCustomer.nextVisitSuggestion}</p>
                  </div>
                </div>
              </div>

              {/* Insights */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" /> Aksiyon Onerileri
                </h3>
                <div className="space-y-2">
                  {selectedCustomer.insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700 dark:text-slate-300">{ins}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purchase History */}
              {selectedCustomer.purchases.length > 0 ? (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600" /> Satin Alma Gecmisi
                  </h3>
                  <div className="space-y-3">
                    {selectedCustomer.purchases.map(p => (
                      <div key={p.productId} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                          <Layers className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-400">{p.productId}</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{p.qty} adet</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-xs text-gray-500">{p.dates.length}x siparis</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-xs text-gray-400">Son: {p.dates[p.dates.length - 1]}</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white flex-shrink-0">${p.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Henuz siparis yok</p>
                  <p className="text-sm text-gray-400 mt-1">Bu musteri potansiyel - numune gonderimi oneriliyor</p>
                </div>
              )}
            </div>
          ) : (
            /* Customer List */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CUSTOMER_PURCHASES.map(cust => (
                  <div key={cust.customer} className="card p-4 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => setSelectedCustomer(cust)}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{cust.customer}</h3>
                        <p className="text-xs text-gray-500">{cust.company} | {cust.country}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <p className="text-[10px] text-gray-400">Harcama</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{cust.totalSpent > 0 ? `$${(cust.totalSpent / 1000).toFixed(0)}K` : "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Siparis</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{cust.totalOrders || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Urun</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{cust.purchases.length || "-"}</p>
                      </div>
                    </div>
                    {/* Risk & Trend badges */}
                    <div className="flex items-center gap-2 mb-2">
                      {cust.riskScore && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          cust.riskScore === "dusuk" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" :
                          cust.riskScore === "orta" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                        }`}>
                          Risk: {cust.riskScore}
                        </span>
                      )}
                      {cust.demandTrend && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          cust.demandTrend === "yukseliyor" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" :
                          cust.demandTrend === "sabit" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"
                        }`}>
                          Talep: {cust.demandTrend}
                        </span>
                      )}
                    </div>
                    {cust.nextVisitSuggestion && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950 px-2.5 py-1.5 rounded-lg">
                        <Clock className="h-3 w-3" />
                        Sonraki ziyaret: {cust.nextVisitSuggestion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ===== PRODUCT INSIGHTS TAB ===== */}
      {activeTab === "insights" && (
        <>
          {/* Top Sellers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> En Cok Satan Urunler
              </h3>
              <div className="space-y-3">
                {topProducts.map((p, i) => {
                  const maxSold = topProducts[0].totalSold;
                  const pct = (p.totalSold / maxSold) * 100;
                  return (
                    <div key={p.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                            i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-gray-300"
                          }`}>{i + 1}</span>
                          <span className="font-medium text-gray-700 dark:text-slate-300">{p.name}</span>
                          <span className="text-gray-400">{p.id}</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">{p.totalSold}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden ml-7">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-600" /> Kategori Performansi
              </h3>
              <div className="space-y-3">
                {(() => {
                  const cats = CATEGORIES.filter(c => c !== "Tumu").map(cat => {
                    const prods = PRODUCTS.filter(p => p.category === cat);
                    const sold = prods.reduce((s, p) => s + p.totalSold, 0);
                    const rev = prods.reduce((s, p) => s + p.totalSold * p.price, 0);
                    return { cat, count: prods.length, sold, rev };
                  }).sort((a, b) => b.rev - a.rev);
                  const maxRev = cats[0]?.rev || 1;
                  return cats.map(c => (
                    <div key={c.cat}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-slate-300">{c.cat} ({c.count} urun)</span>
                        <span className="text-gray-500">${(c.rev / 1000).toFixed(0)}K | {c.sold} adet</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500" style={{ width: `${(c.rev / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Seasonal Trends */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" /> Sezonluk Trend
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {SEASONAL_DATA.map(s => {
                const topProd = PRODUCTS.find(p => p.id === s.topProduct);
                return (
                  <div key={s.season} className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">{s.season}</h4>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">${(s.revenue / 1000).toFixed(0)}K</p>
                    <p className="text-xs text-gray-500 mt-1">{s.orders} siparis</p>
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                      <p className="text-[10px] text-gray-400">En cok satan</p>
                      <p className="text-xs font-medium text-gray-700 dark:text-slate-300">{topProd?.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Dusuk Stok Uyarilari
            </h3>
            <div className="space-y-2">
              {PRODUCTS.filter(p => p.stock < 100).sort((a, b) => a.stock - b.stock).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-950/30 border border-red-100 dark:border-red-900">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400">{p.id}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${p.stock < 50 ? "text-red-600" : "text-amber-600"}`}>{p.stock} adet</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.stock < 50 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.stock < 50 ? "Kritik" : "Dusuk"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cross-sell Matrix */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-green-600" /> Birlikte Satilan Urunler
            </h3>
            <div className="space-y-2">
              {[
                { pair: ["Premium Saten", "Astar Kumas"], customers: 3, suggestion: "Saten alan musteriler %80 oraninda astar da aliyor - birlikte teklif sun" },
                { pair: ["Krep Kumas", "Viskon Dokuma"], customers: 2, suggestion: "Krep ve viskon birlikte tercih ediliyor - karisik numune paketi hazirla" },
                { pair: ["Premium Saten", "Sifon Kumas"], customers: 2, suggestion: "Hafif kumas kombinasyonu - kadin giyim ureticileri icin ideal paket" },
                { pair: ["Scuba Kumas", "Denim Kumas"], customers: 1, suggestion: "Her iki kumas da casual giyim ureticileri tarafindan tercih ediliyor" },
              ].map((cs, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-green-50/50 dark:bg-green-950/30 border border-green-100 dark:border-green-900">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-gray-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600">{cs.pair[0]}</span>
                    <span className="text-gray-300">+</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600">{cs.pair[1]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 truncate">{cs.suggestion}</p>
                  </div>
                  <span className="text-xs text-green-600 font-medium flex-shrink-0">{cs.customers} musteri</span>
                </div>
              ))}
            </div>
          </div>

          {/* Proactive Demand Analysis */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" /> Proaktif Talep Analizi & Aksiyonlar
            </h3>
            <div className="space-y-2">
              {PROACTIVE_ALERTS.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                  alert.severity === "high" ? "bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-900" :
                  alert.severity === "medium" ? "bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900" :
                  "bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    alert.type === "reorder" ? "bg-blue-100 dark:bg-blue-900" :
                    alert.type === "churn" ? "bg-red-100 dark:bg-red-900" :
                    alert.type === "upsell" ? "bg-green-100 dark:bg-green-900" :
                    alert.type === "stock" ? "bg-amber-100 dark:bg-amber-900" :
                    alert.type === "seasonal" ? "bg-violet-100 dark:bg-violet-900" :
                    "bg-cyan-100 dark:bg-cyan-900"
                  }`}>
                    {alert.type === "reorder" && <Repeat className="h-4 w-4 text-blue-600" />}
                    {alert.type === "churn" && <AlertCircle className="h-4 w-4 text-red-600" />}
                    {alert.type === "upsell" && <TrendingUp className="h-4 w-4 text-green-600" />}
                    {alert.type === "stock" && <Package className="h-4 w-4 text-amber-600" />}
                    {alert.type === "seasonal" && <Calendar className="h-4 w-4 text-violet-600" />}
                    {alert.type === "newlead" && <Users className="h-4 w-4 text-cyan-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        alert.type === "reorder" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                        alert.type === "churn" ? "bg-red-100 text-red-700" :
                        alert.type === "upsell" ? "bg-green-100 text-green-700" :
                        alert.type === "stock" ? "bg-amber-100 text-amber-700" :
                        alert.type === "seasonal" ? "bg-violet-100 text-violet-700" :
                        "bg-cyan-100 text-cyan-700"
                      }`}>
                        {alert.type === "reorder" ? "Tekrar Siparis" : alert.type === "churn" ? "Kayip Riski" : alert.type === "upsell" ? "Upsell" : alert.type === "stock" ? "Stok Uyarisi" : alert.type === "seasonal" ? "Sezon Tahmini" : "Yeni Lead"}
                      </span>
                      {alert.customer !== "-" && <span className="text-xs font-medium text-gray-900 dark:text-white">{alert.customer}</span>}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        alert.severity === "high" ? "bg-red-100 text-red-600" : alert.severity === "medium" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                      }`}>
                        {alert.severity === "high" ? "Acil" : alert.severity === "medium" ? "Orta" : "Bilgi"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-400">{alert.message}</p>
                  </div>
                  <button className={`flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    alert.severity === "high" ? "bg-red-600 hover:bg-red-700 text-white" :
                    alert.severity === "medium" ? "bg-amber-600 hover:bg-amber-700 text-white" :
                    "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}>
                    {alert.action}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
