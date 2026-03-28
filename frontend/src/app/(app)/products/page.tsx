"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import {
  ShoppingBag, Package, Search, AlertCircle, CheckCircle,
  RefreshCw, Eye, TrendingUp, Loader2, Image,
} from "lucide-react";

type ShopifyProduct = {
  id: number;
  title: string;
  product_type: string;
  status: string;
  variants: { id: number; price: string; compare_at_price: string | null; inventory_quantity: number; sku: string }[];
  images: { src: string }[];
};

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: "Aktif", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  out_of_stock: { label: "Tükendi", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
  low_stock: { label: "Az Stok", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  draft: { label: "Taslak", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export default function ProductsPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, productsRes, ordersRes] = await Promise.all([
        fetch("/api/shopify?action=stats"),
        fetch("/api/shopify?action=products&limit=500"),
        fetch("/api/shopify?action=orders&limit=250"),
      ]);
      const ordersData = await ordersRes.json();
      const recentOrders = ordersData.orders || [];
      const statsData = await statsRes.json();
      const productsData = await productsRes.json();

      setStats(statsData);

      // Calculate daily sales per product from recent orders
      const productSales: Record<string, number> = {};
      const daysSpan = recentOrders.length > 0 ? Math.max(1, Math.ceil((Date.now() - new Date(recentOrders[recentOrders.length - 1]?.created_at).getTime()) / (1000 * 60 * 60 * 24))) : 30;
      recentOrders.forEach((o: any) => {
        o.line_items?.forEach((li: any) => {
          const pid = String(li.product_id);
          productSales[pid] = (productSales[pid] || 0) + li.quantity;
        });
      });

      const mapped = (productsData.products || []).map((p: ShopifyProduct) => {
        const totalStock = p.variants.reduce((s, v) => s + (v.inventory_quantity || 0), 0);
        const price = parseFloat(p.variants[0]?.price || "0");
        const comparePrice = parseFloat(p.variants[0]?.compare_at_price || "0");
        const sku = p.variants[0]?.sku || "-";
        const status = p.status === "draft" ? "draft" : totalStock === 0 ? "out_of_stock" : totalStock < 10 ? "low_stock" : "active";
        const soldRecent = productSales[String(p.id)] || 0;
        const dailySales = daysSpan > 0 ? soldRecent / daysSpan : 0;
        const runway = dailySales > 0 ? Math.round(totalStock / dailySales) : totalStock > 0 ? 999 : 0;
        return {
          id: p.id,
          name: p.title,
          sku,
          price,
          comparePrice: comparePrice > price ? comparePrice : 0,
          stock: totalStock,
          status,
          category: p.product_type || "Diğer",
          variants: p.variants.length,
          image: p.images?.[0]?.src || "",
          dailySales: Math.round(dailySales * 10) / 10,
          runway,
          soldRecent,
        };
      });
      setProducts(mapped);
    } catch (err) {
      console.error("Shopify fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!organization) return;
    fetchData();
  }, [organization]);

  const handleSync = async () => {
    setSyncing(true);
    await fetchData();
    setSyncing(false);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const outOfStock = products.filter(p => p.status === "out_of_stock").length;
  const lowStock = products.filter(p => p.status === "low_stock").length;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Ürünler</h1>
          <p className="text-sm text-gray-500 mt-1">{stats?.shop?.name || "Mağaza"} - Shopify ürünleri</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full font-semibold flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Shopify Bağlı
          </span>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Senkronize
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-blue-500" /><span className="text-xs text-gray-500">Toplam Ürün</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.productsCount || products.length}</p>
          <p className="text-[10px] text-gray-400">{products.filter(p => p.status === "active").length} aktif</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-gray-500">Tükenen</span></div>
          <p className="text-xl font-bold text-red-600">{outOfStock}</p>
          <p className="text-[10px] text-gray-400">Stok bitti</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-amber-500" /><span className="text-xs text-gray-500">Az Stok</span></div>
          <p className="text-xl font-bold text-amber-600">{lowStock}</p>
          <p className="text-[10px] text-gray-400">10 adetten az</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün veya SKU ara..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
        </div>
        <div className="flex gap-2">
          {[{ key: "all", label: `Tumu (${products.length})` }, { key: "active", label: "Aktif" }, { key: "low_stock", label: `Az Stok (${lowStock})` }, { key: "out_of_stock", label: `Tükenmis (${outOfStock})` }].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${statusFilter === f.key ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Ürün</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">SKU</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Fiyat</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Stok</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Günlük Satış</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Runway</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><Image className="h-4 w-4 text-gray-400" /></div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[250px]">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-[10px]">{p.sku}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-medium text-gray-900 dark:text-white">{parseFloat(p.price).toLocaleString()} TL</span>
                    {p.comparePrice > 0 && <span className="text-[10px] text-gray-400 line-through ml-1">{parseFloat(p.comparePrice).toLocaleString()}</span>}
                  </td>
                  <td className={`py-3 px-4 text-right font-medium ${p.stock === 0 ? "text-red-600" : p.stock < 10 ? "text-amber-600" : "text-gray-900 dark:text-white"}`}>{p.stock}</td>
                  <td className="py-3 px-4 text-right text-gray-500">{p.dailySales > 0 ? `${p.dailySales}/gün` : "-"}</td>
                  <td className="py-3 px-4 text-right">
                    {p.runway === 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">Tükendi</span>
                    ) : p.runway < 7 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">{p.runway} gün</span>
                    ) : p.runway < 30 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">{p.runway} gün</span>
                    ) : p.runway >= 999 ? (
                      <span className="text-[10px] text-gray-400">Satış yok</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">{p.runway} gün</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusMap[p.status]?.color || ""}`}>{statusMap[p.status]?.label || p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
