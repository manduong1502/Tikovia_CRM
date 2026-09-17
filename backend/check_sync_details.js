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

async function run() {
  await client.connect();
  const c = await client.query("SELECT id, name FROM companies WHERE name ILIKE '%HT%COFFEE%'");
  const cId = c.rows[0].id;

  const plans = await client.query(`
    SELECT id, date, title, status, "desc", material, created_at 
    FROM content_plans 
    WHERE company_id = $1 
    ORDER BY id DESC LIMIT 15;
  `, [cId]);

  console.log('--- LATEST PLANS (HT COFFEE) ---');
  console.table(plans.rows.map(r => ({
    id: r.id,
    date: r.date,
    title: r.title ? (r.title.slice(0, 25) + '...') : '[EMPTY]',
    status: r.status,
    desc_start: r.desc ? (r.desc.slice(0, 25) + '...') : '[EMPTY]'
  })));

  const pubs = await client.query(`
    SELECT id, date, title, "desc", media, created_at 
    FROM published_contents 
    WHERE company_id = $1 
    ORDER BY id DESC LIMIT 10;
  `, [cId]);

  console.log('\n--- LATEST PUBLISHED CONTENTS (HT COFFEE) ---');
  console.table(pubs.rows.map(r => ({
    id: r.id,
    date: r.date,
    title: r.title ? (r.title.slice(0, 25) + '...') : '[EMPTY]',
    desc_start: r.desc ? (r.desc.slice(0, 25) + '...') : '[EMPTY]'
  })));

  await client.end();
}
run();
