"use client";

import { useState, useEffect } from "react";
import { reportsAPI } from "@/lib/api";
import { ReportOverview, AgentReport, ChannelReport } from "@/types";
import StatCard from "@/components/ui/StatCard";
import ConversationVolumeChart from "@/components/charts/ConversationVolumeChart";
import ChannelPieChart from "@/components/charts/ChannelPieChart";
import {
  MessageSquare,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  ThumbsDown,
  HelpCircle,
  TrendingUp,
  BarChart3,
} from "lucide-react";

const SAMPLE_TOPICS = [
  { topic: "Kargo Gecikmesi", count: 142, trend: "+12%", sentiment: "negative", icon: AlertTriangle },
  { topic: "Ürün İadesi", count: 98, trend: "+5%", sentiment: "negative", icon: ThumbsDown },
  { topic: "Fiyat Bilgisi", count: 87, trend: "-3%", sentiment: "neutral", icon: HelpCircle },
  { topic: "Ödeme Sorunu", count: 64, trend: "+8%", sentiment: "negative", icon: AlertTriangle },
  { topic: "Ürün Bilgisi", count: 56, trend: "+2%", sentiment: "neutral", icon: HelpCircle },
  { topic: "Teşekkür / Memnuniyet", count: 45, trend: "+15%", sentiment: "positive", icon: TrendingUp },
];

const SAMPLE_KEYWORDS = [
  { word: "kargo", count: 234 },
  { word: "iade", count: 187 },
  { word: "fiyat", count: 156 },
  { word: "teslim", count: 134 },
  { word: "ödeme", count: 112 },
  { word: "bozuk", count: 89 },
  { word: "geç", count: 78 },
  { word: "değişim", count: 67 },
  { word: "indirim", count: 56 },
  { word: "teşekkür", count: 45 },
];

const sentimentColors = {
  positive: "bg-green-50 text-green-700 border-green-100",
  negative: "bg-red-50 text-red-700 border-red-100",
  neutral: "bg-gray-50 text-gray-600 border-gray-100",
};

export default function ReportsPage() {
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [channels, setChannels] = useState<ChannelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "analysis">("overview");

  useEffect(() => {
    async function load() {
      try {
        const [ovRes, agRes, chRes] = await Promise.all([
          reportsAPI.overview(),
          reportsAPI.agents(),
          reportsAPI.channels(),
        ]);
        setOverview(ovRes.data || null);
        setAgents(agRes.data?.agents || []);
        setChannels(chRes.data?.channels || []);
      } catch (err) {
        console.error("Failed to load reports", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
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
            Müşteri Analizi
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Toplam Görüşme" value={String(overview?.total_conversations || 0)} icon={MessageSquare} />
            <StatCard title="Açık Görüşme" value={String(overview?.open_conversations || 0)} icon={MessageCircle}
              changeType={overview?.open_conversations ? "negative" : "neutral"} />
            <StatCard title="Ort. Yanıt Süresi" value={`${(overview?.avg_response_time_minutes || 0).toFixed(1)} dk`} icon={Clock} />
            <StatCard title="Ort. Çözüm Süresi" value={`${(overview?.avg_resolution_time_minutes || 0).toFixed(1)} dk`} icon={CheckCircle} />
          </div>

          {/* Charts */}
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

          {/* Agent Table */}
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
          {/* Sentiment Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 border-l-4 border-l-red-400">
              <p className="text-sm text-gray-500 font-medium">Olumsuz Mesajlar</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">%38</p>
              <p className="text-xs text-red-500 mt-1">Şikâyet ve sorun bildirimleri</p>
            </div>
            <div className="card p-5 border-l-4 border-l-gray-400">
              <p className="text-sm text-gray-500 font-medium">Nötr Mesajlar</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">%47</p>
              <p className="text-xs text-gray-500 mt-1">Bilgi talebi ve sorular</p>
            </div>
            <div className="card p-5 border-l-4 border-l-green-400">
              <p className="text-sm text-gray-500 font-medium">Olumlu Mesajlar</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">%15</p>
              <p className="text-xs text-green-500 mt-1">Teşekkür ve memnuniyet</p>
            </div>
          </div>

          {/* Topic Analysis */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Konu Analizi</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Müşterilerinizin en çok iletişime geçtiği konular ve şikâyet başlıkları</p>
            <div className="space-y-3">
              {SAMPLE_TOPICS.map((t) => {
                const maxCount = SAMPLE_TOPICS[0].count;
                const Icon = t.icon;
                return (
                  <div key={t.topic} className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${sentimentColors[t.sentiment as keyof typeof sentimentColors]} border`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{t.topic}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium ${
                            t.trend.startsWith("+") && t.sentiment === "negative" ? "text-red-500" : t.trend.startsWith("-") ? "text-green-500" : "text-gray-400"
                          }`}>{t.trend}</span>
                          <span className="text-sm font-semibold text-gray-700 w-10 text-right">{t.count}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${
                          t.sentiment === "negative" ? "bg-red-400" : t.sentiment === "positive" ? "bg-green-400" : "bg-gray-400"
                        }`} style={{ width: `${(t.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Keyword Cloud */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sık Kullanılan Kelimeler</h3>
            <p className="text-sm text-gray-500 mb-4">Müşteri mesajlarında en çok geçen anahtar kelimeler</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_KEYWORDS.map((kw) => {
                const maxC = SAMPLE_KEYWORDS[0].count;
                const size = 0.7 + (kw.count / maxC) * 0.6;
                const opacity = 0.5 + (kw.count / maxC) * 0.5;
                return (
                  <span key={kw.word}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 transition-all hover:shadow-sm cursor-default"
                    style={{ fontSize: `${size}rem`, opacity }}>
                    <span className="text-blue-700 font-medium">{kw.word}</span>
                    <span className="text-blue-400 text-xs font-normal">({kw.count})</span>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="card p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
            <p className="text-sm text-blue-800 font-medium">Bu veriler örnek olarak gösterilmektedir</p>
            <p className="text-xs text-blue-600 mt-1">Kanallarınızı bağladıktan sonra gerçek müşteri mesajlarından otomatik analiz yapılacaktır.</p>
          </div>
        </>
      )}
    </div>
  );
}
