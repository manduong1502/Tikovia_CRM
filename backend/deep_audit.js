import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Client } = pg;

const SUPABASE_URL = 'https://prghikcgrgjsdowmnyzs.supabase.co';
const ANON_KEY = 'sb_publishable_fcRAaVPu4geHcW_d3v6tuA_opYL-49-';
const DB_PASS = 'Tikovia2026@';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function runAudit() {
  console.log('====================================================');
  console.log('      DEEP AUDIT: TIKOVIA CRM DATA INTEGRITY        ');
  console.log('====================================================\n');

  const pgClient = new Client({
    host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: DB_PASS,
    ssl: { rejectUnauthorized: false }
  });

  await pgClient.connect();

  // 1. Audit Table Columns, Types & Defaults
  console.log('--- 1. AUDIT TABLE SCHEMAS & DEFAULTS ---');
  const tables = ['companies', 'tikovia_users', 'channels', 'messages', 'content_plans', 'published_contents', 'tikovia_demos'];
  for (const t of tables) {
    const cols = await pgClient.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    console.log(`Table [${t}]: ${cols.rows.length} columns`);
  }

  // 2. Audit Sequences
  console.log('\n--- 2. AUDIT SEQUENCES VS CURRENT MAX ID ---');
  const seqChecks = [
    { table: 'content_plans', seq: 'content_plans_id_seq' },
    { table: 'published_contents', seq: 'published_contents_id_seq' }
  ];
  for (const sc of seqChecks) {
    const maxRes = await pgClient.query(`SELECT MAX(id) as max_id FROM ${sc.table};`);
    const seqRes = await pgClient.query(`SELECT last_value FROM ${sc.seq};`);
    const maxId = Number(maxRes.rows[0].max_id || 0);
    const seqVal = Number(seqRes.rows[0].last_value || 0);
    const safe = seqVal > maxId;
    console.log(`[${sc.table}] MAX(id) = ${maxId} | Sequence value = ${seqVal} | Safe: ${safe ? '✅ YES' : '❌ NO'}`);
  }

  // 3. Audit RLS Policies for Anon Client
  console.log('\n--- 3. AUDIT RLS POLICIES ---');
  const rlsRes = await pgClient.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public';
  `);
  console.log(`Total RLS policies configured: ${rlsRes.rows.length}`);
  for (const pol of rlsRes.rows) {
    console.log(`  - Table: ${pol.tablename} | Policy: ${pol.policyname} | Cmd: ${pol.cmd}`);
  }

  // 4. Test Full CRUD Cycle via Supabase Anon Client (Simulating Real User Browser)
  console.log('\n--- 4. SIMULATING REAL USER BROWSER ACTIONS ---');
  const companyRes = await supabase.from('companies').select('id, name').limit(1);
  const company = companyRes.data[0];
  console.log(`Simulating actions for Company: ${company.name} (${company.id})`);

  // Step A: Content Creator creates a Plan
  console.log('-> Action A: Content creator adds a new post...');
  const { data: createdPlan, error: errCreate } = await supabase
    .from('content_plans')
    .insert([{
      company_id: company.id,
      date: '8/9/2026',
      title: 'Audit Test Post Title',
      desc: 'Mô tả bài viết test audit',
      type: 'Text',
      material: 'https://example.com/photo.jpg',
      notes: 'Ghi chú cho khách hàng',
      status: 'Chờ duyệt'
    }])
    .select();

  if (errCreate) {
    console.error('❌ Action A FAILED:', errCreate);
    return;
  }
  console.log('✅ Action A SUCCESS: Created plan with ID:', createdPlan[0].id);

  // Step B: Content Creator edits the post
  console.log('-> Action B: Content creator edits post content...');
  const { error: errEdit } = await supabase
    .from('content_plans')
    .update({
      title: 'Audit Test Post Title (Edited)',
      desc: 'Mô tả bài viết đã chỉnh sửa'
    })
    .eq('id', createdPlan[0].id);

  if (errEdit) console.error('❌ Action B FAILED:', errEdit);
  else console.log('✅ Action B SUCCESS: Post updated');

  // Step C: Customer approves the post ('Đã duyệt') and adds Feedback note
  console.log('-> Action C: Customer approves post and syncs to published_contents...');
  const { error: errApprove } = await supabase
    .from('content_plans')
    .update({
      status: 'Đã duyệt',
      notes: 'Khách hàng duyệt bài ngày 8/9/2026'
    })
    .eq('id', createdPlan[0].id);

  if (errApprove) console.error('❌ Action C FAILED:', errApprove);
  else console.log('✅ Action C SUCCESS: Status updated to Đã duyệt');

  // Step D: Insert into published_contents (Triển khai)
  const { data: createdPub, error: errPub } = await supabase
    .from('published_contents')
    .insert([{
      company_id: company.id,
      date: '8/9/2026',
      title: 'Audit Test Post Title (Edited)',
      desc: 'Mô tả bài viết đã chỉnh sửa',
      type: 'Text',
      media: 'https://example.com/photo.jpg',
      notes: 'Khách hàng duyệt bài ngày 8/9/2026',
      link: ''
    }])
    .select();

  if (errPub) console.error('❌ Action D FAILED:', errPub);
  else console.log('✅ Action D SUCCESS: Synced to published_contents with ID:', createdPub[0].id);

  // Step E: Verify both records exist and can be read by any client
  console.log('-> Action E: Verify querying data...');
  const { data: verifyPlan } = await supabase.from('content_plans').select('*').eq('id', createdPlan[0].id).single();
  const { data: verifyPub } = await supabase.from('published_contents').select('*').eq('id', createdPub[0].id).single();

  console.log('Verified Plan in DB:', verifyPlan?.title, '| Status:', verifyPlan?.status);
  console.log('Verified Published Post in DB:', verifyPub?.title, '| ID:', verifyPub?.id);

  // Clean up audit records
  await supabase.from('content_plans').delete().eq('id', createdPlan[0].id);
  await supabase.from('published_contents').delete().eq('id', createdPub[0].id);
  console.log('✅ Cleaned up audit test data.');

  await pgClient.end();
  console.log('\n====================================================');
  console.log('               AUDIT COMPLETED                      ');
  console.log('====================================================');
}

runAudit();
