"use client";

import { useState, useEffect } from "react";
import { Save, Package, Truck, CreditCard, Building2, Megaphone, Calculator } from "lucide-react";

export default function CostsTab() {
  // COGS
  const [cogsMethod, setCogsMethod] = useState<"percent" | "fixed">("percent");
  const [cogsPercent, setCogsPercent] = useState("40");
  const [cogsFixed, setCogsFixed] = useState("0");

  // Kargo
  const [shippingMethod, setShippingMethod] = useState<"manual" | "shopify">("manual");
  const [shippingPerOrder, setShippingPerOrder] = useState("45");

  // Komisyonlar
  const [platformCommission, setPlatformCommission] = useState("2.0");
  const [paymentCommission, setPaymentCommission] = useState("2.49");

  // Sabit giderler
  const [fixedCosts, setFixedCosts] = useState([
    { label: "Personel Maaşları", value: "52000" },
    { label: "Kira & Depo", value: "15000" },
    { label: "Yazılım & Abonelikler", value: "4500" },
    { label: "Muhasebe & Hukuk", value: "3500" },
    { label: "Diğer Giderler", value: "8500" },
  ]);

  // Reklam
  const [adSpends, setAdSpends] = useState([
    { label: "Google Ads", value: "18000" },
    { label: "TikTok Ads", value: "5000" },
    { label: "Influencer", value: "12000" },
  ]);

  // Shopify ciro
  const [revenue, setRevenue] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [metaSpend, setMetaSpend] = useState(0);

  // Load saved data + fetch Shopify
  useEffect(() => {
    const saved = localStorage.getItem("repliq-costs");
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.cogsMethod) setCogsMethod(d.cogsMethod);
        if (d.cogsPercent) setCogsPercent(d.cogsPercent);
        if (d.cogsFixed) setCogsFixed(d.cogsFixed);
        if (d.shippingMethod) setShippingMethod(d.shippingMethod);
        if (d.shippingPerOrder) setShippingPerOrder(d.shippingPerOrder);
        if (d.platformCommission) setPlatformCommission(d.platformCommission);
        if (d.paymentCommission) setPaymentCommission(d.paymentCommission);
        if (d.fixedCosts) setFixedCosts(d.fixedCosts);
        if (d.adSpends) setAdSpends(d.adSpends);
      } catch {}
    }

    // Fetch Shopify revenue
    fetch("/api/shopify?action=orders&limit=250").then(r => r.json()).then(data => {
      const orders = data.orders || [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonth = orders.filter((o: any) => new Date(o.created_at) >= monthStart);
      setRevenue(thisMonth.reduce((s: number, o: any) => s + parseFloat(o.total_price || "0"), 0));
      setOrderCount(thisMonth.length);
    }).catch(() => {});

    // Fetch Meta spend
    fetch("/api/shopify?action=meta-ads&date_preset=this_month").then(r => r.json()).then(data => {
      if (data.spend) setMetaSpend(data.spend);
    }).catch(() => {});
  }, []);

  const handleSave = () => {
    const data = { cogsMethod, cogsPercent, cogsFixed, shippingMethod, shippingPerOrder, platformCommission, paymentCommission, fixedCosts, adSpends };
    localStorage.setItem("repliq-costs", JSON.stringify(data));
    alert("Maliyetler kaydedildi!");
  };

  // Hesaplamalar
  const cogsAmount = cogsMethod === "percent" ? revenue * (parseFloat(cogsPercent) || 0) / 100 : parseFloat(cogsFixed) || 0;

  const shippingAmount = shippingMethod === "manual" ? orderCount * (parseFloat(shippingPerOrder) || 0) : 0;
  const commissionAmount = revenue * ((parseFloat(platformCommission) || 0) + (parseFloat(paymentCommission) || 0)) / 100;
  const fixedTotal = fixedCosts.reduce((s, c) => s + (parseFloat(c.value) || 0), 0);
  const totalAdSpend = adSpends.reduce((s, a) => s + (parseFloat(a.value) || 0), 0) + metaSpend;
  const grossProfit = revenue - cogsAmount;
  const totalCosts = cogsAmount + shippingAmount + commissionAmount + fixedTotal + totalAdSpend;
  const netProfit = revenue - totalCosts;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* P&L Özet - Canlı Hesaplama */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-white/60" />
              <h3 className="text-sm font-semibold text-white/80">Kâr & Zarar Tablosu</h3>
            </div>
            <span className="text-[10px] text-white/40">Bu ay · Shopify canlı ciro · Otomatik hesaplama</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-white/10">
              <p className="text-[10px] text-white/50">Brüt Gelir</p>
              <p className="text-lg font-bold text-white">{Math.round(revenue).toLocaleString("tr-TR")} TL</p>
              <p className="text-[9px] text-white/30">{orderCount} sipariş</p>
            </div>
            <div className="p-3 rounded-xl bg-white/10">
              <p className="text-[10px] text-white/50">COGS</p>
              <p className="text-lg font-bold text-red-400">-{Math.round(cogsAmount).toLocaleString("tr-TR")} TL</p>
              <p className="text-[9px] text-white/30">{cogsMethod === "percent" ? `%${cogsPercent}` : cogsMethod === "fixed" ? "sabit" : "ürün bazlı"}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/10">
              <p className="text-[10px] text-white/50">Brüt Kâr</p>
              <p className={`text-lg font-bold ${grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{Math.round(grossProfit).toLocaleString("tr-TR")} TL</p>
              <p className="text-[9px] text-white/30">%{revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0} marj</p>
            </div>
            <div className="p-3 rounded-xl bg-white/10">
              <p className="text-[10px] text-white/50">Reklam</p>
              <p className="text-lg font-bold text-amber-400">-{Math.round(totalAdSpend).toLocaleString("tr-TR")} TL</p>
            </div>
            <div className="p-3 rounded-xl bg-white/10">
              <p className="text-[10px] text-white/50">Giderler</p>
              <p className="text-lg font-bold text-orange-400">-{Math.round(fixedTotal + shippingAmount + commissionAmount).toLocaleString("tr-TR")} TL</p>
            </div>
            <div className={`p-3 rounded-xl ${netProfit >= 0 ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-red-500/20 border border-red-500/30"}`}>
              <p className={`text-[10px] ${netProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>Net Kâr</p>
              <p className={`text-lg font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{Math.round(netProfit).toLocaleString("tr-TR")} TL</p>
              <p className={`text-[9px] ${netProfit >= 0 ? "text-emerald-300/60" : "text-red-300/60"}`}>%{netMargin.toFixed(1)} marj</p>
            </div>
          </div>
        </div>
      </div>

      {/* COGS */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><Package className="h-5 w-5 text-red-500" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Ürün Maliyeti (COGS)</h3>
            <p className="text-xs text-gray-500">Hammadde, üretim, fason, paketleme, etiket dahil</p>
          </div>
          <span className="ml-auto text-sm font-bold text-red-600">{Math.round(cogsAmount).toLocaleString("tr-TR")} TL</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <label onClick={() => setCogsMethod("percent")} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${cogsMethod === "percent" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-gray-200 dark:border-slate-700 hover:border-blue-300"}`}>
            <input type="radio" checked={cogsMethod === "percent"} onChange={() => setCogsMethod("percent")} className="mt-1 accent-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Yüzdesel Oran</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Tüm siparişlere sabit % uygula</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">%</span>
                <input value={cogsPercent} onChange={e => setCogsPercent(e.target.value)} className="w-16 px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-center font-mono font-bold focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </label>
          <label onClick={() => setCogsMethod("fixed")} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${cogsMethod === "fixed" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-gray-200 dark:border-slate-700 hover:border-blue-300"}`}>
            <input type="radio" checked={cogsMethod === "fixed"} onChange={() => setCogsMethod("fixed")} className="mt-1 accent-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Sabit Tutar</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Aylık toplam COGS</p>
              <div className="flex items-center gap-2 mt-2">
                <input value={cogsFixed} onChange={e => setCogsFixed(e.target.value)} className="w-24 px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-right font-mono focus:ring-2 focus:ring-blue-500" />
                <span className="text-[10px] text-gray-400">TL</span>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Kargo */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Truck className="h-5 w-5 text-blue-500" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Kargo Maliyeti</h3>
            <p className="text-xs text-gray-500">Bu ay {orderCount} sipariş</p>
          </div>
          <span className="ml-auto text-sm font-bold text-blue-600">{Math.round(shippingAmount).toLocaleString("tr-TR")} TL</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label onClick={() => setShippingMethod("manual")} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${shippingMethod === "manual" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-gray-200 dark:border-slate-700"}`}>
            <input type="radio" checked={shippingMethod === "manual"} onChange={() => setShippingMethod("manual")} className="mt-1 accent-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Manuel Tutar</p>
              <p className="text-[10px] text-gray-500">Sipariş başına ortalama</p>
              <div className="flex items-center gap-2 mt-2">
                <input value={shippingPerOrder} onChange={e => setShippingPerOrder(e.target.value)} className="w-20 px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-right font-mono focus:ring-2 focus:ring-blue-500" />
                <span className="text-[10px] text-gray-400">TL / sipariş</span>
              </div>
            </div>
          </label>
          <label onClick={() => setShippingMethod("shopify")} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${shippingMethod === "shopify" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-gray-200 dark:border-slate-700"}`}>
            <input type="radio" checked={shippingMethod === "shopify"} onChange={() => setShippingMethod("shopify")} className="mt-1 accent-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Shopify'dan Çek</p>
              <p className="text-[10px] text-gray-500">Otomatik kargo ücretini al</p>
              <div className="flex items-center gap-1.5 mt-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium">Shopify bağlı</span></div>
            </div>
          </label>
        </div>
      </div>

      {/* Komisyonlar */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><CreditCard className="h-5 w-5 text-violet-500" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Komisyonlar</h3>
            <p className="text-xs text-gray-500">Ciro üzerinden kesilen oranlar</p>
          </div>
          <span className="ml-auto text-sm font-bold text-violet-600">{Math.round(commissionAmount).toLocaleString("tr-TR")} TL</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-800">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">E-ticaret Platformu</p>
              <p className="text-[10px] text-gray-400">Shopify, ikas, Ticimax vb.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">%</span>
              <input value={platformCommission} onChange={e => setPlatformCommission(e.target.value)} className="w-20 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-sm text-center font-mono focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-800">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Ödeme Altyapısı</p>
              <p className="text-[10px] text-gray-400">iyzico, PayTR, Stripe vb.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">%</span>
              <input value={paymentCommission} onChange={e => setPaymentCommission(e.target.value)} className="w-20 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-sm text-center font-mono focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Sabit Giderler */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"><Building2 className="h-5 w-5 text-amber-500" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sabit Giderler</h3>
            <p className="text-xs text-gray-500">Aylık operasyon maliyetleri</p>
          </div>
          <span className="ml-auto text-sm font-bold text-amber-600">{Math.round(fixedTotal).toLocaleString("tr-TR")} TL</span>
        </div>
        <div className="space-y-2">
          {fixedCosts.map((c, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
              <input value={c.label} onChange={e => { const arr = [...fixedCosts]; arr[i].label = e.target.value; setFixedCosts(arr); }}
                className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-300 border-0 focus:ring-0 p-0" />
              <div className="flex items-center gap-1.5">
                <input value={c.value} onChange={e => { const arr = [...fixedCosts]; arr[i].value = e.target.value; setFixedCosts(arr); }}
                  className="w-24 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-sm text-right font-mono focus:ring-2 focus:ring-amber-500" />
                <span className="text-xs text-gray-400">TL</span>
              </div>
            </div>
          ))}
          <button onClick={() => setFixedCosts([...fixedCosts, { label: "Yeni Kalem", value: "0" }])}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 ml-1">+ Yeni kalem ekle</button>
        </div>
      </div>

      {/* Reklam */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center"><Megaphone className="h-5 w-5 text-pink-500" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reklam Harcaması</h3>
            <p className="text-xs text-gray-500">Bağlı hesaplardan otomatik + manuel giriş</p>
          </div>
          <span className="ml-auto text-sm font-bold text-pink-600">{Math.round(totalAdSpend).toLocaleString("tr-TR")} TL</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Meta Ads</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-600 rounded-full">{metaSpend > 0 ? "Otomatik" : "Bağla"}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{metaSpend > 0 ? Math.round(metaSpend).toLocaleString("tr-TR") + " TL" : "- TL"}</p>
          </div>
          <div className="space-y-2">
            {adSpends.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                <input value={a.label} onChange={e => { const arr = [...adSpends]; arr[i].label = e.target.value; setAdSpends(arr); }}
                  className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-300 border-0 focus:ring-0 p-0" />
                <div className="flex items-center gap-1">
                  <input value={a.value} onChange={e => { const arr = [...adSpends]; arr[i].value = e.target.value; setAdSpends(arr); }}
                    className="w-20 px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-xs text-right font-mono focus:ring-2 focus:ring-pink-500" />
                  <span className="text-[9px] text-gray-400">TL</span>
                </div>
              </div>
            ))}
            <button onClick={() => setAdSpends([...adSpends, { label: "Yeni Kanal", value: "0" }])}
              className="text-[10px] text-blue-600 font-medium ml-1">+ Ekle</button>
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
        <Save className="h-4 w-4" /> Maliyetleri Kaydet
      </button>
    </div>
  );
}
