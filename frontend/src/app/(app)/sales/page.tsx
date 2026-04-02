"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import {
  ShoppingCart, Package,
  ArrowUpRight, BarChart3, CreditCard,
  Target, Truck, Loader2,
  CheckCircle, Clock, AlertCircle, Users,
  Search, MessageSquare, Inbox,
} from "lucide-react";
import { reportsAPI } from "@/lib/api";

type ShopifyOrder = {
  id: number; name: string; email: string; created_at: string;
  total_price: string; subtotal_price?: string; total_discounts?: string;
  financial_status: string; fulfillment_status: string | null;
  line_items: { title: string; quantity: number; price: string; variant_title?: string }[];
  phone?: string;
  customer?: { first_name: string; last_name: string; email?: string; phone?: string };
  shipping_address?: { address1?: string; city: string; province: string; country: string; phone?: string };
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

type TabKey = "crm" | "orders" | "returns";

export default function SalesPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("crm");
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [crmData, setCrmData] = useState<any>(null);
  const [crmMessages, setCrmMessages] = useState<any>(null);
  const [crmAgents, setCrmAgents] = useState<any[]>([]);
  const [crmChannels, setCrmChannels] = useState<any[]>([]);
  const [period, setPeriod] = useState<string>("30d");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [refundOrders, setRefundOrders] = useState<any[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [returnSearch, setReturnSearch] = useState("");

  const periodToDays: Record<string, number> = {
    today: 1, yesterday: 1, "7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365,
  };

  const periodToCrm: Record<string, string> = {
    today: "today", yesterday: "7d", "7d": "7d", "30d": "30d", "90d": "90d", "180d": "all", "365d": "all",
  };

  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    const days = periodToDays[period] || 30;
    const crmPeriod = periodToCrm[period] || "30d";
    const dateMin = new Date(Date.now() - days * 86400000).toISOString();

    if (isRefresh) setRefreshing(true);

    // Fase 1: Siparis + stats + analytics paralel
    try {
      const [statsRes, ordersRes] = await Promise.all([
        fetch("/api/shopify?action=stats").then(r => r.json()).catch(() => null),
        fetch(`/api/shopify?action=orders&limit=250&created_at_min=${encodeURIComponent(dateMin)}`).then(r => r.json()).catch(() => ({ orders: [] })),
      ]);
      setStats(statsRes);
      setOrders(ordersRes.orders || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);

    // Fase 2: CRM + reklam + iadeler arka planda
    try {
      const [crmRes, refundsRes, messagesRes, agentsRes, channelsRes] = await Promise.all([
        reportsAPI.overview(crmPeriod).catch(() => ({ data: null })),
        fetch("/api/shopify?action=refunds").then(r => r.json()).catch(() => ({ orders: [] })),
        reportsAPI.messages(crmPeriod).catch(() => ({ data: null })),
        reportsAPI.agents(crmPeriod).catch(() => ({ data: null })),
        reportsAPI.channels(crmPeriod).catch(() => ({ data: null })),
      ]);
      setCrmData(crmRes.data);
      setRefundOrders(refundsRes.orders || []);
      setCrmMessages(messagesRes.data);
      setCrmAgents(agentsRes.data?.agents || []);
      setCrmChannels(channelsRes.data?.channels || []);
    } catch {}
  };

  useEffect(() => {
    if (!organization) return;
    if (loading) { fetchData(); } else { fetchData(true); }
  }, [organization, period]);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  // Period baslangic tarihi (iadeler ve diger filtreler icin)
  const periodStart = new Date(Date.now() - (periodToDays[period] || 30) * 86400000);
  // Orders zaten period'a gore cekildi, dogrudan kullan
  const filteredOrders = orders;
  const periodLabels: Record<string, string> = { today: "Bugün", yesterday: "Dün", "7d": "7 Gün", "30d": "30 Gün", "90d": "3 Ay", "180d": "6 Ay", "365d": "1 Yıl" };

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Müşteri Analizi</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Müşteri iletişim analizi ve sipariş takibi
            {refreshing && <Loader2 className="h-3 w-3 animate-spin text-blue-500 ml-2" />}
          </p>
        </div>
        <div className="flex flex-col gap-2">
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
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-1">
          {([
            { key: "crm" as TabKey, label: "Genel" },
            { key: "orders" as TabKey, label: "Siparişler" },
            { key: "returns" as TabKey, label: "İadeler" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* ==================== CRM RAPORU ==================== */}
      {activeTab === "crm" && (() => {
        const totalConvs = crmData?.total_conversations || 0;
        const openConvs = crmData?.open_conversations || 0;
        const resolvedConvs = crmData?.resolved_count || 0;
        const avgResponse = crmData?.avg_response_time_minutes ? Math.round(crmData.avg_response_time_minutes) : 0;
        const avgResolution = crmData?.avg_resolution_time_minutes ? Math.round(crmData.avg_resolution_time_minutes) : 0;
        const totalMsgs = crmMessages?.total_messages || 0;
        const customerMsgs = crmMessages?.customer_messages || 0;
        const agentMsgs = crmMessages?.agent_messages || 0;
        const botMsgs = crmMessages?.bot_messages || 0;
        const keywords: { word: string; count: number }[] = crmMessages?.keywords || [];
        const hourlyVolume: { hour: number; count: number }[] = crmMessages?.hourly_volume || [];
        const dailyMsgs: { date: string; count: number }[] = crmMessages?.daily_messages || [];
        const channelColors: Record<string, { icon: string; color: string; label: string }> = {
          instagram: { icon: "IG", color: "bg-pink-500", label: "Instagram" },
          whatsapp: { icon: "WA", color: "bg-green-500", label: "WhatsApp" },
          email: { icon: "EM", color: "bg-gray-500", label: "E-posta" },
          telegram: { icon: "TG", color: "bg-blue-500", label: "Telegram" },
          facebook: { icon: "FB", color: "bg-blue-600", label: "Facebook" },
          twitter: { icon: "TW", color: "bg-sky-500", label: "Twitter" },
          livechat: { icon: "LC", color: "bg-violet-500", label: "Canlı Sohbet" },
          vk: { icon: "VK", color: "bg-blue-700", label: "VK" },
        };
        const totalChannelConvs = crmChannels.reduce((s, c) => s + (c.count || 0), 0);
        const customerPct = totalMsgs > 0 ? Math.round((customerMsgs / totalMsgs) * 100) : 0;
        const agentPct = totalMsgs > 0 ? Math.round((agentMsgs / totalMsgs) * 100) : 0;
        const maxHourly = Math.max(...hourlyVolume.map(h => h.count), 1);
        const peakHour = hourlyVolume.length > 0 ? hourlyVolume.reduce((a, b) => b.count > a.count ? b : a) : null;
        const quietHour = hourlyVolume.length > 0 ? hourlyVolume.reduce((a, b) => b.count < a.count ? b : a) : null;
        const maxKeyword = keywords.length > 0 ? keywords[0].count : 1;

        return (
        <>
          {/* KPI Kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Inbox className="h-4 w-4 text-orange-500" /><span className="text-[10px] text-gray-500">Toplam Görüşme</span></div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalConvs}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><MessageSquare className="h-4 w-4 text-blue-500" /><span className="text-[10px] text-gray-500">Açık</span></div>
              <p className="text-xl font-bold text-orange-600">{openConvs}</p>
              <p className="text-[10px] text-gray-400">{totalConvs > 0 ? `%${Math.round((openConvs / totalConvs) * 100)}` : "-"}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-[10px] text-gray-500">Çözülen</span></div>
              <p className="text-xl font-bold text-emerald-600">{resolvedConvs}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-violet-500" /><span className="text-[10px] text-gray-500">Ort. Yanıt</span></div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{avgResponse > 0 ? `${avgResponse} dk` : "-"}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-pink-500" /><span className="text-[10px] text-gray-500">Ort. Çözüm</span></div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{avgResolution > 0 ? `${avgResolution} dk` : "-"}</p>
            </div>
          </div>

          {/* Mesaj Hacmi + Saatlik Yoğunluk */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" /> Mesaj Hacmi
              </h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
                  <p className="text-lg font-bold text-blue-600">{totalMsgs}</p>
                  <p className="text-[9px] text-gray-500">Toplam</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-center">
                  <p className="text-lg font-bold text-emerald-600">{customerMsgs}</p>
                  <p className="text-[9px] text-gray-500">Müşteri</p>
                </div>
                <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/20 text-center">
                  <p className="text-lg font-bold text-violet-600">{agentMsgs}</p>
                  <p className="text-[9px] text-gray-500">Personel</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-center">
                  <p className="text-lg font-bold text-amber-600">{botMsgs}</p>
                  <p className="text-[9px] text-gray-500">Bot</p>
                </div>
              </div>
              {/* Günlük Mesaj Trendi */}
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Günlük Mesaj Trendi</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {(() => {
                  const maxD = Math.max(...dailyMsgs.map(d => d.count), 1);
                  return dailyMsgs.slice(-14).map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-16 font-mono">{d.date?.slice(5)}</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(d.count / maxD) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 dark:text-slate-300 w-8 text-right">{d.count}</span>
                    </div>
                  ));
                })()}
                {dailyMsgs.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Veri yok</p>}
              </div>
            </div>

            {/* Saatlik Yoğunluk */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-500" /> Saatlik Mesaj Yoğunluğu
              </h3>
              {hourlyVolume.length > 0 ? (
                <>
                  <div className="grid grid-cols-12 gap-1 mb-2">
                    {Array.from({ length: 24 }, (_, i) => {
                      const found = hourlyVolume.find(h => h.hour === i);
                      const count = found?.count || 0;
                      const intensity = count / maxHourly;
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <div className="w-full rounded-sm" style={{ height: `${Math.max(4, intensity * 48)}px`, backgroundColor: `rgba(99, 102, 241, ${Math.max(0.1, intensity)})` }} />
                          {i % 3 === 0 && <span className="text-[7px] text-gray-400">{String(i).padStart(2, "0")}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                    {peakHour && <span>En yoğun: {String(peakHour.hour).padStart(2, "0")}:00 ({peakHour.count} mesaj)</span>}
                    {quietHour && <span>En sakin: {String(quietHour.hour).padStart(2, "0")}:00</span>}
                  </div>
                </>
              ) : <p className="text-xs text-gray-400 text-center py-4">Saatlik veri yok</p>}

              {/* Mesaj Dağılımı: Müşteri vs Personel */}
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-5">Mesaj Dağılımı</h4>
              {totalMsgs > 0 ? (
                <div className="space-y-2">
                  {[
                    { label: "Müşteri", count: customerMsgs, pct: customerPct, color: "bg-emerald-500" },
                    { label: "Personel", count: agentMsgs, pct: agentPct, color: "bg-blue-500" },
                    { label: "Bot", count: botMsgs, pct: totalMsgs > 0 ? Math.round((botMsgs / totalMsgs) * 100) : 0, color: "bg-amber-500" },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-16">{r.label}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500 w-14 text-right">{r.count} (%{r.pct})</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-400 text-center py-2">Veri yok</p>}
            </div>
          </div>

          {/* Kanal Dağılımı + Personel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" /> Kanal Dağılımı
              </h3>
              <div className="space-y-3">
                {crmChannels.length > 0 ? crmChannels.map(ch => {
                  const info = channelColors[ch.channel_type] || { icon: ch.channel_type?.slice(0, 2).toUpperCase() || "?", color: "bg-gray-400", label: ch.channel_type || "Bilinmiyor" };
                  const pct = totalChannelConvs > 0 ? Math.round((ch.count / totalChannelConvs) * 100) : 0;
                  return (
                    <div key={ch.channel_type} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${info.color} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>{info.icon}</div>
                      <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-20">{info.label}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${info.color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-900 dark:text-white font-medium w-8 text-right">{ch.count}</span>
                      <span className="text-[10px] text-gray-400 w-8 text-right">%{pct}</span>
                    </div>
                  );
                }) : <p className="text-xs text-gray-400 text-center py-4">Kanal verisi yok</p>}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-500" /> Personel Performansı
              </h3>
              <div className="overflow-x-auto">
                {crmAgents.length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-2 font-medium text-gray-500">Personel</th>
                    <th className="text-right py-2 font-medium text-gray-500">Görüşme</th>
                    <th className="text-right py-2 font-medium text-gray-500">Çözülen</th>
                    <th className="text-right py-2 font-medium text-gray-500">Çözüm %</th>
                    <th className="text-right py-2 font-medium text-gray-500">Ort. Yanıt</th>
                  </tr></thead>
                  <tbody>
                    {crmAgents.map((a: any) => (
                      <tr key={a.user_id} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                              <span className="text-[9px] text-white font-bold">{(a.full_name || "?").charAt(0)}</span>
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{a.full_name || `Personel #${a.user_id}`}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-slate-400">{a.conversation_count}</td>
                        <td className="py-2.5 text-right text-emerald-600 font-medium">{a.resolved_count}</td>
                        <td className="py-2.5 text-right">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${Math.round(a.resolution_rate) >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"}`}>%{Math.round(a.resolution_rate)}</span>
                        </td>
                        <td className={`py-2.5 text-right font-medium ${a.avg_response_time_minutes < 15 ? "text-emerald-600" : "text-amber-600"}`}>{a.avg_response_time_minutes ? `${Math.round(a.avg_response_time_minutes)} dk` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                ) : <p className="text-xs text-gray-400 text-center py-4">Personel verisi yok</p>}
              </div>
            </div>
          </div>

          {/* En Çok Sorulan Konular */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-amber-500" /> En Çok Sorulan Konular
            </h3>
            <div className="flex flex-wrap gap-2">
              {keywords.length > 0 ? keywords.map(k => {
                const ratio = k.count / maxKeyword;
                const size = ratio > 0.7 ? "text-base" : ratio > 0.4 ? "text-sm" : ratio > 0.2 ? "text-xs" : "text-[11px]";
                return (
                  <span key={k.word} className={`${size} font-medium px-3 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-600`}>
                    {k.word} <span className="text-[9px] text-gray-400 ml-0.5">({k.count})</span>
                  </span>
                );
              }) : <p className="text-xs text-gray-400">Anahtar kelime verisi yok</p>}
            </div>
          </div>

          {/* Çözüm Performansı */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Çözüm Performansı</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-lg font-bold text-emerald-600">{totalConvs > 0 ? `%${Math.round((resolvedConvs / totalConvs) * 100)}` : "-"}</p>
                <p className="text-[9px] text-gray-500">Çözüm Oranı</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                <p className="text-lg font-bold text-blue-600">{avgResponse > 0 ? `${avgResponse} dk` : "-"}</p>
                <p className="text-[9px] text-gray-500">Ort. Yanıt Süresi</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20">
                <p className="text-lg font-bold text-violet-600">{avgResolution > 0 ? `${avgResolution} dk` : "-"}</p>
                <p className="text-[9px] text-gray-500">Ort. Çözüm Süresi</p>
              </div>
            </div>
          </div>
        </>
        );
      })()}

      {/* ==================== SİPARİŞLER ==================== */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
              placeholder="Sipariş no, müşteri adı veya telefon ara..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
          </div>
          {(filteredOrders.length > 0 ? filteredOrders : orders).filter(o => {
            if (!orderSearch.trim()) return true;
            const q = orderSearch.toLowerCase();
            const name = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.toLowerCase() : "";
            const phone = o.customer?.phone || o.phone || o.shipping_address?.phone || "";
            return o.name?.toLowerCase().includes(q) || name.includes(q) || (o.email || "").toLowerCase().includes(q) || phone.includes(q);
          }).map(o => {
            const fulfillment = o.fulfillment_status || "unfulfilled";
            const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : o.email?.split("@")[0] || "-";
            const isExpanded = expandedOrder === o.id;
            return (
              <div key={o.id} className="card overflow-hidden">
                <div className="flex items-center gap-2 lg:gap-3 p-3 lg:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedOrder(isExpanded ? null : o.id)}>
                  <div className={`w-1.5 lg:w-2 h-10 rounded-full flex-shrink-0 ${fulfillment === "fulfilled" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 lg:gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{o.name}</span>
                      <span className="text-xs text-gray-500 truncate hidden sm:inline">{customerName}</span>
                      <span className={`text-[10px] px-1.5 lg:px-2 py-0.5 rounded-full font-semibold ${orderStatusColors[fulfillment]?.color || "bg-gray-100 text-gray-500"}`}>{orderStatusColors[fulfillment]?.label}</span>
                      <span className={`text-[10px] font-medium hidden sm:inline ${paymentStatusColors[o.financial_status]?.color || "text-gray-500"}`}>{paymentStatusColors[o.financial_status]?.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5"><span className="sm:hidden">{customerName} · </span>{o.line_items?.length} ürün · {new Date(o.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
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
                          {(o.customer?.email || o.email) && (
                            <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <span className="text-gray-500">E-posta</span>
                              <span className="text-gray-700 dark:text-slate-300">{o.customer?.email || o.email}</span>
                            </div>
                          )}
                          {(o.customer?.phone || o.phone || o.shipping_address?.phone) && (
                            <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <span className="text-gray-500">Telefon</span>
                              <span className="text-gray-700 dark:text-slate-300">{o.customer?.phone || o.phone || o.shipping_address?.phone}</span>
                            </div>
                          )}
                          {o.shipping_address && (
                            <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <span className="text-gray-500 block mb-1">Teslimat Adresi</span>
                              <span className="text-gray-700 dark:text-slate-300">{o.shipping_address.address1 ? o.shipping_address.address1 + ", " : ""}{o.shipping_address.city}, {o.shipping_address.province} {o.shipping_address.country}</span>
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
      {activeTab === "returns" && (() => {
        // Calculate real refund amounts from refund transactions
        const getRefundAmount = (o: any) => {
          const refunds = o.refunds || [];
          const totalRefunded = refunds.reduce((s: number, r: any) => {
            const txTotal = (r.transactions || []).reduce((ts: number, tx: any) => tx.kind === "refund" && tx.status === "success" ? ts + parseFloat(tx.amount || "0") : ts, 0);
            return s + txTotal;
          }, 0);
          return totalRefunded > 0 ? totalRefunded : parseFloat(o.total_price || "0");
        };

        // Get refund date for an order (latest refund date)
        const getRefundDate = (o: any): Date => {
          const refunds = o.refunds || [];
          if (refunds.length > 0) return new Date(refunds[refunds.length - 1].created_at || o.created_at);
          return new Date(o.created_at);
        };

        // Filter refund orders by selected period
        const periodRefunds = refundOrders.filter(o => getRefundDate(o) >= periodStart);

        const totalRefundAmount = periodRefunds.reduce((s, o) => s + getRefundAmount(o), 0);
        const fullRefunds = periodRefunds.filter(o => o.financial_status === "refunded");
        const partialRefunds = periodRefunds.filter(o => o.financial_status === "partially_refunded");
        const fullPct = periodRefunds.length > 0 ? Math.round((fullRefunds.length / periodRefunds.length) * 100) : 0;

        // Most returned products (period filtered)
        const productRefunds: Record<string, { name: string; count: number; amount: number }> = {};
        periodRefunds.forEach((o: any) => {
          (o.refunds || []).forEach((r: any) => {
            if (new Date(r.created_at) < periodStart) return;
            (r.refund_line_items || []).forEach((rli: any) => {
              const title = rli.line_item?.title || "Bilinmiyor";
              if (!productRefunds[title]) productRefunds[title] = { name: title, count: 0, amount: 0 };
              productRefunds[title].count += rli.quantity || 1;
              productRefunds[title].amount += parseFloat(rli.subtotal || "0");
            });
          });
        });
        const topReturnedProducts = Object.values(productRefunds).sort((a, b) => b.count - a.count).slice(0, 8);
        const maxProductCount = topReturnedProducts.length > 0 ? topReturnedProducts[0].count : 1;

        // Daily refund trend (period filtered)
        const dailyRefunds: Record<string, { count: number; amount: number }> = {};
        periodRefunds.forEach((o: any) => {
          (o.refunds || []).forEach((r: any) => {
            if (new Date(r.created_at) < periodStart) return;
            const day = r.created_at?.slice(0, 10);
            if (!day) return;
            if (!dailyRefunds[day]) dailyRefunds[day] = { count: 0, amount: 0 };
            dailyRefunds[day].count++;
            const txAmount = (r.transactions || []).reduce((s: number, tx: any) => tx.kind === "refund" && tx.status === "success" ? s + parseFloat(tx.amount || "0") : s, 0);
            dailyRefunds[day].amount += txAmount;
          });
        });
        const dailyTrend = Object.entries(dailyRefunds).sort(([a], [b]) => a.localeCompare(b)).map(([day, d]) => ({ day, ...d }));
        const maxDailyRefund = Math.max(...dailyTrend.map(d => d.count), 1);

        // Filter by search (from period-filtered set)
        const filteredRefunds = periodRefunds.filter(o => {
          if (!returnSearch.trim()) return true;
          const q = returnSearch.toLowerCase();
          const name = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.toLowerCase() : "";
          return o.name?.toLowerCase().includes(q) || name.includes(q) || (o.email || "").toLowerCase().includes(q);
        });

        return (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-[10px] text-gray-500">Toplam İade</span></div>
              <p className="text-xl font-bold text-red-600">{refundOrders.length}</p>
              <p className="text-[10px] text-gray-400">Shopify canlı veri</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-red-500" /><span className="text-[10px] text-gray-500">İade Tutarı</span></div>
              <p className="text-xl font-bold text-red-600">{totalRefundAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-amber-500" /><span className="text-[10px] text-gray-500">İade Oranı</span></div>
              <p className="text-xl font-bold text-amber-600">%{stats?.ordersCount > 0 ? ((refundOrders.length / stats.ordersCount) * 100).toFixed(1) : 0}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-red-500" /><span className="text-[10px] text-gray-500">Tam İade</span></div>
              <p className="text-xl font-bold text-red-600">{fullRefunds.length}</p>
              <p className="text-[10px] text-gray-400">%{fullPct}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-orange-500" /><span className="text-[10px] text-gray-500">Kısmi İade</span></div>
              <p className="text-xl font-bold text-orange-600">{partialRefunds.length}</p>
              <p className="text-[10px] text-gray-400">%{100 - fullPct}</p>
            </div>
          </div>

          {/* Tam vs Kısmi İade Oranı */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-4 rounded-full overflow-hidden flex">
                <div className="h-full bg-red-500" style={{ width: `${fullPct}%` }} />
                <div className="h-full bg-orange-400" style={{ width: `${100 - fullPct}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Tam İade %{fullPct} ({fullRefunds.length})</span>
              <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Kısmi İade %{100 - fullPct} ({partialRefunds.length})</span>
            </div>
          </div>

          {/* En Çok İade Edilen Ürünler + İade Trendi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-red-500" /> En Çok İade Edilen Ürünler
              </h3>
              <div className="space-y-2">
                {topReturnedProducts.length > 0 ? topReturnedProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${(p.count / maxProductCount) * 100}%` }} />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600 dark:text-slate-400 truncate mt-0.5">{p.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold text-red-600">{p.count}</span>
                      <p className="text-[9px] text-gray-400">{p.amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
                    </div>
                  </div>
                )) : <p className="text-xs text-gray-400 text-center py-4">Ürün iade detayı yok</p>}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-red-500" /> İade Trendi
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {dailyTrend.length > 0 ? dailyTrend.slice(-21).map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-14 text-right font-mono">{d.day.slice(5)}</span>
                    <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${(d.count / maxDailyRefund) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-red-600 w-6 text-right">{d.count}</span>
                    <span className="text-[9px] text-gray-400 w-16 text-right">{d.amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                  </div>
                )) : <p className="text-xs text-gray-400 text-center py-4">İade trendi verisi yok</p>}
              </div>
            </div>
          </div>

          {/* Arama + İade Listesi */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={returnSearch} onChange={e => setReturnSearch(e.target.value)}
              placeholder="Sipariş no, müşteri adı veya e-posta ara..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
          </div>

          <div className="space-y-2">
            {filteredRefunds.map(o => {
              const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : o.email?.split("@")[0] || "-";
              const isExpanded = expandedOrder === o.id;
              const refundAmount = getRefundAmount(o);
              const refundDate = o.refunds?.[0]?.created_at;
              const refundedItems = (o.refunds || []).flatMap((r: any) => r.refund_line_items || []);

              return (
                <div key={o.id} className="card overflow-hidden border-l-4 border-l-red-400">
                  <div className="flex items-center gap-2 lg:gap-3 p-3 lg:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => setExpandedOrder(isExpanded ? null : o.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 lg:gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{o.name}</span>
                        <span className="text-xs text-gray-500 truncate">{customerName}</span>
                        <span className={`text-[10px] px-1.5 lg:px-2 py-0.5 rounded-full font-semibold ${o.financial_status === "refunded" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"}`}>
                          {o.financial_status === "refunded" ? "Tam İade" : "Kısmi İade"}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {refundedItems.length > 0
                          ? refundedItems.map((rli: any) => `${rli.line_item?.title || "?"} x${rli.quantity}`).join(", ")
                          : o.line_items?.map((l: any) => l.title).join(", ")}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-red-600">{refundAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
                      <p className="text-[10px] text-gray-400">{refundDate ? new Date(refundDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : new Date(o.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</p>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-800 pt-3">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">İade Edilen Ürünler</h4>
                          <div className="space-y-2">
                            {refundedItems.length > 0 ? refundedItems.map((rli: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/10">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 dark:text-white">{rli.line_item?.title || "Ürün"}</p>
                                  {rli.line_item?.variant_title && <p className="text-[10px] text-gray-400">{rli.line_item.variant_title}</p>}
                                </div>
                                <span className="text-[10px] text-gray-500">{rli.quantity} adet</span>
                                <span className="text-xs font-medium text-red-600">{parseFloat(rli.subtotal || "0").toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                              </div>
                            )) : o.line_items?.map((li: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/10">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 dark:text-white">{li.title}</p>
                                  {li.variant_title && <p className="text-[10px] text-gray-400">{li.variant_title}</p>}
                                </div>
                                <span className="text-[10px] text-gray-500">{li.quantity} adet</span>
                                <span className="text-xs font-medium text-red-600">{parseFloat(li.price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">İade Detayı</h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <span className="text-gray-500">Sipariş Tutarı</span>
                              <span className="font-medium text-gray-900 dark:text-white">{parseFloat(o.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                            </div>
                            <div className="flex justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                              <span className="text-red-600">İade Tutarı</span>
                              <span className="font-bold text-red-600">{refundAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</span>
                            </div>
                            {o.refunds?.map((r: any, ri: number) => (
                              <div key={ri}>
                                <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                                  <span className="text-gray-500">İade Tarihi</span>
                                  <span className="text-gray-700 dark:text-slate-300">{new Date(r.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
                                </div>
                                {r.note && (
                                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 mt-2">
                                    <span className="text-amber-700 dark:text-amber-300 block text-[10px] font-medium mb-0.5">Not</span>
                                    <span className="text-gray-700 dark:text-slate-300">{r.note}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                              <span className="text-gray-500">Müşteri</span>
                              <span className="text-gray-700 dark:text-slate-300">{customerName}</span>
                            </div>
                            {(o.customer?.email || o.email) && (
                              <div className="flex justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                                <span className="text-gray-500">E-posta</span>
                                <span className="text-gray-700 dark:text-slate-300">{o.customer?.email || o.email}</span>
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
            {filteredRefunds.length === 0 && (
              <div className="card p-8 text-center">
                {returnSearch ? (
                  <>
                    <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Aramayla eşleşen iade bulunamadı.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">İade kaydı bulunmuyor.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </>
        );
      })()}
    </div>
  );
}
