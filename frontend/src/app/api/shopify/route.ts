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
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

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
