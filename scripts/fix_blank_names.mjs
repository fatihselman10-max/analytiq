const pg = (await import('pg')).default;
const client = new pg.Client({
  host: 'autorack.proxy.rlwy.net', port: 41372,
  user: 'postgres', password: 'GSyYZvJlEvOOxgiQhMMjgKcQfDUvNiiO',
  database: 'railway', ssl: false,
});
await client.connect();

// Bos isimli contact'lari external_id ile guncelle
const result = await client.query(
  "UPDATE contacts SET name = 'IG ' || RIGHT(external_id, 6) WHERE org_id = 1 AND channel_type = 'instagram' AND (name IS NULL OR name = '') RETURNING id, external_id, name"
);
console.log(result.rowCount + ' contact guncellendi');
result.rows.forEach(r => console.log(' ', r.id, r.name));

await client.end();
