"use client";

import { useState, useEffect } from "react";
import { analyticsAPI } from "@/lib/api";
import { ProfitAnalysis } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, subDays } from "date-fns";

const formatTRY = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(value);

export default function AnalyticsPage() {
  const [data, setData] = useState<ProfitAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: profit } = await analyticsAPI.getProfitAnalysis({
          start_date: dateRange.start,
          end_date: dateRange.end,
        });
        setData(profit);
      } catch (err) {
        console.error("Failed to fetch profit analysis:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const waterfallData = data
    ? [
        { name: "Gelir", value: data.revenue, color: "#3b82f6" },
        { name: "Ürün Maliyeti", value: -data.cogs, color: "#ef4444" },
        { name: "Brüt Kâr", value: data.gross_profit, color: "#10b981" },
        { name: "Komisyon", value: -data.commission, color: "#f59e0b" },
        { name: "Reklam", value: -data.ad_spend, color: "#ef4444" },
        { name: "Kargo", value: -data.shipping_cost, color: "#f59e0b" },
        { name: "Net Kâr", value: data.net_profit, color: data.net_profit >= 0 ? "#10b981" : "#ef4444" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kâr/Zarar Analizi</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, start: e.target.value }))
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <span className="text-gray-400">-</span>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Toplam Gelir</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatTRY(data?.revenue || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Brüt Kâr</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatTRY(data?.gross_profit || 0)}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Marj: %{(data?.gross_margin || 0).toFixed(1)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Net Kâr</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              (data?.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatTRY(data?.net_profit || 0)}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Marj: %{(data?.net_margin || 0).toFixed(1)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Ortalama Sepet (AOV)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatTRY(data?.aov || 0)}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {data?.total_orders || 0} sipariş
          </p>
        </div>
      </div>

      {/* Waterfall Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Kâr/Zarar Şelale Grafiği
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatTRY(Math.abs(v))} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed P&L */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Detaylı Kâr/Zarar Tablosu
        </h3>
        <div className="space-y-3">
          <PLRow label="Toplam Gelir" value={data?.revenue || 0} bold />
          <PLRow
            label="(-) Ürün Maliyeti (COGS)"
            value={-(data?.cogs || 0)}
            negative
          />
          <div className="border-t border-gray-200 pt-3">
            <PLRow label="Brüt Kâr" value={data?.gross_profit || 0} bold />
          </div>
          <PLRow
            label="(-) Pazaryeri Komisyonu"
            value={-(data?.commission || 0)}
            negative
          />
          <PLRow
            label="(-) Reklam Harcaması"
            value={-(data?.ad_spend || 0)}
            negative
          />
          <PLRow
            label="(-) Kargo Maliyeti"
            value={-(data?.shipping_cost || 0)}
            negative
          />
          <PLRow
            label="(-) İndirimler"
            value={-(data?.discount || 0)}
            negative
          />
          <div className="border-t-2 border-gray-300 pt-3">
            <PLRow
              label="Net Kâr"
              value={data?.net_profit || 0}
              bold
              highlight
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PLRow({
  label,
  value,
  bold,
  negative,
  highlight,
}: {
  label: string;
  value: number;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={`text-sm ${bold ? "font-semibold text-gray-900" : "text-gray-600"}`}
      >
        {label}
      </span>
      <span
        className={`text-sm ${
          highlight
            ? value >= 0
              ? "text-green-600 font-bold text-lg"
              : "text-red-600 font-bold text-lg"
            : negative
            ? "text-red-500"
            : bold
            ? "font-semibold text-gray-900"
            : "text-gray-900"
        }`}
      >
        {formatTRY(value)}
      </span>
    </div>
  );
}
