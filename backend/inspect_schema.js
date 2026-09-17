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

async function inspect() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'channels';
  `);
  console.log('--- channels schema ---');
  console.table(res.rows);

  const channels = await client.query('SELECT * FROM channels LIMIT 5;');
  console.log('--- sample channels ---');
  console.table(channels.rows);

  await client.end();
}
inspect();
