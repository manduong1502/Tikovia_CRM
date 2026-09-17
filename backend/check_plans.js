import pg from 'pg';
const { Client } = pg;

async function checkPlans() {
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

  const plans = await client.query(`
    SELECT id, date, title, status, material, created_at 
    FROM content_plans 
    WHERE company_id = $1 
    ORDER BY id DESC LIMIT 20;
  `, [companyId]);
  console.log('--- HT COFFEE CONTENT PLANS ---');
  console.table(plans.rows);

  await client.end();
}
checkPlans();
