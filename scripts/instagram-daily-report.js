#!/usr/bin/env node
/**
 * LessandRomance Instagram DM Daily Report → Slack
 *
 * Queries PostgreSQL for Instagram conversations, sends all messages to Claude
 * for expert CRM/marketing analysis, then posts the report to #instagram-rapor.
 *
 * Usage: cd ~/repliq/scripts && node instagram-daily-report.js
 */

const { Client } = require("pg");
const https = require("https");

// ============ CONFIG ============
const DB_URL = "postgresql://postgres:GSyYZvJlEvOOxgiQhMMjgKcQfDUvNiiO@autorack.proxy.rlwy.net:41372/railway";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "C0APFKN8G2W";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ORG_ID = 1;

// ============ DB QUERIES ============
async function fetchData(client) {
  // Daily stats last 7 days
  const stats = await client.query(`
    SELECT DATE(m.created_at) as day,
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE m.sender_type = 'contact') as from_customer,
           COUNT(*) FILTER (WHERE m.sender_type IN ('agent','bot')) as from_staff,
           COUNT(DISTINCT c.contact_id) as unique_customers
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN channels ch ON ch.id = c.channel_id
    WHERE ch.type = 'instagram' AND c.org_id = $1
    AND m.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(m.created_at) ORDER BY day DESC
  `, [ORG_ID]);

  // Response time
  const responseTime = await client.query(`
    WITH first_contact AS (
      SELECT c.id,
             MIN(CASE WHEN m.sender_type = 'contact' THEN m.created_at END) as first_msg,
             MIN(CASE WHEN m.sender_type IN ('agent','bot') THEN m.created_at END) as first_reply
      FROM conversations c
      JOIN channels ch ON ch.id = c.channel_id
      JOIN messages m ON m.conversation_id = c.id
      WHERE ch.type = 'instagram' AND c.org_id = $1
      AND m.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY c.id
    )
    SELECT COUNT(*) as total,
      AVG(EXTRACT(EPOCH FROM (first_reply - first_msg))/60)::int as avg_min,
      MIN(EXTRACT(EPOCH FROM (first_reply - first_msg))/60)::int as min_min
    FROM first_contact
    WHERE first_reply IS NOT NULL AND first_msg IS NOT NULL AND first_reply > first_msg
  `, [ORG_ID]);

  // Full conversations from last 48 hours (with all messages for context)
  const conversations = await client.query(`
    SELECT c.id as conv_id, COALESCE(co.name, co.external_id, 'Bilinmiyor') as customer,
           c.status, c.created_at as conv_start,
           json_agg(json_build_object(
             'sender', m.sender_type,
             'content', COALESCE(m.content, ''),
             'time', m.created_at
           ) ORDER BY m.created_at) as messages
    FROM conversations c
    JOIN channels ch ON ch.id = c.channel_id
    LEFT JOIN contacts co ON co.id = c.contact_id
    JOIN messages m ON m.conversation_id = c.id
    WHERE ch.type = 'instagram' AND c.org_id = $1
    AND m.is_internal = false
    AND c.id IN (
      SELECT DISTINCT c2.id FROM conversations c2
      JOIN channels ch2 ON ch2.id = c2.channel_id
      JOIN messages m2 ON m2.conversation_id = c2.id
      WHERE ch2.type = 'instagram' AND c2.org_id = $1
      AND m2.created_at >= NOW() - INTERVAL '48 hours'
    )
    GROUP BY c.id, co.name, co.external_id, c.status, c.created_at
    ORDER BY MAX(m.created_at) DESC
    LIMIT 40
  `, [ORG_ID]);

  // New customers in last 24h
  const newCustomers = await client.query(`
    SELECT COALESCE(co.name, co.external_id, 'Bilinmiyor') as customer, c.created_at
    FROM conversations c
    JOIN channels ch ON ch.id = c.channel_id
    LEFT JOIN contacts co ON co.id = c.contact_id
    WHERE ch.type = 'instagram' AND c.org_id = $1
    AND c.created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY c.created_at DESC
  `, [ORG_ID]);

  return {
    stats: stats.rows,
    responseTime: responseTime.rows[0],
    conversations: conversations.rows,
    newCustomers: newCustomers.rows,
  };
}

// ============ CLAUDE ANALYSIS ============
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try {
          const r = JSON.parse(body);
          if (r.content && r.content[0]) resolve(r.content[0].text);
          else reject(new Error(`Claude error: ${JSON.stringify(r)}`));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function analyzeWithClaude(data) {
  // Prepare conversation summaries for Claude
  const convSummaries = data.conversations.map(c => {
    const msgs = typeof c.messages === "string" ? JSON.parse(c.messages) : c.messages;
    const msgTexts = msgs
      .filter(m => m.content && m.content.trim())
      .map(m => `[${m.sender === "contact" ? "MUSTERI" : "PERSONEL"}] ${m.content}`)
      .join("\n");
    return `--- ${c.customer} (${c.status}) ---\n${msgTexts}`;
  }).join("\n\n");

  const statsText = data.stats.map(s => {
    const d = new Date(s.day).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    return `${d}: ${s.total} mesaj, ${s.from_customer} musteri, ${s.from_staff} personel, ${s.unique_customers} benzersiz musteri`;
  }).join("\n");

  const prompt = `Sen LessandRomance markasinin CRM ve pazarlama uzmanisin. LessandRomance bir Turkiye merkezli online kadin giyim markasi.

Asagida son 48 saatteki Instagram DM konusmalarini ve 7 gunluk trafik istatistiklerini veriyorum. Bunlari analiz edip Turkce rapor yaz.

TRAFIK (Son 7 gun):
${statsText}

Ortalama yanit suresi: ${data.responseTime?.avg_min || 0} dakika
Yeni musteri sayisi (son 24 saat): ${data.newCustomers.length}

KONUSMALAR (Son 48 saat, ${data.conversations.length} konusma):
${convSummaries}

---

Su formatta analiz yap (Slack mesaji olarak atilacak, kisa ve oz ol):

1. MEMNUN MUSTERILER: Kac musteri memnun ayrildi? Neden memnunlar? (1-2 cumle)

2. MEMNUN EDILEMEYEN MUSTERILER: Kac musteri memnun degildi veya cozumsuz kaldi? Her biri icin neden memnun olmadi, ne yapilmaliydi? (madde madde, kisa)

3. EN COK SORULAN KONULAR: Musteriler en cok neyi soruyor? (ilk 3-4 konu, sayi ile)

4. UZMAN YORUMU: Bir CRM uzmani olarak, bu konusmalara baktiginda:
   - Personel performansi nasil? Dogru mu cevap veriyorlar?
   - Kacirilan satis firsatlari var mi?
   - Musteri deneyimini iyilestirmek icin 2-3 somut oneri ver.
   - Dikkat ceken bir pattern veya trend var mi?

5. ACIL AKSIYON: Hemen yapilmasi gereken 1-2 sey varsa belirt.

ONEMLI: Cok kisa yaz, her madde 1-2 cumle. Slack'te okunacak. Emoji kullanma. Bot/ajan ayrimi yapma, hepsi "personel" olarak geciyor.`;

  try {
    const analysis = await callClaude(prompt);
    return analysis;
  } catch (err) {
    console.error("Claude API error:", err.message);
    return null;
  }
}

// ============ SLACK ============
function postToSlack(text, blocks) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ channel: SLACK_CHANNEL, text, blocks, unfurl_links: false });
    const req = https.request({
      hostname: "slack.com",
      path: "/api/chat.postMessage",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        const r = JSON.parse(body);
        if (r.ok) resolve(r);
        else reject(new Error(`Slack: ${r.error}`));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function buildBlocks(data, claudeAnalysis) {
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const s = data.stats;
  const rt = data.responseTime;

  const dayStats = s.slice(0, 5).map(d => {
    const day = new Date(d.day).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    return `*${day}:* ${d.total} mesaj (${d.from_customer} musteri, ${d.from_staff} personel)`;
  });

  const totalMsgs = s.reduce((sum, d) => sum + parseInt(d.total), 0);
  const totalCustomers = s.reduce((sum, d) => sum + parseInt(d.unique_customers), 0);
  const avgMin = rt ? parseInt(rt.avg_min) : 0;
  const avgText = avgMin > 60 ? `${Math.round(avgMin / 60)} saat ${avgMin % 60} dk` : `${avgMin} dk`;

  const blocks = [
    { type: "header", text: { type: "plain_text", text: `Instagram DM Raporu - ${today}` } },
    { type: "section", text: { type: "mrkdwn", text: "*Son 5 Gun Trafik*" } },
    { type: "section", fields: dayStats.map(t => ({ type: "mrkdwn", text: t })) },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "*Haftalik Performans*" } },
    { type: "section", fields: [
      { type: "mrkdwn", text: `*Toplam:* ${totalMsgs} mesaj` },
      { type: "mrkdwn", text: `*Musteri:* ${totalCustomers} konusma` },
      { type: "mrkdwn", text: `*Ort. Yanit:* ${avgText}` },
      { type: "mrkdwn", text: `*Yeni Musteri (24s):* ${data.newCustomers.length}` },
    ]},
    { type: "divider" },
  ];

  // Claude analysis as the main section
  if (claudeAnalysis) {
    // Split analysis into chunks (Slack block text limit is 3000 chars)
    const chunks = claudeAnalysis.match(/.{1,2900}(\n|$)/gs) || [claudeAnalysis];
    chunks.forEach(chunk => {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: chunk.trim() } });
    });
  } else {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Claude analizi calistirilamadi. ANTHROPIC_API_KEY kontrol edin._" } });
  }

  blocks.push({ type: "divider" });
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: "Repliq CRM Analiz | Gunluk otomatik rapor | Claude AI destekli" }] });

  return blocks;
}

// ============ MAIN ============
async function main() {
  // Get Anthropic key from Railway env or local
  if (!ANTHROPIC_API_KEY) {
    // Try to read from repliq backend env
    try {
      const fs = require("fs");
      const envFiles = [
        `${process.env.HOME}/repliq/.env`,
        `${process.env.HOME}/repliq/backend/.env`,
      ];
      for (const f of envFiles) {
        if (fs.existsSync(f)) {
          const content = fs.readFileSync(f, "utf8");
          const match = content.match(/ANTHROPIC_API_KEY=(.+)/);
          if (match) { process.env.ANTHROPIC_API_KEY = match[1].trim(); break; }
        }
      }
    } catch {}
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[-] ANTHROPIC_API_KEY not found. Set it as env var.");
    process.exit(1);
  }

  const client = new Client({ connectionString: DB_URL });

  try {
    await client.connect();
    console.log("[+] DB connected");

    const data = await fetchData(client);
    console.log(`[+] Data: ${data.stats.length} days, ${data.conversations.length} conversations, ${data.newCustomers.length} new customers`);

    console.log("[+] Sending to Claude for analysis...");
    // Temporarily set key for callClaude
    const origKey = ANTHROPIC_API_KEY;
    if (!origKey) {
      // Monkey-patch for this run
      const scriptContent = require("fs").readFileSync(__filename, "utf8");
    }
    // Use module-level const workaround
    const analysisPromise = (async () => {
      const { Client: _C } = require("pg"); // just to not confuse
      // Call Claude with proper key
      const payload = JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: buildClaudePrompt(data) }],
      });
      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: "api.anthropic.com",
          path: "/v1/messages",
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        }, (res) => {
          let body = "";
          res.on("data", d => body += d);
          res.on("end", () => {
            try {
              const r = JSON.parse(body);
              if (r.content && r.content[0]) resolve(r.content[0].text);
              else reject(new Error(JSON.stringify(r)));
            } catch (e) { reject(e); }
          });
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    })();

    const claudeAnalysis = await analysisPromise;
    console.log(`[+] Claude analysis received (${claudeAnalysis.length} chars)`);

    const blocks = buildBlocks(data, claudeAnalysis);
    const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
    const result = await postToSlack(`Instagram DM CRM Raporu - ${today}`, blocks);
    console.log(`[+] Slack posted: ${result.ts}`);
  } catch (err) {
    console.error("[-] Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

function buildClaudePrompt(data) {
  const convSummaries = data.conversations.map(c => {
    const msgs = typeof c.messages === "string" ? JSON.parse(c.messages) : c.messages;
    const msgTexts = msgs
      .filter(m => m.content && m.content.trim())
      .map(m => `[${m.sender === "contact" ? "MUSTERI" : "PERSONEL"}] ${m.content}`)
      .join("\n");
    return `--- ${c.customer} (${c.status}) ---\n${msgTexts}`;
  }).join("\n\n");

  const statsText = data.stats.map(s => {
    const d = new Date(s.day).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    return `${d}: ${s.total} mesaj, ${s.from_customer} musteri, ${s.from_staff} personel, ${s.unique_customers} benzersiz`;
  }).join("\n");

  return `Sen LessandRomance markasinin CRM ve pazarlama uzmanisin. LessandRomance Turkiye merkezli online kadin giyim markasi. Instagram DM uzerinden satis ve musteri hizmeti yapiliyor.

Son 48 saatteki Instagram DM konusmalarini ve 7 gunluk istatistikleri analiz et.

TRAFIK (Son 7 gun):
${statsText}
Ort. yanit suresi: ${data.responseTime?.avg_min || 0} dk
Yeni musteri (24s): ${data.newCustomers.length}

KONUSMALAR (${data.conversations.length} adet):
${convSummaries}

---

Asagidaki formatta Turkce analiz yap. Slack'te okunacak, Slack mrkdwn formati kullan (*bold*, madde icin •). Kisa ve oz ol:

*MEMNUN MUSTERILER*
Kac musteri memnun? Neden? (kisa ozet)

*MEMNUN EDILEMEYEN MUSTERILER*
Her biri icin: kim, neden memnun degil, ne yapilmaliydi? (madde madde)

*EN COK SORULAN KONULAR*
Ilk 3-4 konu, yaklasik sayi ile

*CRM UZMAN ANALIZI*
• Personel dogru cevap veriyor mu? Eksikler?
• Kacirilan satis firsatlari?
• Musteri deneyimi icin 2-3 somut oneri
• Dikkat ceken pattern/trend

*ACIL AKSIYON*
Hemen yapilmasi gereken 1-2 sey

KURALLAR: Emoji kullanma. Bot/ajan ayrimi yapma, hepsi "personel". Cok kisa yaz, her madde max 2 cumle.`;
}

main();
