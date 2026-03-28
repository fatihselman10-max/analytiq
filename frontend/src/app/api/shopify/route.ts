import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "2a4c1b-c4.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "act_1204565511444286";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const API_VERSION = "2024-01";

async function shopifyFetch(endpoint: string) {
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/${endpoint}`,
    {
      headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN },
      next: { revalidate: 300 }, // cache 5 min
    }
  );
  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  return res.json();
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
      const email = searchParams.get("email");
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
      const data = await shopifyFetch(`orders.json?email=${encodeURIComponent(email)}&status=any&limit=10`);
      return NextResponse.json(data);
    }

    if (action === "refunds") {
      const limit = searchParams.get("limit") || "50";
      // Get orders with refunds
      const data = await shopifyFetch(`orders.json?limit=${limit}&status=any&financial_status=refunded,partially_refunded&order=created_at+desc`);
      return NextResponse.json(data);
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

      // Meta Ads - deep analysis
      if (META_ACCESS_TOKEN) {
        try {
          const [metaWeekly, metaMonthly, metaDaily, metaCampaigns] = await Promise.all([
            fetch(`https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas&date_preset=last_7d&access_token=${META_ACCESS_TOKEN}`).then(r => r.json()).catch(() => null),
            fetch(`https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/insights?fields=spend,impressions,clicks,actions,action_values,purchase_roas&date_preset=last_30d&access_token=${META_ACCESS_TOKEN}`).then(r => r.json()).catch(() => null),
            fetch(`https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/insights?fields=spend,actions&date_preset=last_7d&time_increment=1&access_token=${META_ACCESS_TOKEN}`).then(r => r.json()).catch(() => null),
            fetch(`https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/campaigns?fields=name,status,objective,insights.date_preset(last_7d){spend,impressions,clicks,actions,purchase_roas}&limit=10&access_token=${META_ACCESS_TOKEN}`).then(r => r.json()).catch(() => null),
          ]);

          const mw = metaWeekly?.data?.[0];
          const mm = metaMonthly?.data?.[0];
          if (mw) {
            const getAction = (actions: any[], type: string) => (actions || []).find((a: any) => a.action_type === type)?.value || 0;
            const getActionValue = (vals: any[], type: string) => (vals || []).find((a: any) => a.action_type === type)?.value || 0;
            context += `\n\nMETA REKLAMLARI (son 7 gün):
Harcama: ${Math.round(parseFloat(mw.spend || "0")).toLocaleString("tr-TR")} TL
Gösterim: ${parseInt(mw.impressions || "0").toLocaleString("tr-TR")}
Tıklama: ${parseInt(mw.clicks || "0").toLocaleString("tr-TR")}
CTR: %${parseFloat(mw.ctr || "0").toFixed(2)}
CPC: ${parseFloat(mw.cpc || "0").toFixed(2)} TL
ROAS: ${mw.purchase_roas?.[0]?.value ? parseFloat(mw.purchase_roas[0].value).toFixed(2) : "bilinmiyor"}x
Dönüşüm Cirosu: ${Math.round(parseFloat(getActionValue(mw.action_values, "purchase"))).toLocaleString("tr-TR")} TL
Satın Alma: ${getAction(mw.actions, "purchase")}
Sepete Ekleme: ${getAction(mw.actions, "add_to_cart")}
İçerik Görüntüleme: ${getAction(mw.actions, "view_content")}
Ödeme Başlatma: ${getAction(mw.actions, "initiate_checkout")}
Video İzleme: ${getAction(mw.actions, "video_view")}
Mesajlaşma: ${getAction(mw.actions, "onsite_conversion.messaging_first_reply")}
Müşteri Edinme Maliyeti: ${parseInt(getAction(mw.actions, "purchase")) > 0 ? Math.round(parseFloat(mw.spend) / parseInt(getAction(mw.actions, "purchase"))).toLocaleString("tr-TR") : "hesaplanamıyor"} TL`;
          }

          if (mm) {
            const getAction = (actions: any[], type: string) => (actions || []).find((a: any) => a.action_type === type)?.value || 0;
            context += `\n\nMETA 30 GÜNLÜK:
Harcama: ${Math.round(parseFloat(mm.spend || "0")).toLocaleString("tr-TR")} TL
ROAS: ${mm.purchase_roas?.[0]?.value ? parseFloat(mm.purchase_roas[0].value).toFixed(2) : "-"}x
Satın Alma: ${getAction(mm.actions, "purchase")}`;
          }

          // Daily breakdown
          const dailyData = metaDaily?.data || [];
          if (dailyData.length > 0) {
            context += `\n\nGÜNLÜK REKLAM HARCAMASI (son 7 gün):`;
            dailyData.forEach((d: any) => {
              const purchases = (d.actions || []).find((a: any) => a.action_type === "purchase")?.value || 0;
              context += `\n${d.date_start}: ${Math.round(parseFloat(d.spend)).toLocaleString("tr-TR")} TL harcama, ${purchases} satış`;
            });
          }

          // Campaign breakdown
          const campaigns = metaCampaigns?.data || [];
          if (campaigns.length > 0) {
            context += `\n\nAKTİF KAMPANYALAR:`;
            campaigns.filter((c: any) => c.status === "ACTIVE").forEach((c: any) => {
              const ins = c.insights?.data?.[0];
              if (ins) {
                const purchases = (ins.actions || []).find((a: any) => a.action_type === "purchase")?.value || 0;
                context += `\n- ${c.name}: ${Math.round(parseFloat(ins.spend)).toLocaleString("tr-TR")} TL harcama, ${ins.clicks} tıklama, ${purchases} satış, ROAS ${ins.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value).toFixed(2) : "-"}x`;
              }
            });
          }
        } catch {}
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
