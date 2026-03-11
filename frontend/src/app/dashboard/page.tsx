"use client";

import { useState, useEffect } from "react";
import { dashboardAPI } from "@/lib/api";
import { DashboardOverview } from "@/types";
import StatCard from "@/components/ui/StatCard";
import RevenueChart from "@/components/charts/RevenueChart";
import PlatformPieChart from "@/components/charts/PlatformPieChart";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Megaphone,
  Target,
  BarChart3,
} from "lucide-react";
import { format, subDays } from "date-fns";

const formatTRY = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(value);

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: overview } = await dashboardAPI.getOverview(
          dateRange.start,
          dateRange.end
        );
        setData(overview);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Toplam Gelir"
          value={formatTRY(data?.total_revenue || 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Toplam Sipariş"
          value={(data?.total_orders || 0).toLocaleString("tr-TR")}
          icon={ShoppingCart}
        />
        <StatCard
          title="Net Kâr"
          value={formatTRY(data?.total_profit || 0)}
          icon={TrendingUp}
          changeType={
            (data?.total_profit || 0) >= 0 ? "positive" : "negative"
          }
        />
        <StatCard
          title="Reklam Harcaması"
          value={formatTRY(data?.total_ad_spend || 0)}
          icon={Megaphone}
        />
        <StatCard
          title="ROAS"
          value={(data?.roas || 0).toFixed(2)}
          suffix="x"
          icon={Target}
        />
        <StatCard
          title="Ortalama Sepet"
          value={formatTRY(data?.aov || 0)}
          icon={BarChart3}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart data={data?.revenue_by_day || []} />
        </div>
        <PlatformPieChart data={data?.platform_split || []} />
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          En Çok Satan Ürünler
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">
                  Ürün
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">
                  SKU
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Adet
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Gelir
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Kâr
                </th>
              </tr>
            </thead>
            <tbody>
              {(data?.top_products || []).map((product, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{product.sku}</td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {product.quantity}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {formatTRY(product.revenue)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      product.profit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatTRY(product.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Son Siparişler
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">
                  Sipariş No
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">
                  Platform
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">
                  Müşteri
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Tutar
                </th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">
                  Durum
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">
                  Tarih
                </th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_orders || []).map((order) => (
                <tr key={order.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-mono text-sm text-gray-900">
                    {order.platform_order_id}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700 capitalize">
                      {order.platform}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900">
                    {order.customer_name}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatTRY(order.total_amount)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500">
                    {order.order_date}
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

function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700",
    processing: "bg-blue-50 text-blue-700",
    shipped: "bg-indigo-50 text-indigo-700",
    delivered: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
    returned: "bg-orange-50 text-orange-700",
  };
  const labels: Record<string, string> = {
    pending: "Beklemede",
    processing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
    returned: "İade",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        styles[status] || "bg-gray-50 text-gray-700"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
