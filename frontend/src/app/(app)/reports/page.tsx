"use client";

import { useState, useEffect } from "react";
import { reportsAPI } from "@/lib/api";
import { ReportOverview, AgentReport, ChannelReport } from "@/types";
import StatCard from "@/components/ui/StatCard";
import ConversationVolumeChart from "@/components/charts/ConversationVolumeChart";
import ChannelPieChart from "@/components/charts/ChannelPieChart";
import { MessageSquare, MessageCircle, Clock, CheckCircle } from "lucide-react";

export default function ReportsPage() {
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [channels, setChannels] = useState<ChannelReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ovRes, agRes, chRes] = await Promise.all([
          reportsAPI.overview(),
          reportsAPI.agents(),
          reportsAPI.channels(),
        ]);
        setOverview(ovRes.data);
        setAgents(agRes.data.agents || []);
        setChannels(chRes.data.channels || []);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Toplam Gorusme"
          value={String(overview?.total_conversations || 0)}
          icon={MessageSquare}
        />
        <StatCard
          title="Acik Gorusme"
          value={String(overview?.open_conversations || 0)}
          icon={MessageCircle}
          changeType={overview?.open_conversations ? "negative" : "neutral"}
        />
        <StatCard
          title="Ort. Yanit Suresi"
          value={`${(overview?.avg_response_time_minutes || 0).toFixed(1)} dk`}
          icon={Clock}
        />
        <StatCard
          title="Ort. Cozum Suresi"
          value={`${(overview?.avg_resolution_time_minutes || 0).toFixed(1)} dk`}
          icon={CheckCircle}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gunluk Gorusme Hacmi</h3>
          <ConversationVolumeChart data={overview?.daily_volume || []} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Kanal Dagilimi</h3>
          <ChannelPieChart data={channels} />
        </div>
      </div>

      {/* Agent Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ajan Performansi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Ajan</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Gorusme</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Ort. Yanit</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Cozuldu</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Cozum Orani</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{agent.full_name}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{agent.conversation_count}</td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {agent.avg_response_time_minutes.toFixed(1)} dk
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">{agent.resolved_count}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      agent.resolution_rate >= 80
                        ? "bg-green-50 text-green-700"
                        : agent.resolution_rate >= 50
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-red-50 text-red-700"
                    }`}>
                      %{agent.resolution_rate.toFixed(0)}
                    </span>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Henuz veri yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
