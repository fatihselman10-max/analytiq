"use client";

import { useState, useEffect, useCallback } from "react";
import { reportsAPI } from "@/lib/api";
import { ReportOverview, AgentReport, ChannelReport, MessageAnalytics } from "@/types";
import { useAuthStore } from "@/store/auth";
import { isDemoOrg, DEMO_REPORTS } from "@/lib/demo-data";
import StatCard from "@/components/ui/StatCard";
import ConversationVolumeChart from "@/components/charts/ConversationVolumeChart";
import ChannelPieChart from "@/components/charts/ChannelPieChart";
import {
  MessageSquare,
  MessageCircle,
  Clock,
  CheckCircle,
  Users,
  Bot,
  Calendar,
  BarChart3,
  TrendingUp,
  Inbox,
  Instagram,
  Mail,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PERIODS = [
  { value: "7d", label: "Son 7 Gün" },
  { value: "30d", label: "Son 30 Gün" },
  { value: "90d", label: "Son 90 Gün" },
  { value: "all", label: "Tüm Zamanlar" },
];

export default function ReportsPage() {
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [channels, setChannels] = useState<ChannelReport[]>([]);
  const [msgAnalytics, setMsgAnalytics] = useState<MessageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "crm">("overview");
  const [period, setPeriod] = useState("30d");
  const [channelFilter, setChannelFilter] = useState("all");

  const { organization } = useAuthStore();
  const isDemo = isDemoOrg(organization?.name);

  const loadData = useCallback(async (p: string, ch: string) => {
    if (isDemo) {
      const dr = DEMO_REPORTS;
      setOverview({
        total_conversations: dr.overview.total_conversations,
        open_conversations: dr.overview.open_conversations,
        resolved_count: dr.overview.resolved_conversations,
        avg_response_time_minutes: dr.overview.avg_response_time,
        daily_volume: dr.overview.daily,
      } as any);
      setAgents(dr.agents.map(a => ({
        user_id: a.agent_id,
        full_name: a.agent_name,
        conversation_count: a.total_conversations,
        resolved_count: a.resolved,
        avg_response_time_minutes: a.avg_response_time,
        resolution_rate: (a.resolved / a.total_conversations) * 100,
      })) as any);
      setChannels(dr.channels.map(c => ({
        channel_type: c.channel,
        conversation_count: c.count,
        percentage: c.percentage,
      })) as any);
      setMsgAnalytics({
        total_messages: dr.messages.total,
        customer_messages: dr.messages.inbound,
        agent_messages: dr.messages.outbound,
        bot_messages: 47,
        hourly_volume: dr.messages.hourly,
        daily_messages: dr.messages.daily.map(d => ({ date: d.date, count: d.inbound + d.outbound })),
        keywords: dr.messages.keywords,
      } as any);
      setLoading(false);
      return;
    }
    setLoading(true);
    const chParam = ch === "all" ? undefined : ch;
    try {
      const [ovRes, agRes, chRes, msgRes] = await Promise.all([
        reportsAPI.overview(p, chParam),
        reportsAPI.agents(p, chParam),
        reportsAPI.channels(p),
        reportsAPI.messages(p, chParam),
      ]);
      setOverview(ovRes.data || null);
      setAgents(agRes.data?.agents || []);
      setChannels(chRes.data?.channels || []);
      setMsgAnalytics(msgRes.data || null);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  }, [isDemo, organization]);

  useEffect(() => {
    if (!organization) return;
    loadData(period, channelFilter);
  }, [period, channelFilter, loadData, organization]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalMsgs = msgAnalytics?.total_messages || 0;
  const customerMsgs = msgAnalytics?.customer_messages || 0;
  const agentMsgs = msgAnalytics?.agent_messages || 0;
  const botMsgs = msgAnalytics?.bot_messages || 0;

  return (
    <div className="p-4 lg:p-8 space-y-4 lg:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Raporlar</h1>
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
          {/* Kanal Filtresi */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            {[
              { value: "all", label: "Tümü", icon: Layers },
              { value: "instagram", label: "Instagram", icon: Instagram },
              { value: "email", label: "E-posta", icon: Mail },
            ].map((ch) => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.value}
                  onClick={() => setChannelFilter(ch.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    channelFilter === ch.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ch.label}
                </button>
              );
            })}
          </div>
          {/* Tarih Seçici */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <Calendar className="h-4 w-4 text-gray-400 ml-2 mr-1" />
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  period === p.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Sekme Seçici */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Genel Bakış
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "analysis" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Mesaj Analizi
            </button>
            <button
              onClick={() => setActiveTab("crm")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === "crm" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              CRM & Segment
            </button>
          </div>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          {/* KPI Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Toplam Görüşme" value={String(overview?.total_conversations || 0)} icon={MessageSquare} />
            <StatCard
              title="Açık Görüşme"
              value={String(overview?.open_conversations || 0)}
              icon={MessageCircle}
              change={overview?.total_conversations ? `%${((overview.open_conversations / overview.total_conversations) * 100).toFixed(0)}` : undefined}
              changeType={overview?.open_conversations ? "negative" : "neutral"}
            />
            <StatCard title="Ort. Yanıt Süresi" value={`${(overview?.avg_response_time_minutes || 0).toFixed(1)} dk`} icon={Clock} />
            <StatCard
              title="Çözüldü"
              value={String(overview?.resolved_count || 0)}
              icon={CheckCircle}
              change={overview?.total_conversations ? `%${((overview.resolved_count / overview.total_conversations) * 100).toFixed(0)} çözüm oranı` : undefined}
              changeType="positive"
            />
          </div>

          {/* Grafikler */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Günlük Görüşme Hacmi</h3>
              <ConversationVolumeChart data={overview?.daily_volume || []} />
            </div>
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Kanal Dağılımı</h3>
              <ChannelPieChart data={channels} />
            </div>
          </div>

          {/* Temsilci Tablosu */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Temsilci Performansı</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Temsilci</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Görüşme</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Ort. Yanıt</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Çözüldü</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Çözüm Oranı</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.user_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-medium text-gray-900">{agent.full_name}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{agent.conversation_count}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{agent.avg_response_time_minutes.toFixed(1)} dk</td>
                      <td className="py-3 px-4 text-right text-gray-600">{agent.resolved_count}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-medium ${
                          agent.resolution_rate >= 80 ? "bg-green-50 text-green-700" : agent.resolution_rate >= 50 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"
                        }`}>%{agent.resolution_rate.toFixed(0)}</span>
                      </td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-400">Henüz veri yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "analysis" && (
        <>
          {/* Mesaj İstatistik Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Toplam Mesaj" value={String(totalMsgs)} icon={Inbox} />
            <StatCard
              title="Müşteri Mesajları"
              value={String(customerMsgs)}
              icon={Users}
              change={totalMsgs > 0 ? `%${((customerMsgs / totalMsgs) * 100).toFixed(0)}` : undefined}
              changeType="neutral"
            />
            <StatCard
              title="Temsilci Mesajları"
              value={String(agentMsgs)}
              icon={MessageSquare}
              change={totalMsgs > 0 ? `%${((agentMsgs / totalMsgs) * 100).toFixed(0)}` : undefined}
              changeType="positive"
            />
            <StatCard
              title="Bot Mesajları"
              value={String(botMsgs)}
              icon={Bot}
              change={totalMsgs > 0 ? `%${((botMsgs / totalMsgs) * 100).toFixed(0)}` : undefined}
              changeType="neutral"
            />
          </div>

          {/* Grafik Satırı */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Saatlik Dağılım */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Saatlik Dağılım</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">Müşterilerinizin en çok mesaj gönderdiği saatler</p>
              {(msgAnalytics?.hourly_volume || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={fillHourlyData(msgAnalytics?.hourly_volume || [])}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}:00`} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(v) => `${v}:00 - ${v}:59`}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                    />
                    <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} name="Mesaj" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">Henüz veri yok</div>
              )}
            </div>

            {/* Günlük Mesaj Trendi */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Günlük Mesaj Trendi</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">Gelen ve giden mesaj hacmi</p>
              {(msgAnalytics?.daily_messages || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={msgAnalytics?.daily_messages || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
                    <Bar dataKey="count" fill="#059669" radius={[3, 3, 0, 0]} name="Mesaj" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">Henüz veri yok</div>
              )}
            </div>
          </div>

          {/* Kelime Bulutu */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Sık Kullanılan Kelimeler</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Müşteri mesajlarında en çok geçen anahtar kelimeler</p>
            {(msgAnalytics?.keywords || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {msgAnalytics!.keywords.map((kw, i) => {
                  const maxC = msgAnalytics!.keywords[0].count;
                  const ratio = kw.count / maxC;
                  const size = 0.75 + ratio * 0.55;
                  const colors = [
                    "bg-blue-50 border-blue-100 text-blue-700",
                    "bg-violet-50 border-violet-100 text-violet-700",
                    "bg-emerald-50 border-emerald-100 text-emerald-700",
                    "bg-amber-50 border-amber-100 text-amber-700",
                    "bg-rose-50 border-rose-100 text-rose-700",
                  ];
                  const color = colors[i % colors.length];
                  return (
                    <span
                      key={kw.word}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all hover:shadow-sm cursor-default ${color}`}
                      style={{ fontSize: `${size}rem`, opacity: 0.6 + ratio * 0.4 }}
                    >
                      <span className="font-medium">{kw.word}</span>
                      <span className="text-xs font-normal opacity-60">({kw.count})</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Henüz yeterli mesaj verisi yok</p>
                <p className="text-xs mt-1">Müşterilerinizden mesaj geldikçe burada analiz görüntülenecek</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "crm" && (
        <CRMReportsTab />
      )}
    </div>
  );
}

// CRM Reports tab (inline)
const CRM_SEGMENT_DATA = [
  { id: 1, label: "Satis + Iletisim", count: 3, prev: 2, color: "bg-emerald-500", pct: 20 },
  { id: 2, label: "Iletisim Var, Satis Yok", count: 5, prev: 4, color: "bg-blue-500", pct: 33 },
  { id: 3, label: "Buyuk Firma, Ulasilamiyor", count: 3, prev: 4, color: "bg-amber-500", pct: 20 },
  { id: 4, label: "Normal Firma, Ulasilamiyor", count: 4, prev: 5, color: "bg-red-500", pct: 27 },
];
const CRM_MOVEMENTS = [
  { from: 4, to: 2, count: 2, label: "Segment 4 → 2", description: "Iletisim kuruldu", direction: "up" },
  { from: 2, to: 1, count: 1, label: "Segment 2 → 1", description: "Satis gerceklesti", direction: "up" },
  { from: 3, to: 2, count: 1, label: "Segment 3 → 2", description: "Buyuk firmaya ulasildi", direction: "up" },
  { from: 1, to: 2, count: 1, label: "Segment 1 → 2", description: "Musteri bu sezon siparis vermedi", direction: "down" },
];
const CRM_CAMPAIGN_STATS = [
  { name: "Yeni Sezon Kumas Katalogu", sent: 28, responded: 12, rate: 43, orders: 3 },
  { name: "Rusca Tanitim Filmi", sent: 42, responded: 8, rate: 19, orders: 0 },
  { name: "8 Mart Tebrigi", sent: 52, responded: 18, rate: 35, orders: 1 },
  { name: "Fuar Sonrasi Takip", sent: 10, responded: 2, rate: 20, orders: 0 },
];
const CRM_DIRECTION = { inbound: { count: 18, pct: 31 }, outbound: { count: 40, pct: 69 } };

function CRMReportsTab() {
  const totalCustomers = CRM_SEGMENT_DATA.reduce((s, d) => s + d.count, 0);
  const totalWins = CRM_MOVEMENTS.filter(m => m.direction === "up").reduce((s, m) => s + m.count, 0);
  const totalLosses = CRM_MOVEMENTS.filter(m => m.direction === "down").reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Toplam Musteri</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCustomers}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Segment Yukselme</p>
          <p className="text-2xl font-bold text-green-600">+{totalWins}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Segment Dusus</p>
          <p className="text-2xl font-bold text-red-600">-{totalLosses}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Iletisim Yonu</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-blue-600 font-medium">Giden %{CRM_DIRECTION.outbound.pct}</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-green-600 font-medium">Gelen %{CRM_DIRECTION.inbound.pct}</span>
          </div>
        </div>
      </div>

      {/* Segment Distribution + Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Segment Dagilimi</h3>
          <div className="space-y-3">
            {CRM_SEGMENT_DATA.map(seg => (
              <div key={seg.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 dark:text-slate-300">S{seg.id}: {seg.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-white font-bold">{seg.count}</span>
                    {seg.count > seg.prev ? (
                      <span className="text-green-600 text-[10px]">+{seg.count - seg.prev}</span>
                    ) : seg.count < seg.prev ? (
                      <span className="text-red-600 text-[10px]">{seg.count - seg.prev}</span>
                    ) : null}
                  </div>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${seg.color}`} style={{ width: `${seg.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Segment Gecisleri</h3>
          <div className="space-y-2">
            {CRM_MOVEMENTS.map((m, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${m.direction === "up" ? "bg-green-50/50 dark:bg-green-950/30 border border-green-100 dark:border-green-900" : "bg-red-50/50 dark:bg-red-950/30 border border-red-100 dark:border-red-900"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${m.direction === "up" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                  <span className="text-xs font-bold">{m.direction === "up" ? "↑" : "↓"}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.label} <span className="text-gray-400 font-normal">({m.count} musteri)</span></p>
                  <p className="text-xs text-gray-500">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign Performance */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Kampanya Performansi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-gray-500">Kampanya</th>
                <th className="text-right py-2 font-medium text-gray-500">Gonderilen</th>
                <th className="text-right py-2 font-medium text-gray-500">Cevap</th>
                <th className="text-right py-2 font-medium text-gray-500">Oran</th>
                <th className="text-right py-2 font-medium text-gray-500">Siparis</th>
              </tr>
            </thead>
            <tbody>
              {CRM_CAMPAIGN_STATS.map(c => (
                <tr key={c.name} className="border-b border-gray-50 dark:border-slate-800">
                  <td className="py-2.5 font-medium text-gray-900 dark:text-white">{c.name}</td>
                  <td className="py-2.5 text-right text-gray-600 dark:text-slate-400">{c.sent}</td>
                  <td className="py-2.5 text-right text-gray-600 dark:text-slate-400">{c.responded}</td>
                  <td className="py-2.5 text-right"><span className={`px-2 py-0.5 rounded text-xs font-medium ${c.rate >= 30 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>%{c.rate}</span></td>
                  <td className="py-2.5 text-right font-medium text-gray-900 dark:text-white">{c.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Eksik saatleri (0-23) 0 ile doldur
function fillHourlyData(data: { hour: number; count: number }[]) {
  const map = new Map(data.map((d) => [d.hour, d.count]));
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: map.get(i) || 0,
  }));
}
