// Replay: son N gün içindeki (org_id=1, sender_type='contact') mesajları AI ile yeniden analiz et.
// customer_activities'te zaten source_message_id eşi olan mesajları atla.
// Backend ile aynı rule/Haiku mantığını JS'te yeniden uyguluyor.
//
// Çalıştırma:
//   ANTHROPIC_API_KEY=xxx DAYS=30 node scripts/_messe_ai_replay.mjs
// veya railway env'inden okumak için:
//   /Users/fatih/.local/bin/railway run --service thriving-forgiveness node scripts/_messe_ai_replay.mjs
//
// Notlar:
//   - SADECE customer_activities'e INSERT yapar (pending status). UPDATE/DELETE yok.
//   - Idempotent: aynı message_id için ikinci kez çalışırsa zaten kayıt var, atlar.
//   - Haiku çağrıları paralel değil — rate limit'e takılmamak için sıralı, 200ms gap.

import pg from 'pg';

const DAYS = parseInt(process.env.DAYS || '30', 10);
const HAIKU_KEY = process.env.ANTHROPIC_API_KEY;
const RUN_HAIKU = (process.env.RUN_HAIKU || 'true').toLowerCase() === 'true';
const ORG_ID = 1;

if (RUN_HAIKU && !HAIKU_KEY) {
  console.error('ANTHROPIC_API_KEY env var lazım. Veya RUN_HAIKU=false ile sadece rule replay.');
  process.exit(1);
}

const RULES = {
  sample_request:  { kws: ['numune','sample','образец','образцы','образцов'], title: 'Numune talebi' },
  kartela_request: { kws: ['kartela','color card','swatch','карта цветов','цветовая карта','палитра'], title: 'Kartela talebi' },
  catalog_request: { kws: ['katalog','catalogue','catalog','каталог','lookbook','коллекция'], title: 'Katalog talebi' },
  price_inquiry:   { kws: ['fiyat','price','cost','стоимость','цена','сколько стоит','по чем','почем','kaç para','kac para','ne kadar','ne kadara','metre fiyat','metre fiyatı','fiyat alabilir','fiyat bilgisi','fiyatı nedir','сколько за'], title: 'Fiyat sorgusu' },
  price_clarification: { kws: ['погонн','квадрат','за метр','за м²','за м2','м²','ölçü cinsi','metre mi','metre mi kg','kg mı','metre mi metre'], title: 'Fiyat detay sorusu' },
  order_intent:    { kws: ['siparis','sipariş','order','заказ','заказать','хочу взять','купить','alacağım','almak istiyorum'], title: 'Sipariş niyeti' },
  shipping_info:   { kws: ['kargo','kargoya','shipping','tracking','dhl','ups','fedex','aramex','доставка','трек','отправили'], title: 'Kargo bilgisi' },
  meeting_request: { kws: ['görüşme','gorusme','toplantı','meeting','встреча','созвон','call'], title: 'Görüşme talebi' },
  factory_visit:   { kws: ['fabrika','showroom','ziyaret','visit','офис посетить','посетить'], title: 'Ziyaret talebi' },
  sample_feedback: { kws: ['beğendim','begendim','harika','понравилось','нравится','отлично','хорошо','kötü','плохо'], title: 'Numune geri bildirimi' },
};

const VALID_TYPES = new Set(Object.keys(RULES));

function ruleAnalyze(text) {
  const lower = text.toLowerCase();
  const detections = [];
  const seen = new Set();
  for (const [type, def] of Object.entries(RULES)) {
    for (const kw of def.kws) {
      if (lower.includes(kw.toLowerCase()) && !seen.has(type)) {
        seen.add(type);
        detections.push({
          activity_type: type,
          title: def.title,
          description: text.slice(0, 280),
          confidence: 85,
          detected_by: 'rule',
          metadata: JSON.stringify({ keyword: kw, source: 'replay' }),
        });
        break;
      }
    }
  }
  return detections;
}

async function haikuAnalyze(text, channel) {
  if (!RUN_HAIKU) return [];
  const prompt = `Sen bir B2B tekstil firmasının CRM asistanısın. Müşteri mesajlarını analiz edip iş aksiyonlarını yakalıyorsun.

Mesaj (${channel} kanalı):
"""
${text}
"""

Geçerli activity_type:
- sample_request, kartela_request, catalog_request, price_inquiry, price_clarification,
  order_intent, shipping_info, meeting_request, factory_visit, sample_feedback

Yanıt SADECE JSON:
{"actions":[{"activity_type":"...","title":"...","description":"...","confidence":0-100}]}

Spam, sıradan onay, selamlama → {"actions":[]}.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': HAIKU_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'Sen bir CRM aksiyon tespit asistanısın. Sadece geçerli JSON döndür.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      console.warn(`  haiku ${res.status} ${await res.text().then(t => t.slice(0,80))}`);
      return [];
    }
    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    if (s < 0 || e <= s) return [];
    const parsed = JSON.parse(raw.slice(s, e + 1));
    return (parsed.actions || [])
      .filter(a => VALID_TYPES.has(a.activity_type) && (a.confidence ?? 0) >= 50)
      .map(a => ({
        activity_type: a.activity_type,
        title: a.title || RULES[a.activity_type]?.title || a.activity_type,
        description: (a.description || text).slice(0, 280),
        confidence: a.confidence ?? 60,
        detected_by: 'ai',
        metadata: JSON.stringify({ channel, source: 'replay', ai: 'haiku' }),
      }));
  } catch (e) {
    console.warn(`  haiku err: ${e.message}`);
    return [];
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const c = new pg.Client({
    host: 'junction.proxy.rlwy.net',
    port: 51834,
    user: 'postgres',
    database: 'railway',
    password: 'xswhBJfiUcWyTQdDdMvBGxXsMOkwJObO',
  });
  await c.connect();

  // Çek: son N gün, contact-sent, henüz activity üretmemiş mesajlar
  console.log(`Replay: son ${DAYS} gün, RUN_HAIKU=${RUN_HAIKU}`);
  const { rows } = await c.query(`
    SELECT m.id AS msg_id, m.content, m.created_at, m.conversation_id,
           cv.contact_id, cv.customer_id, COALESCE(ch.type, m.content_type) AS channel
    FROM messages m
    JOIN conversations cv ON cv.id = m.conversation_id
    LEFT JOIN channels ch ON ch.id = cv.channel_id
    WHERE cv.org_id = $1
      AND m.sender_type = 'contact'
      AND m.content IS NOT NULL AND length(m.content) >= 5
      AND m.created_at > NOW() - ($2 || ' days')::interval
      AND NOT EXISTS (SELECT 1 FROM customer_activities a WHERE a.source_message_id = m.id)
    ORDER BY m.created_at DESC
  `, [ORG_ID, DAYS]);

  console.log(`  ${rows.length} mesaj analiz edilecek\n`);

  let ruleHit = 0, haikuHit = 0, miss = 0, inserts = 0, errors = 0;

  for (const m of rows) {
    const text = (m.content || '').trim();
    if (!text) continue;

    let detections = ruleAnalyze(text);
    let via = 'rule';
    if (detections.length === 0) {
      detections = await haikuAnalyze(text, m.channel || 'unknown');
      via = detections.length > 0 ? 'haiku' : 'miss';
      if (RUN_HAIKU) await sleep(200);
    }

    if (detections.length === 0) {
      miss++;
      continue;
    }
    if (via === 'rule') ruleHit++; else haikuHit++;

    for (const d of detections) {
      // Dedupe within 1h (customer or contact)
      let dupID = 0;
      if (m.customer_id) {
        const r = await c.query(
          `SELECT id FROM customer_activities WHERE customer_id=$1 AND activity_type=$2 AND status='pending' AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
          [m.customer_id, d.activity_type]
        );
        dupID = r.rows[0]?.id || 0;
      } else if (m.contact_id) {
        const r = await c.query(
          `SELECT id FROM customer_activities WHERE contact_id=$1 AND activity_type=$2 AND status='pending' AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
          [m.contact_id, d.activity_type]
        );
        dupID = r.rows[0]?.id || 0;
      }
      if (dupID > 0) continue;

      try {
        await c.query(
          `INSERT INTO customer_activities
             (org_id, customer_id, contact_id, conversation_id, activity_type, title, description,
              channel, metadata, status, detected_by, confidence, source_message_id, source_text, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13, $14)`,
          [
            ORG_ID, m.customer_id || null, m.contact_id || null, m.conversation_id || null,
            d.activity_type, d.title, d.description,
            m.channel || '', d.metadata,
            d.detected_by, d.confidence, m.msg_id, text.slice(0, 1000),
            m.created_at, // backfill: keep original timestamp so pending list sorts naturally
          ]
        );
        inserts++;
      } catch (e) {
        errors++;
        if (errors < 5) console.warn(`  insert err msg#${m.msg_id}: ${e.message}`);
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`  Mesaj tarandı: ${rows.length}`);
  console.log(`  Rule eşleşti:  ${ruleHit}`);
  console.log(`  Haiku eşleşti: ${haikuHit}`);
  console.log(`  Boş döndü:     ${miss}`);
  console.log(`  Pending insert: ${inserts}`);
  console.log(`  Hata: ${errors}`);

  // Show current pending queue size by orphan/linked
  const q = await c.query(`
    SELECT
      COUNT(*) FILTER (WHERE customer_id IS NULL) AS orphan,
      COUNT(*) FILTER (WHERE customer_id IS NOT NULL) AS linked
    FROM customer_activities WHERE org_id=$1 AND status='pending'
  `, [ORG_ID]);
  console.log(`\n  Onay kuyruğu şu an: orphan=${q.rows[0].orphan} linked=${q.rows[0].linked}`);

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
