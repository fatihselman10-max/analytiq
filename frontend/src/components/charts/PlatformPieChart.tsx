"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { PlatformMetric } from "@/types";

interface PlatformPieChartProps {
  data: PlatformMetric[];
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

const PLATFORM_LABELS: Record<string, string> = {
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  n11: "N11",
  amazon: "Amazon",
  ciceksepeti: "Çiçeksepeti",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

export default function PlatformPieChart({ data }: PlatformPieChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    name: PLATFORM_LABELS[d.platform] || d.platform,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Platform Dağılımı
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="revenue"
              label={({ name, share }) => `${name} %${share.toFixed(1)}`}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat("tr-TR", {
                  style: "currency",
                  currency: "TRY",
                }).format(value)
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
