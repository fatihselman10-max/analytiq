"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import {
  ShoppingBag, Package, Search, AlertCircle, CheckCircle,
  RefreshCw, TrendingUp, Loader2, Image, ChevronDown, ChevronUp,
  ArrowUpDown, BarChart3, Layers, Flame,
} from "lucide-react";

type ShopifyProduct = {
  id: number;
  title: string;
  product_type: string;
  status: string;
  variants: { id: number; title: string; price: string; compare_at_price: string | null; inventory_quantity: number; sku: string; option1: string | null; option2: string | null; option3: string | null }[];
  images: { src: string }[];
  options: { name: string; values: string[] }[];
};

type MappedProduct = {
  id: number;
  name: string;
  sku: string;
  price: number;
  comparePrice: number;
  stock: number;
  status: string;
  category: string;
  variants: ShopifyProduct["variants"];
  variantCount: number;
  image: string;
  dailySales: number;
  runway: number;
  soldRecent: number;
  revenue: number;
  options: ShopifyProduct["options"];
};

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: "Aktif", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  out_of_stock: { label: "Tükendi", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
  low_stock: { label: "Az Stok", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  draft: { label: "Taslak", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

type SortKey = "name" | "price" | "stock" | "dailySales" | "runway" | "revenue";

export default function ProductsPage() {
  const { organization } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MappedProduct[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [activeSection, setActiveSection] = useState<"all" | "alerts" | "top" | "categories">("all");

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

      // Calculate weekly sales per product (last 7 days only)
      const productSales: Record<string, { qty: number; revenue: number }> = {};
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weeklyOrders = recentOrders.filter((o: any) => new Date(o.created_at) >= sevenDaysAgo);
      weeklyOrders.forEach((o: any) => {
        o.line_items?.forEach((li: any) => {
          const pid = String(li.product_id);
          if (!productSales[pid]) productSales[pid] = { qty: 0, revenue: 0 };
          productSales[pid].qty += li.quantity;
          productSales[pid].revenue += parseFloat(li.price) * li.quantity;
        });
      });

      const mapped: MappedProduct[] = (productsData.products || []).map((p: ShopifyProduct) => {
        const totalStock = p.variants.reduce((s, v) => s + (v.inventory_quantity || 0), 0);
        const price = parseFloat(p.variants[0]?.price || "0");
        const comparePrice = parseFloat(p.variants[0]?.compare_at_price || "0");
        const sku = p.variants[0]?.sku || "-";
        const status = p.status === "draft" ? "draft" : totalStock === 0 ? "out_of_stock" : totalStock < 10 ? "low_stock" : "active";
        const sales = productSales[String(p.id)] || { qty: 0, revenue: 0 };
        const dailySales = sales.qty / 7; // weekly orders / 7 = daily avg
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
          variants: p.variants,
          variantCount: p.variants.length,
          image: p.images?.[0]?.src || "",
          dailySales: Math.round(dailySales * 10) / 10,
          runway,
          soldRecent: sales.qty,
          revenue: Math.round(sales.revenue),
          options: p.options || [],
        };
      });
      setProducts(mapped);
    } catch (err) {
      console.error("Shopify fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (organization) fetchData(); }, [organization]);

  const handleSync = async () => { setSyncing(true); await fetchData(); setSyncing(false); };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string") return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const outOfStock = products.filter(p => p.status === "out_of_stock");
  const lowStock = products.filter(p => p.status === "low_stock");
  const totalStockValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const topSellers = [...products].sort((a, b) => b.soldRecent - a.soldRecent).filter(p => p.soldRecent > 0).slice(0, 10);
  const fastestDepleting = [...products].filter(p => p.runway > 0 && p.runway < 999).sort((a, b) => a.runway - b.runway).slice(0, 8);

  // Category analysis
  const categoryMap: Record<string, { count: number; stock: number; revenue: number; sold: number }> = {};
  products.forEach(p => {
    const cat = p.category || "Diğer";
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, stock: 0, revenue: 0, sold: 0 };
    categoryMap[cat].count++;
    categoryMap[cat].stock += p.stock;
    categoryMap[cat].revenue += p.revenue;
    categoryMap[cat].sold += p.soldRecent;
  });
  const categories = Object.entries(categoryMap).sort(([, a], [, b]) => b.revenue - a.revenue);
  const maxCatRevenue = categories.length > 0 ? categories[0][1].revenue : 1;

  const SortHeader = ({ label, field, className = "" }: { label: string; field: SortKey; className?: string }) => (
    <th className={`py-3 px-4 font-medium text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-slate-300 select-none ${className}`} onClick={() => handleSort(field)}>
      <div className={`flex items-center gap-1 ${className.includes("text-right") ? "justify-end" : ""}`}>
        {label}
        {sortKey === field ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </div>
    </th>
  );

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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-blue-500" /><span className="text-[10px] text-gray-500">Toplam Ürün</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.productsCount || products.length}</p>
          <p className="text-[10px] text-gray-400">{products.filter(p => p.status === "active").length} aktif</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-emerald-500" /><span className="text-[10px] text-gray-500">Stok Değeri</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{totalStockValue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL</p>
          <p className="text-[10px] text-gray-400">toplam stok x fiyat</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><Layers className="h-4 w-4 text-violet-500" /><span className="text-[10px] text-gray-500">Kategoriler</span></div>
          <p className="text-xl font-bold text-violet-600">{categories.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-[10px] text-gray-500">Tükenen</span></div>
          <p className="text-xl font-bold text-red-600">{outOfStock.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-amber-500" /><span className="text-[10px] text-gray-500">Az Stok</span></div>
          <p className="text-xl font-bold text-amber-600">{lowStock.length}</p>
          <p className="text-[10px] text-gray-400">&lt;10 adet</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-1">
        {([
          { key: "all" as const, label: "Tüm Ürünler" },
          { key: "alerts" as const, label: `Stok Uyarıları (${outOfStock.length + lowStock.length})` },
          { key: "top" as const, label: "En Çok Satanlar" },
          { key: "categories" as const, label: "Kategoriler" },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveSection(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeSection === tab.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== STOK UYARILARI ==================== */}
      {activeSection === "alerts" && (
        <div className="space-y-4">
          {/* En Hızlı Tükenen */}
          {fastestDepleting.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" /> En Hızlı Tükenen Ürünler
              </h3>
              <div className="space-y-2">
                {fastestDepleting.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    {p.image ? <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><Image className="h-3 w-3 text-gray-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.dailySales}/gün satış · {p.stock} stok</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.runway < 7 ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" : p.runway < 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-emerald-100 text-emerald-700"}`}>
                      {p.runway} gün
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tükenen Ürünler */}
          {outOfStock.length > 0 && (
            <div className="card p-5 border-l-4 border-l-red-500">
              <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Tükenen Ürünler ({outOfStock.length})
              </h3>
              <div className="space-y-1.5">
                {outOfStock.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/10">
                    {p.image ? <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><Image className="h-3 w-3 text-gray-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.category} · {p.soldRecent > 0 ? `Son dönem ${p.soldRecent} satıldı` : "Satış yok"}</p>
                    </div>
                    <span className="text-xs font-medium text-red-600">{p.price.toLocaleString("tr-TR")} TL</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Az Stoklu Ürünler */}
          {lowStock.length > 0 && (
            <div className="card p-5 border-l-4 border-l-amber-500">
              <h3 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Az Stoklu Ürünler ({lowStock.length})
              </h3>
              <div className="space-y-1.5">
                {lowStock.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/10">
                    {p.image ? <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><Image className="h-3 w-3 text-gray-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.category}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-600">{p.stock} adet</span>
                    {p.runway > 0 && p.runway < 999 && (
                      <span className="text-[10px] text-gray-400">{p.runway} gün</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {outOfStock.length === 0 && lowStock.length === 0 && (
            <div className="card p-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Tüm ürünlerde yeterli stok mevcut.</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== EN ÇOK SATANLAR ==================== */}
      {activeSection === "top" && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> En Çok Satan Ürünler
            </h3>
            {topSellers.length > 0 ? (
              <div className="space-y-2">
                {topSellers.map((p, i) => {
                  const maxSold = topSellers[0].soldRecent || 1;
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                      <span className="text-sm font-bold text-gray-300 w-6 text-right">{i + 1}</span>
                      {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><Image className="h-4 w-4 text-gray-400" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(p.soldRecent / maxSold) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{p.soldRecent} adet</p>
                        <p className="text-[10px] text-emerald-600">{p.revenue.toLocaleString("tr-TR")} TL</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-xs text-gray-400 text-center py-4">Satış verisi yok</p>}
          </div>

          {/* Satış Hızı */}
          {fastestDepleting.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" /> Satış Hızı (Günlük)
              </h3>
              <div className="space-y-2">
                {[...products].filter(p => p.dailySales > 0).sort((a, b) => b.dailySales - a.dailySales).slice(0, 10).map((p, i) => {
                  const maxDaily = products.reduce((m, pr) => Math.max(m, pr.dailySales), 1);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500" style={{ width: `${(p.dailySales / maxDaily) * 100}%` }} />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-600 dark:text-slate-400 truncate mt-0.5">{p.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0 w-20">
                        <span className="text-xs font-bold text-orange-600">{p.dailySales}/gün</span>
                        <p className="text-[9px] text-gray-400">{p.runway < 999 ? `${p.runway}g kaldı` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== KATEGORİLER ==================== */}
      {activeSection === "categories" && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" /> Kategori Analizi
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left py-2 font-medium text-gray-500">Kategori</th>
                    <th className="text-right py-2 font-medium text-gray-500">Ürün</th>
                    <th className="text-right py-2 font-medium text-gray-500">Stok</th>
                    <th className="text-right py-2 font-medium text-gray-500">Satılan</th>
                    <th className="text-right py-2 font-medium text-gray-500">Ciro</th>
                    <th className="py-2 px-4 font-medium text-gray-500 w-40"></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(([cat, data]) => (
                    <tr key={cat} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 font-medium text-gray-900 dark:text-white">{cat}</td>
                      <td className="py-2.5 text-right text-gray-600">{data.count}</td>
                      <td className="py-2.5 text-right text-gray-600">{data.stock.toLocaleString("tr-TR")}</td>
                      <td className="py-2.5 text-right text-gray-600">{data.sold}</td>
                      <td className="py-2.5 text-right font-medium text-emerald-600">{data.revenue.toLocaleString("tr-TR")} TL</td>
                      <td className="py-2.5 px-4">
                        <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${maxCatRevenue > 0 ? (data.revenue / maxCatRevenue) * 100 : 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kategori Dağılımı - Stok */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Ciro Dağılımı</h3>
              <div className="space-y-2">
                {categories.filter(([, d]) => d.revenue > 0).map(([cat, data]) => {
                  const totalRev = categories.reduce((s, [, d]) => s + d.revenue, 0);
                  const pct = totalRev > 0 ? Math.round((data.revenue / totalRev) * 100) : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-28 truncate">{cat}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 dark:text-slate-300 w-8 text-right">%{pct}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Stok Dağılımı</h3>
              <div className="space-y-2">
                {categories.map(([cat, data]) => {
                  const totalStock = categories.reduce((s, [, d]) => s + d.stock, 0);
                  const pct = totalStock > 0 ? Math.round((data.stock / totalStock) * 100) : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-28 truncate">{cat}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 dark:text-slate-300 w-8 text-right">%{pct}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TÜM ÜRÜNLER ==================== */}
      {activeSection === "all" && (
        <>
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün veya SKU ara..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
              {[
                { key: "all", label: `Tümü (${products.length})` },
                { key: "active", label: "Aktif" },
                { key: "low_stock", label: `Az Stok (${lowStock.length})` },
                { key: "out_of_stock", label: `Tükenen (${outOfStock.length})` },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${statusFilter === f.key ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop: Product Table */}
          <div className="hidden lg:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <SortHeader label="Ürün" field="name" className="text-left" />
                    <th className="text-left py-3 px-4 font-medium text-gray-500">SKU</th>
                    <SortHeader label="Fiyat" field="price" className="text-right" />
                    <SortHeader label="Stok" field="stock" className="text-right" />
                    <SortHeader label="Haftalık Ciro" field="revenue" className="text-right" />
                    <SortHeader label="Runway" field="runway" className="text-right" />
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <>
                      <tr key={p.id} className={`border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${expandedProduct === p.id ? "bg-blue-50 dark:bg-blue-950/10" : ""}`}
                        onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center"><Image className="h-4 w-4 text-gray-400" /></div>}
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white truncate max-w-[250px]">{p.name}</p>
                              <p className="text-[10px] text-gray-400">{p.category} · {p.variantCount} varyant</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-[10px]">{p.sku}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium text-gray-900 dark:text-white">{p.price.toLocaleString("tr-TR")} TL</span>
                          {p.comparePrice > 0 && <span className="text-[10px] text-gray-400 line-through ml-1">{p.comparePrice.toLocaleString("tr-TR")}</span>}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${p.stock === 0 ? "text-red-600" : p.stock < 10 ? "text-amber-600" : "text-gray-900 dark:text-white"}`}>{p.stock}</td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600">{p.revenue > 0 ? `${p.revenue.toLocaleString("tr-TR")} TL` : "-"}</td>
                        <td className="py-3 px-4 text-right">
                          {p.runway === 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">Tükendi</span>
                          ) : p.runway < 7 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">{p.runway} gün</span>
                          ) : p.runway < 30 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">{p.runway} gün</span>
                          ) : p.runway >= 999 ? (
                            <span className="text-[10px] text-gray-400">-</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">{p.runway} gün</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusMap[p.status]?.color || ""}`}>{statusMap[p.status]?.label || p.status}</span></td>
                      </tr>
                      {/* Expanded: Variant Details */}
                      {expandedProduct === p.id && (
                        <tr key={`${p.id}-expand`}>
                          <td colSpan={7} className="p-0">
                            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Varyant Stok Tablosu */}
                                <div>
                                  <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Varyant Bazlı Stok</h4>
                                  <div className="space-y-1">
                                    {p.variants.map(v => {
                                      const variantLabel = v.title !== "Default Title" ? v.title : `${v.option1 || ""} ${v.option2 || ""} ${v.option3 || ""}`.trim() || "Standart";
                                      const maxVStock = Math.max(...p.variants.map(vv => vv.inventory_quantity), 1);
                                      return (
                                        <div key={v.id} className="flex items-center gap-2">
                                          <span className="text-[10px] text-gray-600 dark:text-slate-400 w-32 truncate">{variantLabel}</span>
                                          <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${v.inventory_quantity === 0 ? "bg-red-400" : v.inventory_quantity < 5 ? "bg-amber-400" : "bg-emerald-400"}`}
                                              style={{ width: `${maxVStock > 0 ? Math.max(2, (v.inventory_quantity / maxVStock) * 100) : 0}%` }} />
                                          </div>
                                          <span className={`text-[10px] font-medium w-8 text-right ${v.inventory_quantity === 0 ? "text-red-600" : v.inventory_quantity < 5 ? "text-amber-600" : "text-gray-700 dark:text-slate-300"}`}>
                                            {v.inventory_quantity}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                {/* Özet Bilgiler */}
                                <div>
                                  <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Özet</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800">
                                      <p className="text-[10px] text-gray-400">Toplam Stok</p>
                                      <p className="text-sm font-bold text-gray-900 dark:text-white">{p.stock}</p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800">
                                      <p className="text-[10px] text-gray-400">Varyant Sayısı</p>
                                      <p className="text-sm font-bold text-gray-900 dark:text-white">{p.variantCount}</p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800">
                                      <p className="text-[10px] text-gray-400">Son Dönem Satış</p>
                                      <p className="text-sm font-bold text-violet-600">{p.soldRecent} adet</p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800">
                                      <p className="text-[10px] text-gray-400">Stok Değeri</p>
                                      <p className="text-sm font-bold text-gray-900 dark:text-white">{(p.stock * p.price).toLocaleString("tr-TR")} TL</p>
                                    </div>
                                    {p.variants.filter(v => v.inventory_quantity === 0).length > 0 && (
                                      <div className="col-span-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/10">
                                        <p className="text-[10px] text-red-600 font-medium">Tükenen Varyantlar</p>
                                        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                                          {p.variants.filter(v => v.inventory_quantity === 0).map(v => {
                                            const label = v.title !== "Default Title" ? v.title : `${v.option1 || ""} ${v.option2 || ""}`.trim();
                                            return label;
                                          }).join(", ")}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: Product Cards */}
          <div className="lg:hidden space-y-2">
            {sorted.map(p => (
              <div key={p.id} className="card overflow-hidden">
                <div className="p-3 cursor-pointer" onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                  <div className="flex items-center gap-3">
                    {p.image ? <img src={p.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" /> : <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0"><Image className="h-5 w-5 text-gray-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${statusMap[p.status]?.color || ""}`}>{statusMap[p.status]?.label || p.status}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{p.category} · {p.variantCount} varyant</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{p.price.toLocaleString("tr-TR")} TL</span>
                        <span className={`text-xs font-medium ${p.stock === 0 ? "text-red-600" : p.stock < 10 ? "text-amber-600" : "text-gray-500"}`}>Stok: {p.stock}</span>
                        {p.revenue > 0 && <span className="text-[10px] text-emerald-600">{p.revenue.toLocaleString("tr-TR")} TL/hafta</span>}
                        {p.runway > 0 && p.runway < 999 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.runway < 7 ? "bg-red-100 text-red-700" : p.runway < 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {p.runway}g
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Mobile Expand */}
                {expandedProduct === p.id && (
                  <div className="px-3 pb-3 border-t border-gray-100 dark:border-slate-800 pt-3">
                    <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Varyant Stok</h4>
                    <div className="space-y-1.5">
                      {p.variants.map(v => {
                        const variantLabel = v.title !== "Default Title" ? v.title : `${v.option1 || ""} ${v.option2 || ""} ${v.option3 || ""}`.trim() || "Standart";
                        return (
                          <div key={v.id} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800">
                            <span className="text-[10px] text-gray-600 dark:text-slate-400">{variantLabel}</span>
                            <span className={`text-[10px] font-bold ${v.inventory_quantity === 0 ? "text-red-600" : v.inventory_quantity < 5 ? "text-amber-600" : "text-gray-700 dark:text-slate-300"}`}>
                              {v.inventory_quantity} adet
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-center">
                        <p className="text-[9px] text-gray-400">Satış</p>
                        <p className="text-xs font-bold text-violet-600">{p.soldRecent} adet</p>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-center">
                        <p className="text-[9px] text-gray-400">Stok Değeri</p>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{(p.stock * p.price).toLocaleString("tr-TR")} TL</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
