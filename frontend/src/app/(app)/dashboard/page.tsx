"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg, DEMO_CONVERSATIONS, DEMO_REPORTS, DEMO_TEAM, DEMO_CHANNELS, DEMO_AUTOMATIONS, DEMO_BOT_CONFIG, DEMO_CSAT_RESPONSES, DEMO_KB_ARTICLES } from "@/lib/demo-data";
import { conversationsAPI, reportsAPI, teamAPI, channelsAPI } from "@/lib/api";
import {
  Inbox, MessageSquare, Clock, CheckCircle, Users, TrendingUp,
  Bot, Radio, Workflow, BookOpen, Star, ArrowRight, AlertTriangle,
  Target, Megaphone, BarChart3, Zap,
} from "lucide-react";

export default function DashboardPage() {
  const { user, organization } = useAuthStore();
  const isDemo = isDemoOrg(organization?.name);
  const [loading, setLoading] = useState(true);

  // Data state
  const [stats, setStats] = useState({
    openConversations: 0,
    pendingConversations: 0,
    resolvedToday: 0,
    avgResponseTime: 0,
    totalContacts: 0,
    csatScore: 0,
    activeAutomations: 0,
    botResponses: 0,
    activeChannels: 0,
    kbArticles: 0,
    teamMembers: 0,
  });
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [channelBreakdown, setChannelBreakdown] = useState<{ channel: string; count: number; color: string }[]>([]);

  useEffect(() => {
    if (!organization) return;
    loadDashboard();
  }, [organization, isDemo]);

  const loadDashboard = async () => {
    setLoading(true);
    if (isDemo) {
      const convs = DEMO_CONVERSATIONS;
      setStats({
        openConversations: convs.filter(c => c.status === "open").length,
        pendingConversations: convs.filter(c => c.status === "pending").length,
        resolvedToday: 4,
        avgResponseTime: DEMO_REPORTS.overview.avg_response_time,
        totalContacts: 15,
        csatScore: DEMO_CSAT_RESPONSES.stats.avg_rating,
        activeAutomations: DEMO_AUTOMATIONS.filter(a => a.is_active).length,
        botResponses: DEMO_BOT_CONFIG.total_responses,
        activeChannels: DEMO_CHANNELS.length,
        kbArticles: DEMO_KB_ARTICLES.length,
        teamMembers: DEMO_TEAM.length,
      });
      setRecentConversations(convs.filter(c => c.status === "open").slice(0, 5));
      setChannelBreakdown(DEMO_REPORTS.channels.map(c => ({
        channel: c.channel,
        count: c.count,
        color: channelColor(c.channel),
      })));
      setLoading(false);
      return;
    }
    try {
      const [convRes, ovRes] = await Promise.all([
        conversationsAPI.list(),
        reportsAPI.overview("7d"),
      ]);
      const convs = convRes.data?.conversations || convRes.data || [];
      const ov = ovRes.data;
      setStats({
        openConversations: ov?.open_conversations || 0,
        pendingConversations: convs.filter((c: any) => c.status === "pending").length,
        resolvedToday: ov?.resolved_count || 0,
        avgResponseTime: ov?.avg_response_time_minutes || 0,
        totalContacts: 0,
        csatScore: 0,
        activeAutomations: 0,
        botResponses: 0,
        activeChannels: 0,
        kbArticles: 0,
        teamMembers: 0,
      });
      setRecentConversations(convs.filter((c: any) => c.status === "open").slice(0, 5));
    } catch {}
    setLoading(false);
  };

  const channelColor = (ch: string) => {
    const map: Record<string, string> = {
      whatsapp: "#25D366", telegram: "#0088cc", instagram: "#E4405F",
      email: "#6B7280", vk: "#4680C2", facebook: "#1877F2",
    };
    return map[ch] || "#9CA3AF";
  };

  const channelLabel = (ch: string) => {
    const map: Record<string, string> = {
      whatsapp: "WhatsApp", telegram: "Telegram", instagram: "Instagram",
      email: "E-posta", vk: "VK", facebook: "Facebook",
    };
    return map[ch] || ch;
  };

  const statusColor = (s: string) => {
    if (s === "open") return "bg-green-100 text-green-700";
    if (s === "pending") return "bg-yellow-100 text-yellow-700";
    if (s === "resolved") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  const statusLabel = (s: string) => {
    if (s === "open") return "Acik";
    if (s === "pending") return "Beklemede";
    if (s === "resolved") return "Cozuldu";
    return "Kapali";
  };

  const channelIcon = (ch: string) => {
    const map: Record<string, string> = { whatsapp: "WA", telegram: "TG", instagram: "IG", email: "EM", vk: "VK" };
    return map[ch] || "CH";
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Gunaydin" : hour < 18 ? "Iyi gunler" : "Iyi aksamlar";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          {greeting}, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {organization?.name} - Isletme ozeti
        </p>
      </div>

      {/* KPI Cards - Top Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/inbox" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950">
              <Inbox className="h-5 w-5 text-orange-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.openConversations}</p>
          <p className="text-xs text-gray-500 mt-0.5">Acik Gorusme</p>
          {stats.pendingConversations > 0 && (
            <p className="text-[10px] text-yellow-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {stats.pendingConversations} beklemede
            </p>
          )}
        </Link>

        <Link href="/reports" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-green-50 dark:bg-green-950">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgResponseTime.toFixed(1)} dk</p>
          <p className="text-xs text-gray-500 mt-0.5">Ort. Yanit Suresi</p>
        </Link>

        <Link href="/reports" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.resolvedToday}</p>
          <p className="text-xs text-gray-500 mt-0.5">Cozulen (bugun)</p>
        </Link>

        <Link href="/settings" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-yellow-50 dark:bg-yellow-950">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.csatScore.toFixed(1)}/5</p>
          <p className="text-xs text-gray-500 mt-0.5">CSAT Puani</p>
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Conversations */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              Son Gorusmeler
            </h2>
            <Link href="/inbox" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Tumunu Gor <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentConversations.map((conv: any) => (
              <Link key={conv.id} href="/inbox"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{conv.contact?.name?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{conv.contact?.name}</p>
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0">{channelIcon(conv.channel_type)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{conv.last_message}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor(conv.status)}`}>
                    {statusLabel(conv.status)}
                  </span>
                  {conv.priority === "high" || conv.priority === "urgent" ? (
                    <span className="text-[10px] text-red-500 font-medium">{conv.priority === "urgent" ? "Acil" : "Yuksek"}</span>
                  ) : null}
                </div>
              </Link>
            ))}
            {recentConversations.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Acik gorusme yok</p>
            )}
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-purple-600" />
              Kanal Dagilimi
            </h2>
            <Link href="/channels" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Kanallara Git <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {channelBreakdown.map((ch) => {
              const total = channelBreakdown.reduce((s, c) => s + c.count, 0);
              const pct = total > 0 ? (ch.count / total) * 100 : 0;
              return (
                <div key={ch.channel}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 dark:text-slate-300">{channelLabel(ch.channel)}</span>
                    <span className="text-gray-500">{ch.count} (%{pct.toFixed(0)})</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: ch.color }} />
                  </div>
                </div>
              );
            })}
            {channelBreakdown.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Kanal verisi yok</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/crm" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950"><Target className="h-4 w-4 text-emerald-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">CRM</h3>
          </div>
          <p className="text-xs text-gray-500">{stats.totalContacts} musteri</p>
        </Link>

        <Link href="/sales" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950"><TrendingUp className="h-4 w-4 text-blue-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Satis Analizi</h3>
          </div>
          <p className="text-xs text-gray-500">Donusum & gelir</p>
        </Link>

        <Link href="/bot" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950"><Bot className="h-4 w-4 text-violet-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Bot</h3>
          </div>
          <p className="text-xs text-gray-500">{stats.botResponses} cevap</p>
        </Link>

        <Link href="/automations" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950"><Workflow className="h-4 w-4 text-amber-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Otomasyonlar</h3>
          </div>
          <p className="text-xs text-gray-500">{stats.activeAutomations} aktif</p>
        </Link>

        <Link href="/campaigns" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-pink-50 dark:bg-pink-950"><Megaphone className="h-4 w-4 text-pink-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Kampanyalar</h3>
          </div>
          <p className="text-xs text-gray-500">Toplu mesajlar</p>
        </Link>

        <Link href="/knowledge-base" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950"><BookOpen className="h-4 w-4 text-cyan-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bilgi Bankasi</h3>
          </div>
          <p className="text-xs text-gray-500">{stats.kbArticles} makale</p>
        </Link>

        <Link href="/team" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950"><Users className="h-4 w-4 text-indigo-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ekip</h3>
          </div>
          <p className="text-xs text-gray-500">{stats.teamMembers} uye</p>
        </Link>

        <Link href="/reports" className="card p-4 hover:shadow-md transition-all group hover:border-blue-200 dark:hover:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950"><BarChart3 className="h-4 w-4 text-rose-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Raporlar</h3>
          </div>
          <p className="text-xs text-gray-500">Detayli analiz</p>
        </Link>
      </div>
    </div>
  );
}
