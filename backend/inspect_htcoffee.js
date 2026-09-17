import pg from 'pg';
const { Client } = pg;

async function checkHTCoffee() {
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
  console.log('HT COFFEE Companies:', compRes.rows);
  const companyId = compRes.rows[0]?.id;

  if (companyId) {
    console.log('\n================ CONTENT PLANS for HT COFFEE ================');
    const plans = await client.query('SELECT id, date, title, status, material, created_at FROM content_plans WHERE company_id = $1 ORDER BY id DESC;', [companyId]);
    console.log('Total plans in DB:', plans.rows.length);
    console.table(plans.rows.map(p => ({
      id: p.id,
      date: p.date,
      title: p.title?.slice(0, 35),
      status: p.status,
      material: p.material ? p.material.slice(0, 40) : null,
      created_at: p.created_at
    })));

    console.log('\n================ PUBLISHED CONTENTS for HT COFFEE ================');
    const pubs = await client.query('SELECT id, date, title, media, created_at FROM published_contents WHERE company_id = $1 ORDER BY id DESC;', [companyId]);
    console.log('Total published in DB:', pubs.rows.length);
    console.table(pubs.rows.map(p => ({
      id: p.id,
      date: p.date,
      title: p.title?.slice(0, 35),
      media: p.media ? p.media.slice(0, 40) : null,
      created_at: p.created_at
    })));
  }

  await client.end();
}
checkHTCoffee();
