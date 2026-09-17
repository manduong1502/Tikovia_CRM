import pg from 'pg';
const { Client } = pg;

async function fixSequences() {
  const client = new Client({
    host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  console.log('--- Fixing sequences for all tables ---');
  
  // Find all sequences in the database
  const seqs = await client.query(`
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public';
  `);
  console.log('Sequences found:', seqs.rows.map(r => r.sequence_name));

  // Fix content_plans_id_seq
  await client.query(`
    SELECT setval('content_plans_id_seq', COALESCE((SELECT MAX(id) FROM content_plans), 1) + 10);
  `);
  const seqPlan = await client.query("SELECT last_value FROM content_plans_id_seq;");
  console.log('✅ content_plans_id_seq reset to:', seqPlan.rows[0].last_value);

  // Fix published_contents_id_seq
  await client.query(`
    SELECT setval('published_contents_id_seq', COALESCE((SELECT MAX(id) FROM published_contents), 1) + 10);
  `);
  const seqPub = await client.query("SELECT last_value FROM published_contents_id_seq;");
  console.log('✅ published_contents_id_seq reset to:', seqPub.rows[0].last_value);

  console.log('\n--- Testing INSERT into content_plans now ---');
  const testCompany = (await client.query('SELECT id FROM companies LIMIT 1;')).rows[0].id;
  const insertPlan = await client.query(`
    INSERT INTO content_plans (company_id, date, title, "desc", type, status)
    VALUES ($1, '9/9/2026', 'Test Insert After Fix', 'desc test', 'Bài viết', 'Chờ duyệt')
    RETURNING *;
  `, [testCompany]);
  console.log('🎉 TEST INSERT content_plans SUCCESS! New ID:', insertPlan.rows[0].id);
  await client.query('DELETE FROM content_plans WHERE id = $1;', [insertPlan.rows[0].id]);

  console.log('\n--- Testing INSERT into published_contents now ---');
  const insertPub = await client.query(`
    INSERT INTO published_contents (company_id, date, title, "desc", type)
    VALUES ($1, '9/9/2026', 'Test Insert After Fix', 'desc test', 'Bài viết')
    RETURNING *;
  `, [testCompany]);
  console.log('🎉 TEST INSERT published_contents SUCCESS! New ID:', insertPub.rows[0].id);
  await client.query('DELETE FROM published_contents WHERE id = $1;', [insertPub.rows[0].id]);

  await client.end();
}

fixSequences();
