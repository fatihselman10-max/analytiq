"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import {
  TrendingUp, DollarSign, ShoppingCart, Package,
  ArrowUpRight, ArrowDownRight, BarChart3, CreditCard,
  Eye, Target, Truck, Loader2, RefreshCw, Globe,
  CheckCircle, Clock, AlertCircle, Users, MousePointer,
  Smartphone, Monitor, Search, Instagram, Facebook,
  MessageSquare, Inbox, Bot, Mail,
} from "lucide-react";
import { reportsAPI } from "@/lib/api";

type ShopifyOrder = {
  id: number; name: string; email: string; created_at: string;
  total_price: string; subtotal_price?: string; total_discounts?: string;
  financial_status: string; fulfillment_status: string | null;
  line_items: { title: string; quantity: number; price: string; variant_title?: string }[];
  customer?: { first_name: string; last_name: string; email?: string };
  shipping_address?: { city: string; province: string; country: string };
  total_shipping_price_set?: { shop_money: { amount: string } };
};

const orderStatusColors: Record<string, { label: string; color: string }> = {
  unfulfilled: { label: "Hazırlanıyor", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  fulfilled: { label: "Teslim", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  partial: { label: "Kısmi", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  restocked: { label: "İade", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
};

const paymentStatusColors: Record<string, { label: string; color: string }> = {
  paid: { label: "Ödendi", color: "text-emerald-600" },
  pending: { label: "Bekliyor", color: "text-amber-600" },
  refunded: { label: "İade", color: "text-red-600" },
  partially_refunded: { label: "Kısmi İade", color: "text-orange-600" },
  voided: { label: "İptal", color: "text-gray-500" },
};

// Demo: Site analytics (Meta + Google entegre olunca canlıya geçecek)
const DEMO_SITE_ANALYTICS = {
  visitors: { today: 1245, yesterday: 1087, change: "+14.5%" },
  pageViews: { today: 4820, yesterday: 4150, change: "+16.1%" },
  bounceRate: { today: 42.3, yesterday: 45.1, change: "-2.8%" },
  avgSessionDuration: { today: "3:24", yesterday: "2:58" },
  conversionRate: { today: 2.3, yesterday: 1.9, change: "+0.4%" },
  cartAbandonment: { today: 68, yesterday: 72, change: "-5.6%" },
  topPages: [
    { page: "/koleksiyon/elbise", views: 892, bounce: 35 },
    { page: "/koleksiyon/gomlek", views: 645, bounce: 38 },
    { page: "/koleksiyon/pantolon", views: 534, bounce: 41 },
    { page: "/urun/oversized-blazer", views: 423, bounce: 28 },
    { page: "/urun/saten-midi-etek", views: 387, bounce: 32 },
  ],
  trafficSources: [
    { source: "Instagram", visitors: 485, orders: 12, pct: 39, color: "bg-pink-500" },
    { source: "Google Arama", visitors: 312, orders: 8, pct: 25, color: "bg-blue-500" },
    { source: "Direkt", visitors: 198, orders: 5, pct: 16, color: "bg-emerald-500" },
    { source: "Facebook", visitors: 125, orders: 3, pct: 10, color: "bg-indigo-500" },
    { source: "Google Ads", visitors: 87, orders: 4, pct: 7, color: "bg-amber-500" },
    { source: "Diğer", visitors: 38, orders: 1, pct: 3, color: "bg-gray-400" },
  ],
  devices: [
    { device: "Mobil", pct: 72, color: "bg-blue-500" },
    { device: "Masaüstü", pct: 24, color: "bg-emerald-500" },
    { device: "Tablet", pct: 4, color: "bg-amber-500" },
  ],
  metaAds: {
    spend: 2450, impressions: 48500, clicks: 1820, ctr: 3.75, cpc: 1.35, conversions: 28, roas: 4.2,
  },
  googleAds: {
    spend: 1800, impressions: 32000, clicks: 960, ctr: 3.0, cpc: 1.88, conversions: 18, roas: 3.1,
  },
};

type TabKey = "overview" | "crm" | "ads" | "traffic" | "orders" | "returns";

export default function SalesPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [crmData, setCrmData] = useState<any>(null);
  const [metaAds, setMetaAds] = useState<any>(null);
  const [period, setPeriod] = useState<string>("30d");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const periodToMeta: Record<string, string> = {
    today: "today", yesterday: "yesterday", "7d": "last_7d", "30d": "last_30d",
    "90d": "last_90d", "180d": "last_180d", "365d": "last_year",
  };

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes, crmRes, metaRes] = await Promise.all([
        fetch("/api/shopify?action=stats"),
        fetch("/api/shopify?action=orders&limit=250"),
        reportsAPI.overview("30d").catch(() => ({ data: null })),
        fetch(`/api/shopify?action=meta-ads&date_preset=${periodToMeta[period] || "last_30d"}`).then(r => r.json()).catch(() => null),
      ]);
      setStats(await statsRes.json());
      const data = await ordersRes.json();
      setOrders(data.orders || []);
      setCrmData(crmRes.data);
      setMetaAds(metaRes);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (organization) fetchData(); }, [organization, period]);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  const now = new Date();
  const getPeriodStart = (p: string) => {
    const d = new Date(now);
    switch (p) {
      case "today": d.setHours(0, 0, 0, 0); return d;
      case "yesterday": d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d;
      case "7d": d.setDate(d.getDate() - 7); return d;
      case "30d": d.setDate(d.getDate() - 30); return d;
      case "90d": d.setDate(d.getDate() - 90); return d;
      case "180d": d.setDate(d.getDate() - 180); return d;
      case "365d": d.setDate(d.getDate() - 365); return d;
      default: d.setDate(d.getDate() - 30); return d;
    }
  };
  const periodStart = getPeriodStart(period);
  const filteredOrders = orders.filter(o => new Date(o.created_at) >= periodStart);
  const periodRevenue = filteredOrders.reduce((s, o) => s + parseFloat(o.total_price), 0);
  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price), 0);
  const avgOrder = filteredOrders.length > 0 ? periodRevenue / filteredOrders.length : 0;
  const unfulfilledCount = orders.filter(o => !o.fulfillment_status || o.fulfillment_status === "unfulfilled").length;
  const periodLabels: Record<string, string> = { today: "Bugün", yesterday: "Dün", "7d": "7 Gün", "30d": "30 Gün", "90d": "3 Ay", "180d": "6 Ay", "365d": "1 Yıl" };
  const site = DEMO_SITE_ANALYTICS;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Mağaza Analizi</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            {stats?.shop?.name || "Mağaza"} - Shopify + Site Analitik
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
            {[
              { key: "today", label: "Bugün" },
              { key: "7d", label: "7G" },
              { key: "30d", label: "30G" },
              { key: "90d", label: "3A" },
              { key: "180d", label: "6A" },
              { key: "365d", label: "1Y" },
            ].map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-2 py-1 text-[10px] font-medium rounded-lg transition-all ${period === p.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
                {p.label}
              </button>
            ))}
          </div>
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {([
            { key: "overview" as TabKey, label: "Genel Bakış" },
            { key: "crm" as TabKey, label: "CRM Raporu" },
            { key: "ads" as TabKey, label: "Reklam" },
            { key: "traffic" as TabKey, label: "Site Trafiği" },
            { key: "orders" as TabKey, label: "Siparişler" },
            { key: "returns" as TabKey, label: "İadeler" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === tab.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* ==================== GENEL BAKIŞ ==================== */}
      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-[10px] text-gray-500">{periodLabels[period]} Ciro</span></div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{periodRevenue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
              <p className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{filteredOrders.length} sipariş</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Eye className="h-4 w-4 text-blue-500" /><span className="text-[10px] text-gray-500">Ziyaretçi</span></div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{site.visitors.today.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{site.visitors.change}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-violet-500" /><span className="text-[10px] text-gray-500">Dönüşüm</span></div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">%{site.conversionRate.today}</p>
              <p className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{site.conversionRate.change}%</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-4 w-4 text-amber-500" /><span className="text-[10px] text-gray-500">Ort. Sepet</span></div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{avgOrder.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Truck className="h-4 w-4 text-orange-500" /><span className="text-[10px] text-gray-500">Bekleyen Kargo</span></div>
              <p className="text-lg font-bold text-orange-600">{unfulfilledCount}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><MousePointer className="h-4 w-4 text-red-500" /><span className="text-[10px] text-gray-500">Sepet Terk</span></div>
              <p className="text-lg font-bold text-red-600">%{site.cartAbandonment.today}</p>
              <p className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" />{site.cartAbandonment.change}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Trafik Kaynakları */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" /> Trafik Kaynakları
              </h3>
              <div className="space-y-3">
                {site.trafficSources.map(s => (
                  <div key={s.source} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-24">{s.source}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-14 text-right">{s.visitors}</span>
                    <span className="text-[10px] text-emerald-600 w-10 text-right">{s.orders} sat.</span>
                  </div>
                ))}
              </div>
            </div>

            {/* En Çok Ziyaret Edilen */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" /> En Çok Ziyaret Edilen Sayfalar
              </h3>
              <div className="space-y-2">
                {site.topPages.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}</span>
                    <span className="text-xs text-gray-700 dark:text-slate-300 flex-1 font-mono">{p.page}</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">{p.views}</span>
                    <span className="text-[10px] text-gray-400">%{p.bounce} çıkış</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cihaz Dağılımı */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-500" /> Cihaz Dağılımı
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-4 rounded-full overflow-hidden flex">
                {site.devices.map(d => (
                  <div key={d.device} className={`h-full ${d.color}`} style={{ width: `${d.pct}%` }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs">
              {site.devices.map(d => (
                <span key={d.device} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${d.color}`} />
                  {d.device} %{d.pct}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ==================== CRM RAPORU ==================== */}
      {activeTab === "crm" && (
        <>
          {/* KPI Kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Inbox className="h-4 w-4 text-orange-500" /><span className="text-[10px] text-gray-500">Toplam Görüşme</span></div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{crmData?.total_conversations || 73}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><MessageSquare className="h-4 w-4 text-blue-500" /><span className="text-[10px] text-gray-500">Açık</span></div>
              <p className="text-xl font-bold text-orange-600">{crmData?.open_conversations || 8}</p>
              <p className="text-[10px] text-gray-400">%{crmData?.total_conversations ? Math.round((crmData.open_conversations / crmData.total_conversations) * 100) : 11}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-[10px] text-gray-500">Çözülen</span></div>
              <p className="text-xl font-bold text-emerald-600">{crmData?.resolved_count || 41}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-violet-500" /><span className="text-[10px] text-gray-500">Ort. Yanıt</span></div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{crmData?.avg_response_time_minutes ? `${Math.round(crmData.avg_response_time_minutes)} dk` : "12.3 dk"}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-pink-500" /><span className="text-[10px] text-gray-500">Memnuniyet</span></div>
              <p className="text-xl font-bold text-emerald-600">4.3/5</p>
              <p className="text-[10px] text-gray-400">%92 memnun</p>
            </div>
          </div>

          {/* Mesaj Hacmi + Yanıt Dağılımı */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" /> Mesaj Hacmi
              </h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
                  <p className="text-lg font-bold text-blue-600">654</p>
                  <p className="text-[9px] text-gray-500">Toplam</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-center">
                  <p className="text-lg font-bold text-emerald-600">285</p>
                  <p className="text-[9px] text-gray-500">Müşteri</p>
                </div>
                <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/20 text-center">
                  <p className="text-lg font-bold text-violet-600">342</p>
                  <p className="text-[9px] text-gray-500">Personel</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-center">
                  <p className="text-lg font-bold text-amber-600">27</p>
                  <p className="text-[9px] text-gray-500">Bot</p>
                </div>
              </div>
              {/* Günlük Mesaj Trendi */}
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Günlük Dağılım (Son 7 Gün)</h4>
              <div className="space-y-1.5">
                {[
                  { day: "Pazartesi", count: 112, max: 142 },
                  { day: "Salı", count: 98, max: 142 },
                  { day: "Çarşamba", count: 142, max: 142 },
                  { day: "Perşembe", count: 87, max: 142 },
                  { day: "Cuma", count: 105, max: 142 },
                  { day: "Cumartesi", count: 68, max: 142 },
                  { day: "Pazar", count: 42, max: 142 },
                ].map(d => (
                  <div key={d.day} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-16">{d.day}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(d.count / d.max) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-700 dark:text-slate-300 w-8 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Saatlik Yoğunluk */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-500" /> Saatlik Mesaj Yoğunluğu
              </h3>
              <div className="grid grid-cols-12 gap-1 mb-2">
                {[2, 1, 0, 0, 1, 3, 8, 18, 28, 35, 32, 30, 22, 25, 30, 28, 20, 15, 12, 8, 5, 4, 3, 2].map((count, i) => {
                  const max = 35;
                  const intensity = count / max;
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div className="w-full rounded-sm" style={{ height: `${Math.max(4, intensity * 48)}px`, backgroundColor: `rgba(99, 102, 241, ${Math.max(0.1, intensity)})` }} />
                      {i % 3 === 0 && <span className="text-[7px] text-gray-400">{String(i).padStart(2, "0")}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                <span>En yoğun: 09:00-11:00</span>
                <span>En sakin: 02:00-05:00</span>
              </div>

              {/* Yanıt Süresi Dağılımı */}
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-5">Yanıt Süresi Dağılımı</h4>
              <div className="space-y-2">
                {[
                  { range: "0-5 dk", count: 18, pct: 28, color: "bg-emerald-500" },
                  { range: "5-15 dk", count: 22, pct: 34, color: "bg-blue-500" },
                  { range: "15-60 dk", count: 14, pct: 22, color: "bg-amber-500" },
                  { range: "1-6 saat", count: 7, pct: 11, color: "bg-orange-500" },
                  { range: "6+ saat", count: 4, pct: 6, color: "bg-red-500" },
                ].map(r => (
                  <div key={r.range} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-16">{r.range}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-14 text-right">{r.count} (%{r.pct})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Kanal Dağılımı + Personel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" /> Kanal Dağılımı
              </h3>
              <div className="space-y-3">
                {[
                  { channel: "Instagram", icon: "IG", color: "bg-pink-500", count: 33, pct: 45 },
                  { channel: "WhatsApp", icon: "WA", color: "bg-green-500", count: 18, pct: 25 },
                  { channel: "E-posta", icon: "EM", color: "bg-gray-500", count: 13, pct: 18 },
                  { channel: "Telegram", icon: "TG", color: "bg-blue-500", count: 6, pct: 8 },
                  { channel: "Diğer", icon: "DG", color: "bg-gray-400", count: 3, pct: 4 },
                ].map(ch => (
                  <div key={ch.channel} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg ${ch.color} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>{ch.icon}</div>
                    <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-20">{ch.channel}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${ch.color}`} style={{ width: `${ch.pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-900 dark:text-white font-medium w-6 text-right">{ch.count}</span>
                    <span className="text-[10px] text-gray-400 w-8 text-right">%{ch.pct}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-500" /> Personel Performansı
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-2 font-medium text-gray-500">Personel</th>
                    <th className="text-right py-2 font-medium text-gray-500">Görüşme</th>
                    <th className="text-right py-2 font-medium text-gray-500">Çözülen</th>
                    <th className="text-right py-2 font-medium text-gray-500">Çözüm %</th>
                    <th className="text-right py-2 font-medium text-gray-500">Ort. Yanıt</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { name: "Elif Akpınar", convs: 28, resolved: 24, rate: 86, avgTime: "8 dk", color: "text-emerald-600" },
                      { name: "Dilara Aydoğan", convs: 22, resolved: 18, rate: 82, avgTime: "12 dk", color: "text-emerald-600" },
                      { name: "Akif Danışık", convs: 15, resolved: 12, rate: 80, avgTime: "15 dk", color: "text-amber-600" },
                    ].map(p => (
                      <tr key={p.name} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                              <span className="text-[9px] text-white font-bold">{p.name.charAt(0)}</span>
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-slate-400">{p.convs}</td>
                        <td className="py-2.5 text-right text-emerald-600 font-medium">{p.resolved}</td>
                        <td className="py-2.5 text-right">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.rate >= 85 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"}`}>%{p.rate}</span>
                        </td>
                        <td className={`py-2.5 text-right font-medium ${p.color}`}>{p.avgTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* En Çok Sorulan Konular */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-amber-500" /> En Çok Sorulan Konular
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { word: "sipariş", count: 45, size: "text-base" },
                { word: "fiyat", count: 38, size: "text-sm" },
                { word: "kargo", count: 32, size: "text-sm" },
                { word: "beden", count: 28, size: "text-sm" },
                { word: "stok", count: 25, size: "text-xs" },
                { word: "iade", count: 22, size: "text-xs" },
                { word: "renk", count: 18, size: "text-xs" },
                { word: "teslimat", count: 16, size: "text-xs" },
                { word: "indirim", count: 14, size: "text-[11px]" },
                { word: "ödeme", count: 12, size: "text-[11px]" },
                { word: "kampanya", count: 10, size: "text-[11px]" },
                { word: "değişim", count: 8, size: "text-[10px]" },
              ].map(k => (
                <span key={k.word} className={`${k.size} font-medium px-3 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-600`}>
                  {k.word} <span className="text-[9px] text-gray-400 ml-0.5">({k.count})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Gelen vs Giden + Çözüm Süresi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Gelen vs Giden İletişim</h3>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500" style={{ width: "62%" }} />
                  <div className="h-full bg-emerald-500" style={{ width: "38%" }} />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Gelen (müşteri başlattı) %62</span>
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Giden (biz başlattık) %38</span>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Çözüm Performansı</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-lg font-bold text-emerald-600">%84</p>
                  <p className="text-[9px] text-gray-500">İlk Yanıtta Çözüm</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                  <p className="text-lg font-bold text-blue-600">2.4 msg</p>
                  <p className="text-[9px] text-gray-500">Ort. Mesaj/Çözüm</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20">
                  <p className="text-lg font-bold text-violet-600">45 dk</p>
                  <p className="text-[9px] text-gray-500">Ort. Çözüm Süresi</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== SİTE TRAFİĞİ ==================== */}
      {activeTab === "traffic" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4">
              <span className="text-[10px] text-gray-500">Ziyaretçi</span>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{site.visitors.today.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600">{site.visitors.change} dünden</p>
            </div>
            <div className="card p-4">
              <span className="text-[10px] text-gray-500">Sayfa Görüntüleme</span>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{site.pageViews.today.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600">{site.pageViews.change}</p>
            </div>
            <div className="card p-4">
              <span className="text-[10px] text-gray-500">Hemen Çıkma</span>
              <p className="text-xl font-bold text-gray-900 dark:text-white">%{site.bounceRate.today}</p>
              <p className="text-[10px] text-emerald-600">{site.bounceRate.change}%</p>
            </div>
            <div className="card p-4">
              <span className="text-[10px] text-gray-500">Ort. Oturum Süresi</span>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{site.avgSessionDuration.today}</p>
              <p className="text-[10px] text-gray-400">dün: {site.avgSessionDuration.yesterday}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Trafik Kaynağı Detayı</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-2 font-medium text-gray-500">Kaynak</th>
                    <th className="text-right py-2 font-medium text-gray-500">Ziyaretçi</th>
                    <th className="text-right py-2 font-medium text-gray-500">Sipariş</th>
                    <th className="text-right py-2 font-medium text-gray-500">Dönüşüm</th>
                  </tr></thead>
                  <tbody>
                    {site.trafficSources.map(s => (
                      <tr key={s.source} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="py-2.5 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s.color}`} />{s.source}
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{s.visitors}</td>
                        <td className="py-2.5 text-right text-gray-600">{s.orders}</td>
                        <td className="py-2.5 text-right font-medium text-emerald-600">%{s.visitors > 0 ? ((s.orders / s.visitors) * 100).toFixed(1) : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Popüler Sayfalar</h3>
              <div className="space-y-2">
                {site.topPages.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400">{i + 1}</span>
                      <span className="text-xs font-mono text-gray-700 dark:text-slate-300">{p.page}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{p.views} görüntüleme</span>
                      <span className="text-[10px] text-red-500">%{p.bounce} çıkış</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== REKLAM ==================== */}
      {activeTab === "ads" && (
        <>
          {metaAds && !metaAds.error ? (
            <>
              {/* Meta Ads - Canlı Veri */}
              <div className="card p-5 border-l-4 border-l-pink-500">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-5 w-5 text-pink-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Meta Reklamları</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Canlı Veri
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">{metaAds.dateStart} → {metaAds.dateEnd}</span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <p className="text-[10px] text-gray-400">Harcama</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{Math.round(metaAds.spend).toLocaleString("tr-TR")} TL</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <p className="text-[10px] text-gray-400">Gösterim</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{metaAds.impressions.toLocaleString("tr-TR")}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <p className="text-[10px] text-gray-400">Tıklama</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{metaAds.clicks.toLocaleString("tr-TR")}</p>
                    <p className="text-[10px] text-gray-400">CTR: %{metaAds.ctr.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                    <p className="text-[10px] text-gray-400">Satın Alma</p>
                    <p className="text-lg font-bold text-emerald-600">{metaAds.purchases}</p>
                    <p className="text-[10px] text-gray-400">CPC: {metaAds.cpc.toFixed(2)} TL</p>
                  </div>
                </div>

                {/* Dönüşüm Hunisi */}
                <div className="mb-4">
                  <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Dönüşüm Hunisi</h4>
                  <div className="space-y-1.5">
                    {[
                      { label: "Gösterim", value: metaAds.impressions, color: "bg-gray-400" },
                      { label: "Link Tıklama", value: metaAds.linkClicks, color: "bg-blue-400" },
                      { label: "İçerik Görüntüleme", value: metaAds.viewContent, color: "bg-indigo-400" },
                      { label: "Sepete Ekleme", value: metaAds.addToCart, color: "bg-violet-400" },
                      { label: "Ödeme Başlatma", value: metaAds.initiateCheckout, color: "bg-purple-400" },
                      { label: "Satın Alma", value: metaAds.purchases, color: "bg-emerald-500" },
                    ].map((step, i) => {
                      const maxVal = metaAds.impressions || 1;
                      const pct = Math.max(1, (step.value / maxVal) * 100);
                      const prevVal = i > 0 ? [metaAds.impressions, metaAds.linkClicks, metaAds.viewContent, metaAds.addToCart, metaAds.initiateCheckout, metaAds.purchases][i - 1] : 0;
                      const dropoff = i > 0 && prevVal > 0 ? Math.round(((prevVal - step.value) / prevVal) * 100) : 0;
                      return (
                        <div key={step.label} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 w-28 text-right">{step.label}</span>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${step.color} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 dark:text-slate-300 w-16 text-right">{step.value.toLocaleString("tr-TR")}</span>
                          {dropoff > 0 && <span className="text-[9px] text-red-400 w-10">-{dropoff}%</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ek Metrikler */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-lg bg-pink-50 dark:bg-pink-950/20 text-center">
                    <p className="text-sm font-bold text-pink-600">{metaAds.videoViews.toLocaleString("tr-TR")}</p>
                    <p className="text-[9px] text-gray-500">Video İzleme</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
                    <p className="text-sm font-bold text-blue-600">{metaAds.postEngagement.toLocaleString("tr-TR")}</p>
                    <p className="text-[9px] text-gray-500">Etkileşim</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/20 text-center">
                    <p className="text-sm font-bold text-violet-600">{metaAds.messaging}</p>
                    <p className="text-[9px] text-gray-500">Mesaj Başlatma</p>
                  </div>
                </div>
              </div>

              {/* Performans Özeti - Gerçek ROAS */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Performans Özeti</h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 text-center">
                    <p className="text-[10px] text-gray-500">ROAS</p>
                    <p className="text-2xl font-bold text-emerald-600">{metaAds.roas ? metaAds.roas.toFixed(2) : "-"}x</p>
                    <p className="text-[9px] text-gray-400">Meta pixel verisi</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 text-center">
                    <p className="text-[10px] text-gray-500">Dönüşüm Cirosu</p>
                    <p className="text-xl font-bold text-blue-600">{metaAds.purchaseValue ? Math.round(metaAds.purchaseValue).toLocaleString("tr-TR") : "-"} TL</p>
                    <p className="text-[9px] text-gray-400">Reklam kaynaklı satış</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
                    <p className="text-[10px] text-gray-500">Müşteri Edinme</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{metaAds.costPerPurchase ? Math.round(metaAds.costPerPurchase).toLocaleString("tr-TR") : metaAds.purchases > 0 ? Math.round(metaAds.spend / metaAds.purchases).toLocaleString("tr-TR") : "-"} TL</p>
                    <p className="text-[9px] text-gray-400">Satış başına maliyet</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
                    <p className="text-[10px] text-gray-500">Sepet Dönüşüm</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{metaAds.addToCart > 0 ? ((metaAds.purchases / metaAds.addToCart) * 100).toFixed(1) : "-"}%</p>
                    <p className="text-[9px] text-gray-400">Sepet → Satın Alma</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 text-center">
                    <p className="text-[10px] text-gray-500">Tıklama → Sepet</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{metaAds.linkClicks > 0 ? ((metaAds.addToCart / metaAds.linkClicks) * 100).toFixed(1) : "-"}%</p>
                    <p className="text-[9px] text-gray-400">Link → Sepete ekleme</p>
                  </div>
                </div>
              </div>

              {/* Harcama vs Ciro Karşılaştırma */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Harcama vs Dönüşüm</h3>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-red-600 font-medium">Reklam Harcaması</span>
                      <span className="font-bold text-gray-900 dark:text-white">{Math.round(metaAds.spend).toLocaleString("tr-TR")} TL</span>
                    </div>
                    <div className="w-full h-4 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${metaAds.purchaseValue > 0 ? Math.min(100, (metaAds.spend / metaAds.purchaseValue) * 100) : 50}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-emerald-600 font-medium">Dönüşüm Cirosu</span>
                      <span className="font-bold text-gray-900 dark:text-white">{metaAds.purchaseValue ? Math.round(metaAds.purchaseValue).toLocaleString("tr-TR") : "-"} TL</span>
                    </div>
                    <div className="w-full h-4 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center">
                  Her 1 TL reklam harcamasına karşılık {metaAds.roas ? metaAds.roas.toFixed(2) : "-"} TL gelir elde ediliyor.
                  Net kâr: {metaAds.purchaseValue ? Math.round(metaAds.purchaseValue - metaAds.spend).toLocaleString("tr-TR") : "-"} TL
                </p>
              </div>
            </>
          ) : (
            <div className="card p-8 text-center">
              <Instagram className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Meta Ads verisi yüklenemedi.</p>
              <p className="text-xs text-gray-400 mt-1">Ayarlar → Entegrasyonlar kısmından hesabınızı bağlayın.</p>
            </div>
          )}

          {/* Google Ads - Henüz bağlı değil */}
          <div className="card p-5 border border-dashed border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Google Ads</h3>
              <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Bağlantı Bekleniyor</span>
            </div>
            <p className="text-xs text-gray-500">Google Ads hesabınızı bağlayarak Search ve Shopping reklam verilerinizi burada görüntüleyebilirsiniz.</p>
          </div>
        </>
      )}

      {/* ==================== SİPARİŞLER ==================== */}
      {activeTab === "orders" && (
        <div className="space-y-2">
          {(filteredOrders.length > 0 ? filteredOrders : orders).map(o => {
            const fulfillment = o.fulfillment_status || "unfulfilled";
            const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : o.email?.split("@")[0] || "-";
            const isExpanded = expandedOrder === o.id;
            return (
              <div key={o.id} className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedOrder(isExpanded ? null : o.id)}>
                  <div className={`w-2 h-10 rounded-full flex-shrink-0 ${fulfillment === "fulfilled" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{o.name}</span>
                      <span className="text-xs text-gray-500 truncate">{customerName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${orderStatusColors[fulfillment]?.color || "bg-gray-100 text-gray-500"}`}>{orderStatusColors[fulfillment]?.label}</span>
                      <span className={`text-[10px] font-medium ${paymentStatusColors[o.financial_status]?.color || "text-gray-500"}`}>{paymentStatusColors[o.financial_status]?.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{o.line_items?.length} ürün · {new Date(o.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex-shrink-0">{parseFloat(o.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-800 pt-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Ürünler</h4>
                        <div className="space-y-2">
                          {o.line_items?.map((li: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{li.title}</p>
                                {li.variant_title && <p className="text-[10px] text-gray-400">{li.variant_title}</p>}
                              </div>
                              <span className="text-[10px] text-gray-500">{li.quantity} adet</span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">{parseFloat(li.price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Sipariş Detayı</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                            <span className="text-gray-500">Ara Toplam</span>
                            <span className="font-medium text-gray-900 dark:text-white">{parseFloat(o.subtotal_price || o.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                          </div>
                          {o.total_discounts && parseFloat(o.total_discounts) > 0 && (
                            <div className="flex justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                              <span className="text-emerald-600">İndirim</span>
                              <span className="font-medium text-emerald-600">-{parseFloat(o.total_discounts).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                            </div>
                          )}
                          <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                            <span className="text-gray-500">Kargo</span>
                            <span className="font-medium text-gray-900 dark:text-white">{o.total_shipping_price_set?.shop_money?.amount ? parseFloat(o.total_shipping_price_set.shop_money.amount).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " TL" : "Ücretsiz"}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 font-semibold">
                            <span className="text-gray-700 dark:text-slate-300">Toplam</span>
                            <span className="text-gray-900 dark:text-white">{parseFloat(o.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                          </div>
                          {o.customer?.email && (
                            <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <span className="text-gray-500">E-posta</span>
                              <span className="text-gray-700 dark:text-slate-300">{o.customer.email || o.email}</span>
                            </div>
                          )}
                          {o.shipping_address && (
                            <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <span className="text-gray-500 block mb-1">Teslimat Adresi</span>
                              <span className="text-gray-700 dark:text-slate-300">{o.shipping_address.city}, {o.shipping_address.province} {o.shipping_address.country}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== İADELER ==================== */}
      {activeTab === "returns" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-[10px] text-gray-500">Toplam İade</span></div>
              <p className="text-xl font-bold text-red-600">{orders.filter(o => o.financial_status === "refunded" || o.financial_status === "partially_refunded").length}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-red-500" /><span className="text-[10px] text-gray-500">İade Tutarı</span></div>
              <p className="text-xl font-bold text-red-600">{orders.filter(o => o.financial_status === "refunded" || o.financial_status === "partially_refunded").reduce((s, o) => s + parseFloat(o.total_price), 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-amber-500" /><span className="text-[10px] text-gray-500">İade Oranı</span></div>
              <p className="text-xl font-bold text-amber-600">%{orders.length > 0 ? ((orders.filter(o => o.financial_status === "refunded" || o.financial_status === "partially_refunded").length / orders.length) * 100).toFixed(1) : 0}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-violet-500" /><span className="text-[10px] text-gray-500">Kısmi İade</span></div>
              <p className="text-xl font-bold text-violet-600">{orders.filter(o => o.financial_status === "partially_refunded").length}</p>
            </div>
          </div>

          <div className="space-y-2">
            {orders.filter(o => o.financial_status === "refunded" || o.financial_status === "partially_refunded").map(o => {
              const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : o.email?.split("@")[0] || "-";
              return (
                <div key={o.id} className="card p-4 border-l-4 border-l-red-400">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{o.name}</span>
                      <span className="text-xs text-gray-500">{customerName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${o.financial_status === "refunded" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"}`}>
                        {o.financial_status === "refunded" ? "Tam İade" : "Kısmi İade"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-red-600">{parseFloat(o.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                  </div>
                  <p className="text-[10px] text-gray-400">{o.line_items?.map((l: any) => l.title).join(", ")}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(o.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              );
            })}
            {orders.filter(o => o.financial_status === "refunded" || o.financial_status === "partially_refunded").length === 0 && (
              <div className="card p-8 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Bu dönemde iade bulunmuyor.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
