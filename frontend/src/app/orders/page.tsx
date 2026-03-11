"use client";

import { useState, useEffect, useCallback } from "react";
import { ordersAPI } from "@/lib/api";
import { OrderSummary } from "@/types";
import { Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";

const formatTRY = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(value);

const STATUS_OPTIONS = [
  { value: "", label: "Tüm Durumlar" },
  { value: "pending", label: "Beklemede" },
  { value: "processing", label: "Hazırlanıyor" },
  { value: "shipped", label: "Kargoda" },
  { value: "delivered", label: "Teslim Edildi" },
  { value: "cancelled", label: "İptal" },
];

const PLATFORM_OPTIONS = [
  { value: "", label: "Tüm Platformlar" },
  { value: "trendyol", label: "Trendyol" },
  { value: "hepsiburada", label: "Hepsiburada" },
  { value: "n11", label: "N11" },
  { value: "amazon", label: "Amazon" },
  { value: "ciceksepeti", label: "Çiçeksepeti" },
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ordersAPI.list({
        page,
        per_page: 50,
        platform: platform || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setOrders(data.orders || []);
      setTotalPages(data.total_pages);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [page, platform, status, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Siparişler</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sipariş no veya müşteri adı ara..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {PLATFORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="text-sm text-gray-500">
            <Filter className="inline h-4 w-4 mr-1" />
            {total.toLocaleString("tr-TR")} sipariş
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
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
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-sm">
                      {order.platform_order_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize">{order.platform}</span>
                    </td>
                    <td className="py-3 px-4">{order.customer_name}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatTRY(order.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      {order.order_date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Sayfa {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700",
    processing: "bg-blue-50 text-blue-700",
    shipped: "bg-indigo-50 text-indigo-700",
    delivered: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    pending: "Beklemede",
    processing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
  };
  return (
    <span
      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
        styles[status] || "bg-gray-50 text-gray-700"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
