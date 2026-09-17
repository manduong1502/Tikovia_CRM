import pg from 'pg';
const { Client } = pg;

async function checkSeptPlans() {
  const client = new Client({
    host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const compRes = await client.query("SELECT id, name FROM companies WHERE name ILIKE '%HT%COFFEE%';");
  const companyId = compRes.rows[0]?.id;

  console.log('Company ID:', companyId);

  console.log('\n--- HT COFFEE: ALL content_plans in Sept 2026 ---');
  const plans = await client.query(`
    SELECT id, date, title, status, material, created_at 
    FROM content_plans 
    WHERE company_id = $1 
    ORDER BY id DESC LIMIT 20;
  `, [companyId]);
  console.table(plans.rows);

  console.log('\n--- HT COFFEE: ALL published_contents in Sept 2026 ---');
  const pubs = await client.query(`
    SELECT id, date, title, media, created_at 
    FROM published_contents 
    WHERE company_id = $1 
    ORDER BY id DESC LIMIT 20;
  `, [companyId]);
  console.table(pubs.rows);

  await client.end();
}
checkSeptPlans();
