import { NextRequest, NextResponse } from "next/server";

type StoreKey = "tr" | "ww";

const STORES: Record<StoreKey, { domain: string; token: string }> = {
  tr: {
    domain: process.env.SHOPIFY_TR_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN || "2a4c1b-c4.myshopify.com",
    token: process.env.SHOPIFY_TR_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || "",
  },
  ww: {
    domain: process.env.SHOPIFY_WW_DOMAIN || "bt0wj0-5j.myshopify.com",
    token: process.env.SHOPIFY_WW_TOKEN || "",
  },
};

// Backward-compat: TR is the default single-store for legacy actions (products, orders, analytics etc.)
const SHOPIFY_DOMAIN = STORES.tr.domain;
const SHOPIFY_TOKEN = STORES.tr.token;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "act_1204565511444286";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const API_VERSION = "2024-01";

async function shopifyFetchOn(store: StoreKey, endpoint: string) {
  const { domain, token } = STORES[store];
  if (!token) throw new Error(`Shopify ${store.toUpperCase()} token missing`);
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/${endpoint}`,
    {
      headers: { "X-Shopify-Access-Token": token },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) throw new Error(`Shopify ${store} API error: ${res.status}`);
  return res.json();
}

// Legacy helper — queries TR only (kept for all non-customer-order actions)
async function shopifyFetch(endpoint: string) {
  return shopifyFetchOn("tr", endpoint);
}

async function shopifyFetchWithLink(endpoint: string): Promise<{ data: any; nextUrl: string | null }> {
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/${endpoint}`,
    {
      headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  const data = await res.json();
  // Parse Link header for cursor-based pagination
  const linkHeader = res.headers.get("link") || "";
  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  let nextUrl: string | null = null;
  if (nextMatch) {
    // Extract just the endpoint part from the full URL
    const fullUrl = nextMatch[1];
    const urlObj = new URL(fullUrl);
    nextUrl = urlObj.pathname.replace(`/admin/api/${API_VERSION}/`, "") + urlObj.search;
  }
  return { data, nextUrl };
}

// Query a single store for orders matching the given identifiers.
// Returns flat orders array tagged with { store }.
async function findOrdersInStore(
  store: StoreKey,
  ident: { emails: string[]; names: string[]; phones: string[]; orderNumbers: string[] },
): Promise<any[]> {
  if (!STORES[store].token) return []; // store not configured

  const out: any[] = [];
  const seen = new Set<number>();
  const push = (arr: any[]) => {
    for (const o of arr || []) {
      if (!o?.id || seen.has(o.id)) continue;
      seen.add(o.id);
      out.push({ ...o, store });
    }
  };

  // 1) direct order number (e.g. "#1234")
  for (const num of ident.orderNumbers) {
    try {
      const name = num.startsWith("#") ? num : `#${num}`;
      const d = await shopifyFetchOn(store, `orders.json?name=${encodeURIComponent(name)}&status=any&limit=5`);
      push(d.orders);
    } catch { /* noop */ }
  }

  // 2) email
  for (const email of ident.emails) {
    try {
      const d = await shopifyFetchOn(store, `orders.json?email=${encodeURIComponent(email)}&status=any&limit=10`);
      push(d.orders);
    } catch { /* noop */ }
  }

  // 3) name → customers/search → that customer's orders
  for (const name of ident.names) {
    if (out.length >= 10) break;
    try {
      const clean = name.trim();
      if (clean.length < 3) continue;
      const sd = await shopifyFetchOn(store, `customers/search.json?query=${encodeURIComponent(clean)}&limit=5`);
      const customers = sd.customers || [];
      for (const c of customers.slice(0, 3)) {
        try {
          const od = await shopifyFetchOn(store, `customers/${c.id}/orders.json?status=any&limit=10`);
          push(od.orders);
        } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }

  // 4) phone
  for (const phone of ident.phones) {
    if (out.length >= 10) break;
    try {
      const sd = await shopifyFetchOn(store, `customers/search.json?query=phone:${encodeURIComponent(phone)}&limit=3`);
      const customers = sd.customers || [];
      for (const c of customers.slice(0, 2)) {
        try {
          const od = await shopifyFetchOn(store, `customers/${c.id}/orders.json?status=any&limit=10`);
          push(od.orders);
        } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }

  return out;
}

function splitCSV(v: string | null): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "stats") {
      const [products, orders, shop] = await Promise.all([
        shopifyFetch("products/count.json"),
        shopifyFetch("orders/count.json?status=any"),
        shopifyFetch("shop.json"),
      ]);
      return NextResponse.json({
        shop: shop.shop,
        productsCount: products.count,
        ordersCount: orders.count,
      });
    }

    if (action === "products") {
      const limit = parseInt(searchParams.get("limit") || "250");
      let allProducts: any[] = [];
      let url = `products.json?limit=250&status=active`;

      // Paginate through all products
      while (url && allProducts.length < limit) {
        const data = await shopifyFetch(url);
        allProducts = allProducts.concat(data.products || []);

        // Check for next page via Link header or page_info
        if (data.products?.length === 250) {
          const lastId = data.products[data.products.length - 1].id;
          url = `products.json?limit=250&status=active&since_id=${lastId}`;
        } else {
          break;
        }
      }

      return NextResponse.json({ products: allProducts.slice(0, limit) });
    }

    if (action === "orders") {
      const limit = searchParams.get("limit") || "20";
      const status = searchParams.get("status") || "any";
      const createdAtMin = searchParams.get("created_at_min") || "";
      let url = `orders.json?limit=${limit}&status=${status}&order=created_at+desc`;
      if (createdAtMin) url += `&created_at_min=${createdAtMin}`;
      const data = await shopifyFetch(url);
      return NextResponse.json(data);
    }

    if (action === "order") {
      const orderId = searchParams.get("id");
      if (!orderId) return NextResponse.json({ error: "id required" }, { status: 400 });
      const data = await shopifyFetch(`orders/${orderId}.json`);
      return NextResponse.json(data);
    }

    if (action === "customer-orders") {
      // Support both single-value (email/name/phone) and CSV multi-value (emails/names/phones/order_numbers)
      const emails = [
        ...splitCSV(searchParams.get("emails")),
        ...(searchParams.get("email") ? [searchParams.get("email")!] : []),
      ].filter(Boolean);
      const names = [
        ...splitCSV(searchParams.get("names")),
        ...(searchParams.get("name") ? [searchParams.get("name")!] : []),
      ].filter(Boolean);
      const phones = [
        ...splitCSV(searchParams.get("phones")),
        ...(searchParams.get("phone") ? [searchParams.get("phone")!] : []),
      ].filter(Boolean);
      const orderNumbers = [
        ...splitCSV(searchParams.get("order_numbers")),
        ...(searchParams.get("order_number") ? [searchParams.get("order_number")!] : []),
      ].filter(Boolean);

      const ident = { emails, names, phones, orderNumbers };

      // Query TR + WW in parallel, merge and sort by date desc
      const [trOrders, wwOrders] = await Promise.all([
        findOrdersInStore("tr", ident).catch(() => []),
        findOrdersInStore("ww", ident).catch(() => []),
      ]);

      const merged = [...trOrders, ...wwOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return NextResponse.json({ orders: merged });
    }

    if (action === "refunds") {
      // Fetch all refunded orders with full refund details via Link-based pagination
      let allOrders: any[] = [];
      let url: string | null = "orders.json?limit=250&status=any&financial_status=refunded,partially_refunded&fields=id,name,created_at,total_price,financial_status,refunds,line_items,customer,email";
      for (let page = 0; page < 10 && url; page++) {
        const { data, nextUrl } = await shopifyFetchWithLink(url);
        allOrders = allOrders.concat(data.orders || []);
        url = nextUrl;
      }
      return NextResponse.json({ orders: allOrders });
    }

    if (action === "meta-ads") {
      const datePreset = searchParams.get("date_preset") || "last_7d";
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas,cost_per_action_type&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`,
        { next: { revalidate: 600 } }
      );
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

      const insights = data.data?.[0] || {};
      const actions = insights.actions || [];
      const actionValues = insights.action_values || [];
      const purchases = actions.find((a: any) => a.action_type === "purchase")?.value || 0;
      const addToCart = actions.find((a: any) => a.action_type === "add_to_cart")?.value || 0;
      const viewContent = actions.find((a: any) => a.action_type === "view_content")?.value || 0;
      const initiateCheckout = actions.find((a: any) => a.action_type === "initiate_checkout")?.value || 0;
      const linkClicks = actions.find((a: any) => a.action_type === "link_click")?.value || 0;
      const videoViews = actions.find((a: any) => a.action_type === "video_view")?.value || 0;
      const postEngagement = actions.find((a: any) => a.action_type === "post_engagement")?.value || 0;
      const messaging = actions.find((a: any) => a.action_type === "onsite_conversion.messaging_first_reply")?.value || 0;
      const purchaseValue = actionValues.find((a: any) => a.action_type === "purchase")?.value || 0;
      const roas = insights.purchase_roas?.[0]?.value || 0;
      const costPerPurchase = (insights.cost_per_action_type || []).find((a: any) => a.action_type === "purchase")?.value || 0;

      return NextResponse.json({
        spend: parseFloat(insights.spend || "0"),
        impressions: parseInt(insights.impressions || "0"),
        clicks: parseInt(insights.clicks || "0"),
        ctr: parseFloat(insights.ctr || "0"),
        cpc: parseFloat(insights.cpc || "0"),
        purchases: parseInt(purchases),
        purchaseValue: parseFloat(purchaseValue),
        roas: parseFloat(roas),
        costPerPurchase: parseFloat(costPerPurchase),
        addToCart: parseInt(addToCart),
        viewContent: parseInt(viewContent),
        initiateCheckout: parseInt(initiateCheckout),
        linkClicks: parseInt(linkClicks),
        videoViews: parseInt(videoViews),
        postEngagement: parseInt(postEngagement),
        messaging: parseInt(messaging),
        dateStart: insights.date_start,
        dateEnd: insights.date_stop,
      });
    }

    if (action === "meta-ads-daily") {
      const datePreset = searchParams.get("date_preset") || "last_7d";
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/insights?fields=spend,impressions,clicks,actions&date_preset=${datePreset}&time_increment=1&access_token=${META_ACCESS_TOKEN}`,
        { next: { revalidate: 600 } }
      );
      const data = await res.json();
      return NextResponse.json({ data: data.data || [] });
    }

    if (action === "meta-campaigns") {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/campaigns?fields=name,status,objective,daily_budget,lifetime_budget,insights{spend,impressions,clicks,actions}&limit=10&access_token=${META_ACCESS_TOKEN}`,
        { next: { revalidate: 600 } }
      );
      const data = await res.json();
      return NextResponse.json({ campaigns: data.data || [] });
    }

    if (action === "analytics") {
      const days = parseInt(searchParams.get("days") || "30");
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - days);
      const prevStart = new Date(periodStart);
      prevStart.setDate(prevStart.getDate() - days);

      // Fetch orders, customers, and abandoned checkouts in parallel
      const fetchAllOrders = async (since: Date, until: Date) => {
        let all: any[] = [];
        const sinceISO = encodeURIComponent(since.toISOString());
        const untilISO = encodeURIComponent(until.toISOString());
        let url: string | null = `orders.json?limit=250&status=any&created_at_min=${sinceISO}&created_at_max=${untilISO}&fields=id,name,created_at,referring_site,landing_site,total_price,customer`;
        for (let page = 0; page < 20 && url; page++) {
          const { data, nextUrl } = await shopifyFetchWithLink(url);
          const batch = data.orders || [];
          all = all.concat(batch);
          url = nextUrl;
        }
        return all;
      };

      const fetchAllCheckouts = async (since: Date) => {
        let all: any[] = [];
        const sinceISO = encodeURIComponent(since.toISOString());
        let url: string | null = `checkouts.json?limit=250&created_at_min=${sinceISO}`;
        for (let page = 0; page < 10 && url; page++) {
          try {
            const { data, nextUrl } = await shopifyFetchWithLink(url);
            const batch = data.checkouts || [];
            all = all.concat(batch);
            url = nextUrl;
          } catch { break; }
        }
        return all;
      };

      // For current period, don't use created_at_max to avoid timezone edge cases
      const fetchCurrentOrders = async (since: Date) => {
        let all: any[] = [];
        const sinceISO = encodeURIComponent(since.toISOString());
        let url: string | null = `orders.json?limit=250&status=any&created_at_min=${sinceISO}&fields=id,name,created_at,referring_site,landing_site,total_price,customer`;
        for (let page = 0; page < 20 && url; page++) {
          const { data, nextUrl } = await shopifyFetchWithLink(url);
          const batch = data.orders || [];
          all = all.concat(batch);
          url = nextUrl;
        }
        return all;
      };

      const [currentOrders, prevOrders, abandonedCheckouts, newCustomers] = await Promise.all([
        fetchCurrentOrders(periodStart),
        fetchAllOrders(prevStart, periodStart),
        fetchAllCheckouts(periodStart),
        shopifyFetch(`customers/count.json?created_at_min=${encodeURIComponent(periodStart.toISOString())}`).catch(() => ({ count: 0 })),
      ]);

      const pctChange = (cur: number, prv: number) => {
        if (prv === 0) return cur > 0 ? "+100%" : "0%";
        const change = ((cur - prv) / prv) * 100;
        return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
      };

      // Unique customers (by email) = visitors proxy
      const uniqueEmails = new Set(currentOrders.map((o: any) => o.customer?.email || o.email).filter(Boolean));
      const prevUniqueEmails = new Set(prevOrders.map((o: any) => o.customer?.email || o.email).filter(Boolean));

      // Traffic sources from referring_site
      const sourceMap: Record<string, number> = {};
      currentOrders.forEach((o: any) => {
        const ref = (o.referring_site || "").toLowerCase();
        let source = "Direkt";
        if (ref.includes("instagram")) source = "Instagram";
        else if (ref.includes("facebook") || ref.includes("fb.")) source = "Facebook";
        else if (ref.includes("google")) source = "Google";
        else if (ref.includes("tiktok")) source = "TikTok";
        else if (ref.includes("twitter") || ref.includes("x.com")) source = "Twitter";
        else if (ref.includes("youtube")) source = "YouTube";
        else if (ref.includes("pinterest")) source = "Pinterest";
        else if (ref) source = "Diğer";
        sourceMap[source] = (sourceMap[source] || 0) + 1;
      });

      const sourceColors: Record<string, string> = {
        "Instagram": "bg-pink-500", "Facebook": "bg-indigo-500",
        "Google": "bg-blue-500", "Direkt": "bg-emerald-500",
        "TikTok": "bg-gray-800", "Twitter": "bg-sky-500",
        "YouTube": "bg-red-500", "Pinterest": "bg-red-400", "Diğer": "bg-gray-400",
      };
      const totalSourceOrders = Object.values(sourceMap).reduce((a, b) => a + b, 0);
      const trafficSources = Object.entries(sourceMap)
        .sort(([, a], [, b]) => b - a)
        .map(([source, orders]) => ({
          source,
          visitors: orders,
          pct: totalSourceOrders > 0 ? Math.round((orders / totalSourceOrders) * 100) : 0,
          color: sourceColors[source] || "bg-gray-400",
        }));

      // Daily breakdown
      const dailyMap: Record<string, { orders: number; revenue: number }> = {};
      currentOrders.forEach((o: any) => {
        const day = o.created_at?.slice(0, 10);
        if (!day) return;
        if (!dailyMap[day]) dailyMap[day] = { orders: 0, revenue: 0 };
        dailyMap[day].orders++;
        dailyMap[day].revenue += parseFloat(o.total_price || "0");
      });
      const daily = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, data]) => ({ day, visitors: data.orders, sessions: data.orders, revenue: Math.round(data.revenue) }));

      // Conversion: orders / (orders + abandoned checkouts)
      const totalCheckouts = abandonedCheckouts.length + currentOrders.length;
      const conversionRate = totalCheckouts > 0
        ? Math.round(((currentOrders.length / totalCheckouts) * 100) * 100) / 100
        : 0;
      const prevTotalCheckouts = prevOrders.length; // simplified for prev
      const prevConversionRate = prevTotalCheckouts > 0 ? 100 : 0; // no abandoned data for prev

      return NextResponse.json({
        visitors: uniqueEmails.size,
        sessions: currentOrders.length + abandonedCheckouts.length,
        convertedSessions: currentOrders.length,
        conversionRate,
        visitorsChange: pctChange(uniqueEmails.size, prevUniqueEmails.size),
        sessionsChange: pctChange(currentOrders.length, prevOrders.length),
        conversionChange: pctChange(currentOrders.length, prevOrders.length),
        abandonedCheckouts: abandonedCheckouts.length,
        newCustomers: newCustomers.count || 0,
        daily,
        trafficSources,
        devices: [],
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, chat } = await req.json();

    // Smart chat mode - fetch real Shopify data based on question
    if (chat) {
      const question = chat.toLowerCase();

      // Fetch relevant data based on question content
      let context = "";

      // Fetch all recent orders (paginate through 250 at a time) and products
      let allOrders: any[] = [];
      let orderUrl = "orders.json?limit=250&status=any&order=created_at+desc";
      // Get up to 750 orders (3 pages) for comprehensive data
      for (let page = 0; page < 3; page++) {
        try {
          const batch = await shopifyFetch(orderUrl);
          const batchOrders = batch.orders || [];
          allOrders = allOrders.concat(batchOrders);
          if (batchOrders.length < 250) break;
          const lastId = batchOrders[batchOrders.length - 1].id;
          orderUrl = `orders.json?limit=250&status=any&order=created_at+desc&since_id=${lastId}`;
        } catch { break; }
      }

      const [productsData, statsData] = await Promise.all([
        shopifyFetch("products.json?limit=250&status=active").catch(() => ({ products: [] })),
        Promise.all([
          shopifyFetch("products/count.json").catch(() => ({ count: 0 })),
          shopifyFetch("orders/count.json?status=any").catch(() => ({ count: 0 })),
        ]),
      ]);

      const orders = allOrders;
      const products = productsData.products || [];

      // Product sales summary
      const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
      orders.forEach((o: any) => {
        o.line_items?.forEach((li: any) => {
          const key = li.title || li.product_id;
          if (!productSales[key]) productSales[key] = { name: li.title, qty: 0, revenue: 0 };
          productSales[key].qty += li.quantity;
          productSales[key].revenue += parseFloat(li.price) * li.quantity;
        });
      });
      const topSelling = Object.values(productSales).sort((a, b) => b.qty - a.qty);

      // Order stats
      const totalRevenue = orders.reduce((s: number, o: any) => s + parseFloat(o.total_price || "0"), 0);
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayOrders = orders.filter((o: any) => o.created_at?.slice(0, 10) === todayStr);
      const todayRevenue = todayOrders.reduce((s: number, o: any) => s + parseFloat(o.total_price || "0"), 0);
      const refunds = orders.filter((o: any) => o.financial_status === "refunded" || o.financial_status === "partially_refunded");
      const unfulfilled = orders.filter((o: any) => !o.fulfillment_status || o.fulfillment_status === "unfulfilled");

      // Stock info
      const outOfStock = products.filter((p: any) => p.variants?.every((v: any) => (v.inventory_quantity || 0) <= 0));
      const lowStock = products.filter((p: any) => p.variants?.some((v: any) => v.inventory_quantity > 0 && v.inventory_quantity < 10));

      context = `MAĞAZA: LessandRomance (kadın giyim)
GENEL: ${statsData[1].count} toplam sipariş, ${statsData[0].count} ürün.
BUGÜN: ${todayOrders.length} sipariş, ${todayRevenue.toLocaleString("tr-TR")} TL ciro.
SON SİPARİŞLER: ${orders.length} sipariş incelendi, ${Math.round(totalRevenue).toLocaleString("tr-TR")} TL toplam ciro.
BEKLEYENLEr: ${unfulfilled.length} sipariş kargoya verilmedi.
İADELER: ${refunds.length} iade/iptal.

EN ÇOK SATAN ÜRÜNLER (son siparişlerden):
${topSelling.slice(0, 15).map((p, i) => `${i + 1}. ${p.name}: ${p.qty} adet satıldı, ${Math.round(p.revenue).toLocaleString("tr-TR")} TL ciro`).join("\n")}

TÜKENEN ÜRÜNLER (${outOfStock.length}):
${outOfStock.slice(0, 10).map((p: any) => `- ${p.title}`).join("\n") || "Yok"}

AZ STOKLU (${lowStock.length}):
${lowStock.slice(0, 10).map((p: any) => `- ${p.title} (${p.variants?.[0]?.inventory_quantity || 0} adet)`).join("\n") || "Yok"}

SON 10 SİPARİŞ DETAYI:
${orders.slice(0, 10).map((o: any) => `${o.name}: ${parseFloat(o.total_price).toLocaleString("tr-TR")} TL - ${o.line_items?.map((l: any) => l.title + " x" + l.quantity).join(", ")} - ${o.financial_status} - ${o.fulfillment_status || "bekliyor"}`).join("\n")}`;

      // Meta Ads - direct Graph API call
      {
        const mToken = (process.env.META_ACCESS_TOKEN || META_ACCESS_TOKEN || "").trim();
        const mAccount = (process.env.META_AD_ACCOUNT_ID || META_AD_ACCOUNT || "").trim();
        try {
          const [metaWeeklyRaw, metaMonthlyRaw] = await Promise.all([
            fetch(`https://graph.facebook.com/v21.0/${mAccount}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas,cost_per_action_type&date_preset=last_7d&access_token=${mToken}`).then(r => r.json()).catch(() => null),
            fetch(`https://graph.facebook.com/v21.0/${mAccount}/insights?fields=spend,actions,action_values,purchase_roas&date_preset=last_30d&access_token=${mToken}`).then(r => r.json()).catch(() => null),
          ]);

          const mwRaw = metaWeeklyRaw?.data?.[0];
          const mmRaw = metaMonthlyRaw?.data?.[0];
          const ga = (arr: any[], t: string) => (arr || []).find((a: any) => a.action_type === t)?.value || 0;
          const gv = (arr: any[], t: string) => (arr || []).find((a: any) => a.action_type === t)?.value || 0;

          if (!mwRaw || mwRaw.error) {
            context += `\n\nMETA REKLAMLARI: Token süresi dolmuş veya bağlantı hatası. Kullanıcı Meta Ads Manager'dan güncel verileri kontrol etmeli. Detaylı reklam analizi için Ayarlar > Entegrasyonlar'dan Meta hesabını yeniden bağlaması gerekiyor.`;
          }
          if (mwRaw && parseFloat(mwRaw.spend || "0") > 0) {
            const mw = {
              spend: parseFloat(mwRaw.spend), impressions: parseInt(mwRaw.impressions || "0"),
              clicks: parseInt(mwRaw.clicks || "0"), ctr: parseFloat(mwRaw.ctr || "0"),
              cpc: parseFloat(mwRaw.cpc || "0"), roas: parseFloat(mwRaw.purchase_roas?.[0]?.value || "0"),
              purchases: parseInt(ga(mwRaw.actions, "purchase")), purchaseValue: parseFloat(gv(mwRaw.action_values, "purchase")),
              addToCart: parseInt(ga(mwRaw.actions, "add_to_cart")), viewContent: parseInt(ga(mwRaw.actions, "view_content")),
              initiateCheckout: parseInt(ga(mwRaw.actions, "initiate_checkout")), videoViews: parseInt(ga(mwRaw.actions, "video_view")),
              messaging: parseInt(ga(mwRaw.actions, "onsite_conversion.messaging_first_reply")),
              costPerPurchase: parseFloat((mwRaw.cost_per_action_type || []).find((a: any) => a.action_type === "purchase")?.value || "0"),
            };
            context += `\n\nMETA REKLAMLARI (son 7 gün):
Harcama: ${Math.round(mw.spend).toLocaleString("tr-TR")} TL
Gösterim: ${mw.impressions?.toLocaleString("tr-TR") || 0}
Tıklama: ${mw.clicks?.toLocaleString("tr-TR") || 0}
CTR: %${mw.ctr?.toFixed(2) || 0}
CPC: ${mw.cpc?.toFixed(2) || 0} TL
ROAS: ${mw.roas?.toFixed(2) || "bilinmiyor"}x
Dönüşüm Cirosu: ${mw.purchaseValue ? Math.round(mw.purchaseValue).toLocaleString("tr-TR") : 0} TL
Satın Alma: ${mw.purchases || 0}
Sepete Ekleme: ${mw.addToCart || 0}
İçerik Görüntüleme: ${mw.viewContent || 0}
Ödeme Başlatma: ${mw.initiateCheckout || 0}
Video İzleme: ${mw.videoViews || 0}
Mesajlaşma: ${mw.messaging || 0}
Müşteri Edinme Maliyeti: ${mw.costPerPurchase ? Math.round(mw.costPerPurchase).toLocaleString("tr-TR") : "hesaplanamıyor"} TL`;
          }

          if (mmRaw && parseFloat(mmRaw.spend || "0") > 0) {
            context += `\n\nMETA 30 GÜNLÜK:
Harcama: ${Math.round(parseFloat(mmRaw.spend)).toLocaleString("tr-TR")} TL
ROAS: ${mmRaw.purchase_roas?.[0]?.value ? parseFloat(mmRaw.purchase_roas[0].value).toFixed(2) : "-"}x
Satın Alma: ${ga(mmRaw.actions, "purchase")}
Dönüşüm Cirosu: ${Math.round(parseFloat(gv(mmRaw.action_values, "purchase"))).toLocaleString("tr-TR")} TL`;
          }
        } catch (metaErr: any) {
          context += `\n\nMETA REKLAMLARI: Veri çekilemedi (${metaErr?.message || "bilinmeyen hata"}). Kullanıcıyı Meta Ads Manager'a yönlendir.`;
        }
      }

      // CRM / Messaging data from Railway backend
      try {
        const crmRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://repliq-production-e4aa.up.railway.app"}/api/v1/reports/overview?period=7d`);
        if (crmRes.ok) {
          const crm = await crmRes.json();
          context += `\n\nMÜŞTERİ İLETİŞİMİ (son 7 gün):
Toplam Görüşme: ${crm.total_conversations || 0}
Açık: ${crm.open_conversations || 0}
Çözülen: ${crm.resolved_count || 0}
Ort. Yanıt Süresi: ${crm.avg_response_time_minutes ? Math.round(crm.avg_response_time_minutes) + " dakika" : "bilinmiyor"}`;
        }
      } catch {}

      const fullPrompt = `Sen LessandRomance kadın giyim markasının e-ticaret danışmanısın. Aşağıdaki gerçek Shopify mağaza verilerine erişimin var. Soruyu bu verilere dayanarak cevapla. Türkçe, kısa ve net cevap ver. Veri yoksa "bu veriyi göremiyorum" de, uydurma.

${context}

KULLANICI SORUSU: ${chat}`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{ role: "user", content: fullPrompt }],
        }),
      });
      const aiData = await aiRes.json();
      return NextResponse.json({ insight: aiData.content?.[0]?.text || "Yanıt alınamadı." });
    }

    // Simple prompt mode (for daily briefing)
    if (!prompt) return NextResponse.json({ error: "prompt or chat required" }, { status: 400 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    return NextResponse.json({ insight: text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
