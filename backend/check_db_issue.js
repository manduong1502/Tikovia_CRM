import pg from 'pg';
const { Client } = pg;

async function checkSequence() {
  const client = new Client({
    host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  console.log('=== 1. Checking content_plans sequence vs max(id) ===');
  const maxPlan = await client.query('SELECT MAX(id) as max_id, COUNT(*) as total_rows FROM content_plans;');
  console.log('content_plans MAX(id):', maxPlan.rows[0].max_id, 'Total count:', maxPlan.rows[0].total_rows);

  const seqPlan = await client.query("SELECT last_value, is_called FROM content_plans_id_seq;");
  console.log('content_plans_id_seq last_value:', seqPlan.rows[0]);

  console.log('\n=== 2. Checking published_contents sequence vs max(id) ===');
  const maxPub = await client.query('SELECT MAX(id) as max_id, COUNT(*) as total_rows FROM published_contents;');
  console.log('published_contents MAX(id):', maxPub.rows[0].max_id, 'Total count:', maxPub.rows[0].total_rows);

  const seqPub = await client.query("SELECT last_value, is_called FROM published_contents_id_seq;");
  console.log('published_contents_id_seq last_value:', seqPub.rows[0]);

  console.log('\n=== 3. Testing INSERT without explicit ID into content_plans ===');
  try {
    const testCompany = (await client.query('SELECT id FROM companies LIMIT 1;')).rows[0].id;
    const insertTest = await client.query(`
      INSERT INTO content_plans (company_id, date, title, "desc", type, status)
      VALUES ($1, '9/9/2026', 'Test insert sequence', 'test', 'Bài viết', 'Chờ duyệt')
      RETURNING *;
    `, [testCompany]);
    console.log('Insert SUCCESS! Generated ID:', insertTest.rows[0].id);
    await client.query('DELETE FROM content_plans WHERE id = $1;', [insertTest.rows[0].id]);
  } catch (err) {
    console.error('❌ Insert FAILED with error:', err.message);
  }

  console.log('\n=== 4. Testing INSERT without explicit ID into published_contents ===');
  try {
    const testCompany = (await client.query('SELECT id FROM companies LIMIT 1;')).rows[0].id;
    const insertTest = await client.query(`
      INSERT INTO published_contents (company_id, date, title, "desc", type)
      VALUES ($1, '9/9/2026', 'Test insert sequence', 'test', 'Bài viết')
      RETURNING *;
    `, [testCompany]);
    console.log('Insert SUCCESS! Generated ID:', insertTest.rows[0].id);
    await client.query('DELETE FROM published_contents WHERE id = $1;', [insertTest.rows[0].id]);
  } catch (err) {
    console.error('❌ Insert FAILED with error:', err.message);
  }

  await client.end();
}

checkSequence();
