const pg = (await import('pg')).default;
const client = new pg.Client({
  host: 'autorack.proxy.rlwy.net', port: 41372,
  user: 'postgres', password: 'GSyYZvJlEvOOxgiQhMMjgKcQfDUvNiiO',
  database: 'railway', ssl: false,
});
await client.connect();

// Step 1: Get page access token from system user token
const systemToken = 'EAAKrwPS5s2IBRMOyUnS7hcZAKLwvcRBZB7CVIa3HUqTATIvs9WYNxnxJsk1uPCZBsX6Kk0JFfJXzAU2NZAtf3hSLtf9rFup6m7gPJ7YVW02jxyOx9i1aYPs8Tl36Pb2uVqL1L6klIwp03IxYNlhiekRSnYZCspIy1SLuOFypr7VWvFNbLhfNMoCE2Nx0oLAZDZD';
const pagesRes = await fetch('https://graph.facebook.com/v21.0/me/accounts?access_token=' + systemToken);
const pagesData = await pagesRes.json();
const pageToken = pagesData.data[0].access_token;
console.log('Page token OK:', pagesData.data[0].name);

// Step 2: Also update the DB credentials with the page token so backend uses it
await client.query(
  "UPDATE channels SET credentials = jsonb_set(jsonb_set(credentials, '{access_token}', $1::jsonb), '{page_access_token}', $1::jsonb) WHERE org_id = 1 AND type = 'instagram' AND is_active = true",
  [JSON.stringify(pageToken)]
);
console.log('DB credentials updated with page token');

// Step 3: Find contacts to fix
const result = await client.query(
  "SELECT id, external_id, name, avatar_url FROM contacts WHERE org_id = 1 AND channel_type = 'instagram' AND (name IS NULL OR name = '' OR name LIKE 'ig_%' OR avatar_url IS NULL OR avatar_url = '')"
);
console.log('Duzeltilecek:', result.rows.length);

let fixed = 0;
for (const c of result.rows) {
  try {
    const r = await fetch('https://graph.facebook.com/v21.0/' + c.external_id + '?fields=username,name,profile_pic&access_token=' + pageToken);
    const d = await r.json();
    const name = d.username || d.name || '';
    if (name) {
      await client.query('UPDATE contacts SET name=$1, avatar_url=COALESCE(NULLIF($2,\'\'), avatar_url) WHERE id=$3', [name, d.profile_pic||'', c.id]);
      console.log(' +', c.id, name);
      fixed++;
    } else {
      console.log(' -', c.id, JSON.stringify(d.error||{}).slice(0,100));
    }
  } catch(e) { console.log(' !', c.id, e.message); }
  await new Promise(r => setTimeout(r, 200));
}
console.log(fixed + '/' + result.rows.length + ' duzeltildi');
await client.end();
