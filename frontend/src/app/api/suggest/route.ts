import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "2a4c1b-c4.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

async function shopifyFetch(endpoint: string) {
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/${endpoint}`,
    { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN }, next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { messages, contactName, contactEmail, contactPhone } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // 1. Konuşmadan sipariş numaralarını çıkar (#1234 veya 1234 formatı)
    const allText = messages.map((m: any) => m.content).join(" ");
    const orderNumbers = Array.from(new Set(
      (allText.match(/#?\d{4,6}/g) || []).map((n: string) => n.replace("#", ""))
    ));

    // 2. Müşterinin Shopify siparişlerini çek (isim/email/telefon ile)
    let customerOrders: any[] = [];
    const params = new URLSearchParams({ action: "customer-orders" });
    if (contactEmail) params.set("email", contactEmail);
    if (contactName) params.set("name", contactName);
    if (contactPhone) params.set("phone", contactPhone);

    if (contactEmail || contactName || contactPhone) {
      try {
        const baseUrl = req.nextUrl.origin;
        const res = await fetch(`${baseUrl}/api/shopify?${params.toString()}`);
        const data = await res.json();
        customerOrders = (data.orders || []).slice(0, 5);
      } catch { /* continue without orders */ }
    }

    // 3. Eğer konuşmada geçen sipariş numarası varsa ve müşteri siparişlerinde yoksa, direkt çek
    for (const orderNum of orderNumbers) {
      const alreadyHave = customerOrders.some((o: any) =>
        o.name?.replace("#", "") === orderNum || String(o.order_number) === orderNum
      );
      if (!alreadyHave) {
        try {
          const data = await shopifyFetch(`orders.json?name=%23${orderNum}&status=any&limit=1`);
          if (data?.orders?.length > 0) {
            customerOrders.push(data.orders[0]);
          }
        } catch { /* skip */ }
      }
    }

    // 4. Sipariş bilgilerini özet metne çevir
    let orderContext = "";
    if (customerOrders.length > 0) {
      orderContext = "\n\nMUSTERININ SIPARISLERI:\n" + customerOrders.map((o: any) => {
        const fulfillment = o.fulfillments?.length > 0 ? o.fulfillments[o.fulfillments.length - 1] : null;
        let kargoInfo = "";
        if (fulfillment?.tracking_number) {
          kargoInfo = `Kargo: ${fulfillment.tracking_company || "Kargo"}, Takip: ${fulfillment.tracking_number}`;
          if (fulfillment.tracking_url) kargoInfo += `, Link: ${fulfillment.tracking_url}`;
        } else if (o.financial_status === "paid" && !o.fulfillment_status) {
          kargoInfo = "Durum: Hazirlaniyor, henuz kargoya verilmedi";
        }

        const items = (o.line_items || []).map((i: any) => `${i.quantity}x ${i.title}`).join(", ");
        const dateStr = new Date(o.created_at).toLocaleDateString("tr-TR");

        return `- ${o.name} (${dateStr}): ${parseFloat(o.total_price).toFixed(0)} TL, Odeme: ${o.financial_status}, Kargo: ${o.fulfillment_status || "beklemede"}${kargoInfo ? `. ${kargoInfo}` : ""}. Urunler: ${items}`;
      }).join("\n");
    }

    // 5. Konuşma geçmişini hazırla (son 10 mesaj)
    const history = messages.slice(-10).map((m: any) => {
      const role = m.sender_type === "contact" ? "Musteri" : "Temsilci";
      return `${role}: ${m.content}`;
    }).join("\n");

    // 6. Claude'a gönder - hızlı ve odaklı prompt
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Sen LessandRomance musteri hizmetleri temsilcisisin. Asagidaki konusmaya bagli olarak musterinin SON mesajina 2 yanit onerisi uret.

MARKA:
- LessandRomance: Kadin giyim markasi (online satis)
- On siparis (preorder) teslimat: 14-21 is gunu
- Iade: 14 gun icinde, etiket sokukmemis
- Ucretsiz kargo 500 TL ustu
${orderContext}

KONUSMA:
${history}

KURALLAR:
- Musterinin duygusal tonunu oku. Kizgin/sikayetci ise empati goster ve cozum sun. Asla "bizi tercih ettiginiz icin tesekkurler" gibi bos laflar etme.
- Eger musterinin siparisi varsa, siparis durumunu (kargo bilgisi, takip numarasi, hazirlaniyor durumu) yanitina ekle
- Eger siparis kargoya verilmisse, takip numarasini ve kargo firmasini yanitinda ver
- Eger siparis hazirlaniyor ise, preorder teslimat suresini (14-21 is gunu) belirt
- Yanitlar kisa, net ve ise yarar olsun (max 2-3 cumle)
- Turkce yaz, samimi ama profesyonel ol
- Sadece asagidaki formatta yaz:

Yanit 1: [metin]
Yanit 2: [metin]`
        }],
      }),
    });

    const aiData = await response.json();
    const text = aiData.content?.[0]?.text || "";
    const replies = text
      .split("\n")
      .filter((line: string) => line.match(/^Yanit \d:/i))
      .map((line: string) => line.replace(/^Yanit \d:\s*/i, "").trim())
      .filter((r: string) => r.length > 0);

    return NextResponse.json({ suggestions: replies.slice(0, 2) });
  } catch (err: any) {
    return NextResponse.json({ suggestions: [], error: err.message }, { status: 200 });
  }
}
