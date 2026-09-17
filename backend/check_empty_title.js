import pg from 'pg';
const { Client } = pg;

async function checkEmptyTitle() {
  const client = new Client({
    host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const plans = await client.query(`
    SELECT id, company_id, date, title, "desc", type, status, material, created_at 
    FROM content_plans 
    WHERE id IN (353, 354, 355, 356, 368);
  `);
  console.log('--- DETAILED RECENT PLANS ---');
  for (const p of plans.rows) {
    console.log(`ID: ${p.id} | Date: ${p.date} | Status: ${p.status}`);
    console.log(`Title: "${p.title}"`);
    console.log(`Desc: "${p.desc?.slice(0, 100)}..."`);
    console.log(`Material: "${p.material}"`);
    console.log('--------------------------------------------------');
  }

  await client.end();
}
checkEmptyTitle();
