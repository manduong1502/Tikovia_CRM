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

async function checkSchema() {
  await client.connect();
  const resPub = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'published_contents';
  `);
  console.log('--- published_contents schema ---');
  console.table(resPub.rows);

  const resPlan = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'content_plans';
  `);
  console.log('--- content_plans schema ---');
  console.table(resPlan.rows);

  await client.end();
}
checkSchema();
