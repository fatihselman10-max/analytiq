"use client";

import { useState, useEffect } from "react";
import { analyticsAPI } from "@/lib/api";
import { AdPerformance } from "@/types";
import StatCard from "@/components/ui/StatCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { DollarSign, Eye, MousePointer, Target, TrendingUp, Percent } from "lucide-react";
import { format, subDays } from "date-fns";

const formatTRY = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(value);

export default function MarketingPage() {
  const [data, setData] = useState<AdPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("");
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: perf } = await analyticsAPI.getAdPerformance({
          start_date: dateRange.start,
          end_date: dateRange.end,
          platform: platform || undefined,
        });
        setData(perf);
      } catch (err) {
        console.error("Failed to fetch ad performance:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange, platform]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Reklam Performansı
        </h1>
        <div className="flex items-center gap-3">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Tüm Platformlar</option>
            <option value="meta">Meta (Facebook/Instagram)</option>
            <option value="google">Google Ads</option>
            <option value="tiktok">TikTok Ads</option>
          </select>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, start: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, end: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Toplam Harcama"
          value={formatTRY(summary?.total_spend || 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Gösterim"
          value={(summary?.total_impressions || 0).toLocaleString("tr-TR")}
          icon={Eye}
        />
        <StatCard
          title="Tıklama"
          value={(summary?.total_clicks || 0).toLocaleString("tr-TR")}
          icon={MousePointer}
        />
        <StatCard
          title="Dönüşüm"
          value={(summary?.total_conversions || 0).toLocaleString("tr-TR")}
          icon={Target}
        />
        <StatCard
          title="ROAS"
          value={(summary?.roas || 0).toFixed(2)}
          suffix="x"
          icon={TrendingUp}
          changeType={(summary?.roas || 0) >= 2 ? "positive" : "negative"}
        />
        <StatCard
          title="CTR"
          value={(summary?.ctr || 0).toFixed(2)}
          suffix="%"
          icon={Percent}
        />
      </div>

      {/* Daily Spend vs Revenue Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Günlük Harcama & Gelir
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.daily || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatTRY(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="spend"
                name="Harcama"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Gelir"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROAS Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          ROAS Trendi
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.daily || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}x`} />
              <Bar dataKey="roas" name="ROAS" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Campaign Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Kampanya Performansı
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">
                  Kampanya
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">
                  Platform
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Harcama
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Gösterim
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Tıklama
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Dönüşüm
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Gelir
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  ROAS
                </th>
              </tr>
            </thead>
            <tbody>
              {(data?.campaigns || []).map((camp, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {camp.campaign_name}
                  </td>
                  <td className="py-3 px-4">
                    <span className="capitalize px-2 py-1 rounded bg-gray-100 text-xs">
                      {camp.platform}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatTRY(camp.spend)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {camp.impressions.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {camp.clicks.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {camp.conversions}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatTRY(camp.revenue)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-bold ${
                      camp.roas >= 2 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {camp.roas.toFixed(2)}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
