"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { reportsAPI } from "@/lib/api";
import {
  Inbox, MessageSquare, Clock, CheckCircle, TrendingUp,
  Bot, ArrowRight, Users, Sparkles, BarChart3, Loader2,
  Mail, MessageCircle, Send, Timer, Zap,
} from "lucide-react";

export default function DashboardPage() {
  const { user, organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("7d");
  const [overview, setOverview] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [msgData, setMsgData] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!organization) return;
    loadAll();
    const interval = setInterval(() => {
      loadAll(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [organization, period]);

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [overviewRes, agentsRes, channelsRes, messagesRes] = await Promise.all([
        reportsAPI.overview(period).catch(() => ({ data: null })),
        reportsAPI.agents(period).catch(() => ({ data: null })),
        reportsAPI.channels(period).catch(() => ({ data: null })),
        reportsAPI.messages(period).catch(() => ({ data: null })),
      ]);

      setOverview(overviewRes.data);
      setAgents(overviewRes.data?.agents || agentsRes.data?.agents || []);
      setChannels(channelsRes.data?.channels || []);
      setMsgData(messagesRes.data);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
    setLoading(false);

    // AI Briefing - daily cache per period
    const todayKey = `ai-crm-briefing-${period}-${new Date().toISOString().slice(0, 10)}`;
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
      const [overviewRes, channelsRes] = await Promise.all([
        reportsAPI.overview(period).then(r => r.data).catch(() => null),
        reportsAPI.channels(period).then(r => r.data).catch(() => null),
      ]);

      const ov = overviewRes;
      const chs = channelsRes?.channels || [];
      const openConvs = ov?.open_conversations || 0;
      const resolvedConvs = ov?.resolved_count || 0;
      const totalMessages = ov?.total_messages || 0;
      const avgResponseMin = ov?.avg_response_time_minutes || 0;
      const avgResolutionMin = ov?.avg_resolution_time_minutes || 0;

      const channelSummary = chs.map((c: any) => `${c.name || c.type}: ${c.message_count || 0} mesaj`).join(", ");

      const periodLabels: Record<string, string> = {
        "7d": "son 7 gün", "30d": "son 30 gün", "90d": "son 3 ay",
      };
      const periodText = periodLabels[period] || "son 7 gün";

      const prompt = `Sen bir CRM ve müşteri destek danışmanısın. Aşağıdaki müşteri iletişim verilerini değerlendirip kısa bir brifing hazırla.

MÜŞTERİ İLETİŞİM VERİLERİ (${periodText}):
- ${openConvs} açık konuşma cevaplanmayı bekliyor.
- ${resolvedConvs} konuşma çözüldü.
- Toplam ${totalMessages} mesaj alındı/gönderildi.
- Ortalama yanıt süresi: ${avgResponseMin} dakika.
- Ortalama çözüm süresi: ${avgResolutionMin} dakika.
- Kanal dağılımı: ${channelSummary || "veri yok"}.

KURALLAR:
- Tam 4 madde yaz. Her madde yeni satırda başlasın.
- Her madde tam ve bitmiş bir cümle olsun, kesinlikle yarım bırakma.
- 1. madde: Genel iletişim performansını değerlendir - açık konuşma sayısı ve çözüm oranını yorumla.
- 2. madde: Yanıt süresi ve çözüm süresi hakkında yorum yap, iyileştirme önerisi ver.
- 3. madde: Kanal bazlı bir gözlem yap, en yoğun kanaldan bahset.
- 4. madde: Bugün yapılması gereken en önemli müşteri iletişim aksiyonu ne? Somut öneri ver.
- Türkçe yaz. Emoji kullanma, madde işareti kullanma, düz cümleler yaz.`;

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

  const ov = overview;
  const openConvs = ov?.open_conversations || 0;
  const resolvedConvs = ov?.resolved_count || 0;
  const avgResponseMin = ov?.avg_response_time_minutes || 0;
  const avgResolutionMin = ov?.avg_resolution_time_minutes || 0;
  const totalMessages = ov?.total_messages || 0;
  const pendingConvs = ov?.pending_conversations || 0;

  const periodLabel: Record<string, string> = {
    "7d": "Son 7 Gün", "30d": "Son 30 Gün", "90d": "Son 3 Ay",
  };

  // Sort channels by message count for Kanal Dağılımı
  const sortedChannels = [...channels].sort((a: any, b: any) => (b.message_count || 0) - (a.message_count || 0));
  const totalChannelMessages = sortedChannels.reduce((s: number, c: any) => s + (c.message_count || 0), 0);

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            {greeting}, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {organization?.name} - Müşteri İletişim Özeti
          </p>
        </div>
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {[
            { key: "7d", label: "7 Gün" },
            { key: "30d", label: "30 Gün" },
            { key: "90d", label: "3 Ay" },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${period === p.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Günlük Brifing */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 dark:from-slate-950 dark:via-violet-950/80 dark:to-indigo-950/80 rounded-2xl p-4 shadow-lg">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <span className="text-xs font-semibold text-white/80">CRM Brifing</span>
            </div>
            <span className="text-[9px] text-white/30 hidden sm:inline">Müşteri iletişim özeti - {periodLabel[period] || "Son 7 Gün"}</span>
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
            <p className="text-[11px] text-white/50">
              {openConvs} açık konuşma, {resolvedConvs} çözülmüş. Ortalama yanıt süresi: {avgResponseMin} dk.
            </p>
          )}
        </div>
      </div>

      {/* CRM KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Link href="/inbox?status=open" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950"><MessageSquare className="h-4 w-4 text-orange-600" /></div>
            <span className="text-xs text-gray-500">Açık Konuşma</span>
          </div>
          <p className="text-xl font-bold text-orange-600">{openConvs}</p>
          <p className="text-[10px] text-gray-400 mt-1">Cevaplanmayı bekliyor</p>
        </Link>

        <Link href="/inbox?status=resolved" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950"><CheckCircle className="h-4 w-4 text-emerald-600" /></div>
            <span className="text-xs text-gray-500">Çözülen</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{resolvedConvs}</p>
          <p className="text-[10px] text-gray-400 mt-1">{periodLabel[period] || "Son 7 Gün"}</p>
        </Link>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950"><Clock className="h-4 w-4 text-blue-600" /></div>
            <span className="text-xs text-gray-500">Ort. Yanıt Süresi</span>
          </div>
          <p className={`text-xl font-bold ${avgResponseMin > 60 ? "text-red-600" : avgResponseMin > 30 ? "text-amber-600" : "text-emerald-600"}`}>
            {avgResponseMin > 60 ? `${Math.round(avgResponseMin / 60)} sa` : `${avgResponseMin} dk`}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">{avgResponseMin <= 30 ? "İyi performans" : avgResponseMin <= 60 ? "Geliştirilebilir" : "İyileştirme gerekli"}</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950"><Timer className="h-4 w-4 text-violet-600" /></div>
            <span className="text-xs text-gray-500">Ort. Çözüm Süresi</span>
          </div>
          <p className={`text-xl font-bold ${avgResolutionMin > 1440 ? "text-red-600" : avgResolutionMin > 480 ? "text-amber-600" : "text-emerald-600"}`}>
            {avgResolutionMin > 1440 ? `${Math.round(avgResolutionMin / 1440)} gün` : avgResolutionMin > 60 ? `${Math.round(avgResolutionMin / 60)} sa` : `${avgResolutionMin} dk`}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">{periodLabel[period] || "Son 7 Gün"}</p>
        </div>

        <Link href="/reports" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950"><Send className="h-4 w-4 text-cyan-600" /></div>
            <span className="text-xs text-gray-500">Toplam Mesaj</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{totalMessages}</p>
          <p className="text-[10px] text-gray-400 mt-1">Gelen + giden</p>
        </Link>
      </div>

      {/* Ana Grid: Müşteri İletişimi + Kanal Dağılımı + Hızlı Erişim */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Müşteri İletişimi */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Müşteri İletişimi
            </h2>
            <Link href="/inbox" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Gelen Kutusu <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-center">
              <p className="text-2xl font-bold text-orange-600">{openConvs}</p>
              <p className="text-xs text-gray-500 mt-1">Açık</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-center">
              <p className="text-2xl font-bold text-emerald-600">{resolvedConvs}</p>
              <p className="text-xs text-gray-500 mt-1">Çözülen</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingConvs}</p>
              <p className="text-xs text-gray-500 mt-1">Bekleyen</p>
            </div>
          </div>

          {/* Agent Performance */}
          {agents.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Temsilci Performansı</h3>
              <div className="space-y-2">
                {agents.slice(0, 5).map((agent: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(agent.name || agent.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{agent.name || agent.full_name || "Temsilci"}</p>
                      <p className="text-[10px] text-gray-400">{agent.resolved_count || 0} çözüm, {agent.message_count || 0} mesaj</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-bold ${(agent.avg_response_time_minutes || 0) > 60 ? "text-amber-600" : "text-emerald-600"}`}>
                        {(agent.avg_response_time_minutes || 0) > 60 ? `${Math.round((agent.avg_response_time_minutes || 0) / 60)} sa` : `${agent.avg_response_time_minutes || 0} dk`}
                      </p>
                      <p className="text-[10px] text-gray-400">ort. yanıt</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sağ Panel */}
        <div className="space-y-4">
          {/* Kanal Dağılımı */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Kanal Dağılımı
            </h2>
            {sortedChannels.length > 0 ? (
              <div className="space-y-3">
                {sortedChannels.slice(0, 6).map((ch: any, i: number) => {
                  const count = ch.message_count || 0;
                  const pct = totalChannelMessages > 0 ? Math.round((count / totalChannelMessages) * 100) : 0;
                  const channelColors: Record<string, string> = {
                    instagram: "bg-pink-500", whatsapp: "bg-emerald-500", email: "bg-blue-500",
                    telegram: "bg-cyan-500", facebook: "bg-blue-600", twitter: "bg-sky-500",
                    livechat: "bg-violet-500", vk: "bg-indigo-500",
                  };
                  const barColor = channelColors[(ch.type || "").toLowerCase()] || "bg-gray-400";
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-700 dark:text-slate-300">{ch.name || ch.type}</span>
                        <span className="text-xs font-medium text-gray-500">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Kanal verisi bulunamadı</p>
            )}
          </div>

          {/* Hızlı Erişim */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Hızlı Erişim</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/inbox", label: "Gelen Kutusu", icon: Inbox, color: "bg-orange-50 dark:bg-orange-950 text-orange-600" },
                { href: "/bot", label: "AI Bot", icon: Bot, color: "bg-violet-50 dark:bg-violet-950 text-violet-600" },
                { href: "/contacts", label: "Kişiler", icon: Users, color: "bg-blue-50 dark:bg-blue-950 text-blue-600" },
                { href: "/automations", label: "Otomasyonlar", icon: Zap, color: "bg-cyan-50 dark:bg-cyan-950 text-cyan-600" },
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
