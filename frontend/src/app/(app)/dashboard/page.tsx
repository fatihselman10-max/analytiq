"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { conversationsAPI, reportsAPI } from "@/lib/api";
import {
  Inbox, MessageSquare, Clock, CheckCircle, TrendingUp,
  Bot, ArrowRight, AlertTriangle, ShoppingCart, DollarSign,
  Package, Truck, AlertCircle as AlertIcon, Users, Sparkles,
  BarChart3, ArrowUpRight, ArrowDownRight, Loader2, Send, MessageCircle, X,
} from "lucide-react";

export default function DashboardPage() {
  const { user, organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [shopData, setShopData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [msgStats, setMsgStats] = useState({ open: 0, pending: 0, resolved: 0, avgResponse: 0 });
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [period, setPeriod] = useState<string>("today");
  const [metaAds, setMetaAds] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!organization) return;
    loadAll();
    // Auto-refresh every 60 seconds (silent - no loading spinner)
    const interval = setInterval(() => {
      loadAll(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [organization, period]);

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Same data source as Mağaza Analizi - fetch all orders, filter client-side
      const periodToMeta: Record<string, string> = {
        today: "today", yesterday: "yesterday", "7d": "last_7d", "30d": "last_30d",
        "90d": "last_90d", "180d": "last_180d", "365d": "last_year",
      };

      const [statsRes, ordersRes, productsRes, convRes, metaRes] = await Promise.all([
        fetch("/api/shopify?action=stats").then(r => r.json()).catch(() => null),
        fetch("/api/shopify?action=orders&limit=250").then(r => r.json()).catch(() => ({ orders: [] })),
        fetch("/api/shopify?action=products&limit=50").then(r => r.json()).catch(() => ({ products: [] })),
        reportsAPI.overview("7d").catch(() => ({ data: null })),
        fetch(`/api/shopify?action=meta-ads&date_preset=${periodToMeta[period] || "last_7d"}`).then(r => r.json()).catch(() => null),
      ]);

      setShopData(statsRes);
      setOrders(ordersRes.orders || []);
      setProducts(productsRes.products || []);
      setMetaAds(metaRes?.error ? null : metaRes);

      const ov = convRes.data;
      setMsgStats({
        open: ov?.open_conversations || 0,
        pending: 0,
        resolved: ov?.resolved_count || 0,
        avgResponse: ov?.avg_response_time_minutes || 0,
      });
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
    setLoading(false);

    // AI Insight - daily cache
    const todayKey = `ai-briefing-v2-${new Date().toISOString().slice(0, 10)}`;
    const cached = typeof window !== "undefined" ? localStorage.getItem(todayKey) : null;
    if (cached) {
      setAiInsight(cached);
    } else {
      generateInsight(todayKey);
    }
  };

  const generateInsight = async (cacheKey: string) => {
    setAiLoading(true);
    try {
      const [ordersRes, productsRes, msgRes] = await Promise.all([
        fetch("/api/shopify?action=orders&limit=30").then(r => r.json()),
        fetch("/api/shopify?action=products&limit=30").then(r => r.json()),
        reportsAPI.overview("7d").then(r => r.data).catch(() => null),
      ]);

      const recentOrders = ordersRes.orders || [];
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterdayOrders = recentOrders.filter((o: any) => o.created_at?.slice(0, 10) === yesterday);
      const yesterdayCount = yesterdayOrders.length;
      const yesterdayRev = yesterdayOrders.reduce((s: number, o: any) => s + parseFloat(o.total_price || "0"), 0);
      const todayCount = recentOrders.filter((o: any) => o.created_at?.slice(0, 10) === todayStr).length;
      const todayRev = recentOrders.filter((o: any) => o.created_at?.slice(0, 10) === todayStr).reduce((s: number, o: any) => s + parseFloat(o.total_price || "0"), 0);

      // En çok satılan ürünler
      const productSales: Record<string, number> = {};
      recentOrders.forEach((o: any) => o.line_items?.forEach((li: any) => {
        productSales[li.title] = (productSales[li.title] || 0) + li.quantity;
      }));
      const topSelling = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => `${name} (${qty} adet)`).join(", ");

      // Stok durumu
      const allProducts = productsRes.products || [];
      const outOfStock = allProducts.filter((p: any) => p.variants?.every((v: any) => v.inventory_quantity <= 0)).map((p: any) => p.title).slice(0, 5);
      const lowStock = allProducts.filter((p: any) => p.variants?.some((v: any) => v.inventory_quantity > 0 && v.inventory_quantity < 10)).map((p: any) => `${p.title} (${p.variants[0]?.inventory_quantity})`).slice(0, 5);

      // Sipariş detayları - müşteri davranışı
      const avgOrderValue = recentOrders.length > 0 ? recentOrders.reduce((s: number, o: any) => s + parseFloat(o.total_price || "0"), 0) / recentOrders.length : 0;
      const unfulfilledOrders = recentOrders.filter((o: any) => !o.fulfillment_status || o.fulfillment_status === "unfulfilled").length;
      const refunded = recentOrders.filter((o: any) => o.financial_status === "refunded" || o.financial_status === "partially_refunded").length;

      // Müşteri mesaj istatistikleri
      const openConvs = msgRes?.open_conversations || 0;
      const resolvedConvs = msgRes?.resolved_count || 0;
      const avgResponseMin = msgRes?.avg_response_time_minutes || 0;

      const prompt = `Sen LessandRomance kadın giyim markasının işletme danışmanısın. Her sabah patrona dünün performans özetini veriyorsun. Dünkü verileri değerlendirip bugün için aksiyon önerileri sunuyorsun.

DÜNKÜ PERFORMANS (${yesterday}):
- Dün ${yesterdayCount} sipariş geldi, ${yesterdayRev.toLocaleString("tr-TR")} TL ciro yapıldı.
- Bugün şu ana kadar ${todayCount} sipariş, ${todayRev.toLocaleString("tr-TR")} TL ciro var.
- Son 30 siparişte ortalama sepet: ${avgOrderValue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL.
- ${unfulfilledOrders} sipariş henüz kargoya verilmedi.
- ${refunded} iade/iptal var.
- En çok satılanlar: ${topSelling || "veri yok"}.

STOK DURUMU:
- Tükenen (${outOfStock.length}): ${outOfStock.join(", ") || "yok"}.
- Azalan: ${lowStock.join(", ") || "yok"}.

MÜŞTERİ İLETİŞİMİ:
- ${openConvs} açık mesaj cevaplanmayı bekliyor.
- Son 7 günde ${resolvedConvs} mesaj çözüldü.
- Ortalama yanıt süresi: ${avgResponseMin} dakika.

KURALLAR:
- Tam 4 madde yaz. Her madde yeni satırda başlasın.
- Her madde tam ve bitmiş bir cümle olsun, kesinlikle yarım bırakma.
- 1. madde: Dünün satış performansını değerlendir - dünkü ciro ve sipariş sayısını yorumla, müşterilerin ne aldığına bak.
- 2. madde: Müşteri iletişim durumu - bekleyen mesajlar, yanıt süresi, bugün öncelikli yapılması gereken.
- 3. madde: Stok veya ürün bazlı somut bir uyarı. Tükenen popüler ürün varsa dikkat çek.
- 4. madde: Bugün yapılması gereken en önemli aksiyon ne? Somut ve uygulanabilir bir öneri ver.
- Patron bir kadın giyim markası sahibi, ona direkt hitap et. Samimi ama profesyonel ol.
- Emoji kullanma, madde işareti kullanma, düz cümleler yaz.
- Türkçe yaz, para birimi TL olsun.`;

      const res = await fetch("/api/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (res.ok) {
        const data = await res.json();
        const insight = data.insight || "";
        setAiInsight(insight);
        if (insight && typeof window !== "undefined") {
          localStorage.setItem(cacheKey, insight);
        }
      }
    } catch {}
    setAiLoading(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  // Same filtering logic as Mağaza Analizi page
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
  const periodRevenue = filteredOrders.reduce((s, o) => s + parseFloat(o.total_price || "0"), 0);
  const totalRevenue = periodRevenue;
  const unfulfilledCount = orders.filter(o => !o.fulfillment_status || o.fulfillment_status === "unfulfilled").length;
  const outOfStockCount = products.filter(p => p.variants?.every((v: any) => (v.inventory_quantity || 0) <= 0)).length;
  const lowStockCount = products.filter(p => p.variants?.some((v: any) => v.inventory_quantity > 0 && v.inventory_quantity < 10)).length;
  const periodLabel = { today: "Bugün", yesterday: "Dün", "7d": "Son 7 Gün", "30d": "Son 30 Gün", "90d": "Son 3 Ay", "180d": "Son 6 Ay", "365d": "Son 1 Yıl" }[period] || "Bugün";

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            {greeting}, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {shopData?.shop?.name || organization?.name} - İşletme özeti
          </p>
        </div>
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-1">
          {[
            { key: "today", label: "Bugün" },
            { key: "yesterday", label: "Dün" },
            { key: "7d", label: "7G" },
            { key: "30d", label: "30G" },
            { key: "90d", label: "3A" },
            { key: "180d", label: "6A" },
            { key: "365d", label: "1Y" },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-2 lg:px-3 py-1 text-[10px] lg:text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${period === p.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Günlük Brifing - Kompakt */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 dark:from-slate-950 dark:via-violet-950/80 dark:to-indigo-950/80 rounded-2xl p-4 shadow-lg">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <span className="text-xs font-semibold text-white/80">Günlük Brifing</span>
            </div>
            <span className="text-[9px] text-white/30 hidden sm:inline">Dünün performans özeti · Detay için AI Asistan kullanın</span>
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-white/40">Analiz ediliyor...</span>
            </div>
          ) : aiInsight ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
              {aiInsight.split("\n").filter(Boolean).map((line, i) => (
                <p key={i} className="text-[11px] text-white/70 leading-relaxed flex items-start gap-1.5">
                  <span className="text-violet-400 font-bold mt-px">{i + 1}.</span>
                  {line.replace(/^\d+[\.\)]\s*/, "")}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-white/50">Bugün {filteredOrders.length} sipariş ({periodRevenue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL). {unfulfilledCount > 0 ? `${unfulfilledCount} bekleyen kargo.` : ""} {outOfStockCount > 0 ? `${outOfStockCount} tükenen ürün.` : ""}</p>
          )}
        </div>
      </div>

      {/* AI İşletme Asistanı */}
      <div className="relative">
        {!chatOpen ? (
          <button onClick={() => setChatOpen(true)}
            className="w-full relative overflow-hidden rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg transition-all group bg-gradient-to-r from-white to-violet-50 dark:from-slate-900 dark:to-violet-950/20 border border-violet-200 dark:border-violet-800">
            <div className="absolute right-0 top-0 w-32 h-32 bg-violet-100 dark:bg-violet-900/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-50" />
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20 flex-shrink-0">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 text-left relative">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI İşletme Asistanı</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Shopify, Meta Ads ve müşteri verilerinizi analiz ederek sorularınızı yanıtlar</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-medium shadow-md group-hover:shadow-lg transition-all relative">
              Soru Sor
            </div>
          </button>
        ) : (
          <div className="rounded-2xl overflow-hidden border-2 border-violet-200 dark:border-violet-800 shadow-xl shadow-violet-500/5">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-white/20">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">AI İşletme Asistanı</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[9px] text-white/60">Shopify · Meta Ads · CRM · Canlı</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X className="h-4 w-4" /></button>
            </div>

            {/* Chat Messages */}
            <div className="max-h-64 overflow-y-auto p-3 space-y-3 bg-gray-50/50 dark:bg-slate-900/50">
              {chatMessages.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400">Mağazanız hakkında her şeyi sorabilirsiniz.</p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {["En çok satan ürün ne?", "İade oranım nasıl?", "ROAS'ım iyi mi?", "Bu hafta satış nasıl?"].map(q => (
                      <button key={q} onClick={() => { setChatInput(q); }}
                        className="text-[10px] px-2.5 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-gray-500 hover:text-violet-600 hover:border-violet-300 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-md"
                      : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-100 dark:border-slate-700 rounded-tl-md"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl rounded-tl-md bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-slate-800">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Sorunuzu yazın..."
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                onKeyDown={e => {
                  if (e.key === "Enter" && chatInput.trim() && !chatLoading) {
                    const question = chatInput.trim();
                    setChatInput("");
                    setChatMessages(prev => [...prev, { role: "user", content: question }]);
                    setChatLoading(true);

                    fetch("/api/shopify", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat: question }),
                    }).then(r => r.json()).then(data => {
                      setChatMessages(prev => [...prev, { role: "assistant", content: data.insight || "Yanıt alınamadı." }]);
                    }).catch(() => {
                      setChatMessages(prev => [...prev, { role: "assistant", content: "Bağlantı hatası. Tekrar deneyin." }]);
                    }).finally(() => setChatLoading(false));
                  }
                }}
              />
              <button onClick={() => {
                if (!chatInput.trim() || chatLoading) return;
                const question = chatInput.trim();
                setChatInput("");
                setChatMessages(prev => [...prev, { role: "user", content: question }]);
                setChatLoading(true);
                fetch("/api/shopify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat: question }) })
                  .then(r => r.json()).then(d => setChatMessages(p => [...p, { role: "assistant", content: d.insight || "Yanıt alınamadı." }]))
                  .catch(() => setChatMessages(p => [...p, { role: "assistant", content: "Hata." }]))
                  .finally(() => setChatLoading(false));
              }} disabled={chatLoading || !chatInput.trim()}
                className="p-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Kâr Özeti - Mini P&L */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: "Ciro", value: `${periodRevenue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`, sub: periodLabel, color: "text-gray-900 dark:text-white" },
          { label: "COGS", value: `${Math.round(periodRevenue * 0.4).toLocaleString("tr-TR")} TL`, sub: "%40 ürün maliyeti", color: "text-red-600" },
          { label: "Brüt Kâr", value: `${Math.round(periodRevenue * 0.6).toLocaleString("tr-TR")} TL`, sub: "%60 marj", color: "text-emerald-600" },
          { label: "Sipariş", value: `${filteredOrders.length}`, sub: `Ort: ${filteredOrders.length > 0 ? Math.round(periodRevenue / filteredOrders.length).toLocaleString("tr-TR") : 0} TL`, color: "text-blue-600" },
          { label: "Reklam", value: metaAds?.spend ? `${Math.round(metaAds.spend).toLocaleString("tr-TR")} TL` : "-", sub: metaAds?.roas ? `ROAS ${metaAds.roas.toFixed(1)}x` : "Meta bağla", color: "text-amber-600" },
          { label: "Net Kâr", value: (() => { const brutKar = periodRevenue * 0.6; const reklam = metaAds?.spend || 0; const operasyonel = periodRevenue * 0.08; const net = brutKar - reklam - operasyonel; return `${Math.round(net).toLocaleString("tr-TR")} TL`; })(), sub: "brüt kâr - reklam - ops(%8)", color: (() => { const net = periodRevenue * 0.6 - (metaAds?.spend || 0) - periodRevenue * 0.08; return net > 0 ? "text-emerald-600" : "text-red-600"; })() },
        ].map((kpi, i) => (
          <Link key={i} href="/settings" className="card p-3 hover:shadow-sm transition-shadow text-center">
            <p className="text-[10px] text-gray-400">{kpi.label}</p>
            <p className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[9px] text-gray-400">{kpi.sub}</p>
          </Link>
        ))}
      </div>

      {/* Satış KPI'ları - Ana Satır */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Link href="/sales" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
            <span className="text-xs text-gray-500">{periodLabel} Satış</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{periodRevenue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
          <p className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-1"><ArrowUpRight className="h-3 w-3" />{filteredOrders.length} sipariş</p>
        </Link>

        <Link href="/sales" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950"><ShoppingCart className="h-4 w-4 text-blue-600" /></div>
            <span className="text-xs text-gray-500">Toplam Sipariş</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{shopData?.ordersCount?.toLocaleString() || orders.length}</p>
          <p className="text-[10px] text-gray-400 mt-1">Ort: {orders.length > 0 ? (totalRevenue / orders.length).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : 0} TL</p>
        </Link>

        <Link href="/sales" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950"><Truck className="h-4 w-4 text-amber-600" /></div>
            <span className="text-xs text-gray-500">Bekleyen Kargo</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{unfulfilledCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">Hazırlanması gereken</p>
        </Link>

        <Link href="/products" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950"><AlertIcon className="h-4 w-4 text-red-600" /></div>
            <span className="text-xs text-gray-500">Stok Uyarısı</span>
          </div>
          <p className="text-xl font-bold text-red-600">{outOfStockCount + lowStockCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">{outOfStockCount} tükenen, {lowStockCount} azalan</p>
        </Link>

        <Link href="/inbox" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950"><MessageSquare className="h-4 w-4 text-violet-600" /></div>
            <span className="text-xs text-gray-500">Açık Mesaj</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{msgStats.open}</p>
          <p className="text-[10px] text-gray-400 mt-1">{msgStats.resolved} çözülen (7g)</p>
        </Link>
      </div>

      {/* Ana Grid: Son Siparişler + Stok Uyarıları */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Son Siparişler */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              Son Siparişler
            </h2>
            <Link href="/sales" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Tümünü Gör <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {(filteredOrders.length > 0 ? filteredOrders : orders).slice(0, 8).map((o: any) => {
              const customer = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : o.email?.split("@")[0] || "-";
              const fulfillment = o.fulfillment_status || "unfulfilled";
              return (
                <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <div className={`w-2 h-8 rounded-full flex-shrink-0 ${fulfillment === "fulfilled" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-gray-900 dark:text-white">{o.name}</span>
                      <span className="text-xs text-gray-500 truncate">{customer}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{o.line_items?.map((l: any) => l.title).join(", ")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{parseFloat(o.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
                    <p className={`text-[10px] font-medium ${o.financial_status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                      {o.financial_status === "paid" ? "Ödendi" : "Bekliyor"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sağ Panel: Müşteri İletişim + Stok */}
        <div className="space-y-4">
          {/* Müşteri İletişim Özeti */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Müşteri İletişimi
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-center">
                <p className="text-lg font-bold text-orange-600">{msgStats.open}</p>
                <p className="text-[10px] text-gray-500">Açık Mesaj</p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-center">
                <p className="text-lg font-bold text-emerald-600">{msgStats.resolved}</p>
                <p className="text-[10px] text-gray-500">Çözülen (7g)</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">Ort. Yanıt Süresi</span>
                <span className={`text-xs font-bold ${msgStats.avgResponse > 60 ? "text-red-600" : "text-emerald-600"}`}>
                  {msgStats.avgResponse > 60 ? `${Math.round(msgStats.avgResponse / 60)} saat` : `${msgStats.avgResponse} dk`}
                </span>
              </div>
            </div>
            <Link href="/inbox" className="flex items-center justify-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">
              Gelen Kutusuna Git <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Tükenen Ürünler */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <AlertIcon className="h-4 w-4 text-red-500" />
              Stok Uyarıları
            </h2>
            <div className="space-y-2">
              {products.filter(p => p.variants?.every((v: any) => (v.inventory_quantity || 0) <= 0)).slice(0, 4).map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                  {p.images?.[0]?.src ? (
                    <img src={p.images[0].src} alt="" className="w-8 h-8 rounded-md object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-red-100 dark:bg-red-900 flex items-center justify-center"><Package className="h-3 w-3 text-red-400" /></div>
                  )}
                  <p className="text-[11px] text-gray-700 dark:text-slate-300 truncate flex-1">{p.title}</p>
                  <span className="text-[10px] font-bold text-red-600">Tükendi</span>
                </div>
              ))}
              {products.filter(p => p.variants?.some((v: any) => v.inventory_quantity > 0 && v.inventory_quantity < 10)).slice(0, 3).map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  {p.images?.[0]?.src ? (
                    <img src={p.images[0].src} alt="" className="w-8 h-8 rounded-md object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900 flex items-center justify-center"><Package className="h-3 w-3 text-amber-400" /></div>
                  )}
                  <p className="text-[11px] text-gray-700 dark:text-slate-300 truncate flex-1">{p.title}</p>
                  <span className="text-[10px] font-bold text-amber-600">{p.variants?.[0]?.inventory_quantity} adet</span>
                </div>
              ))}
              {outOfStockCount === 0 && lowStockCount === 0 && <p className="text-xs text-gray-400 text-center py-2">Tüm ürünler stokta</p>}
            </div>
          </div>

          {/* Hızlı Erişim */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Hızlı Erişim</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/inbox", label: "Gelen Kutusu", icon: Inbox, color: "bg-orange-50 dark:bg-orange-950 text-orange-600" },
                { href: "/bot", label: "AI Bot", icon: Bot, color: "bg-violet-50 dark:bg-violet-950 text-violet-600" },
                { href: "/sales", label: "Mağaza Analizi", icon: BarChart3, color: "bg-rose-50 dark:bg-rose-950 text-rose-600" },
                { href: "/tasks", label: "Görevler", icon: CheckCircle, color: "bg-cyan-50 dark:bg-cyan-950 text-cyan-600" },
              ].map(item => (
                <Link key={item.href} href={item.href} className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <div className={`p-1.5 rounded-lg ${item.color}`}><item.icon className="h-3.5 w-3.5" /></div>
                  <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
