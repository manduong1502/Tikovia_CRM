import pg from 'pg';
const { Client } = pg;
const client = new Client({
  host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
  port: 5432,
  user: 'postgres',
  database: 'postgres',
  password: 'Tikovia2026@',
  ssl: { rejectUnauthorized: false }
});

async function cleanEmptyTitles() {
  await client.connect();
  const empties = await client.query("SELECT id, date, \"desc\" FROM published_contents WHERE title IS NULL OR TRIM(title) = '';");
  console.log('Found empty title published rows:', empties.rows.length);
  for (const r of empties.rows) {
    const firstLine = (r.desc || '').trim().split('\n')[0].trim();
    const title = firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : (firstLine || 'Bài viết ngày ' + r.date);
    await client.query('UPDATE published_contents SET title = $1 WHERE id = $2;', [title, r.id]);
    console.log(`  Updated Pub ID ${r.id} -> Title: "${title}"`);
  }
  await client.end();
}
cleanEmptyTitles();
