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

async function checkAllCompanies() {
  await client.connect();
  const companies = await client.query('SELECT id, name FROM companies ORDER BY id ASC;');
  
  console.log(`Total companies found: ${companies.rows.length}\n`);
  
  const results = [];

  for (const comp of companies.rows) {
    const plansCount = await client.query('SELECT COUNT(*) FROM content_plans WHERE company_id = $1;', [comp.id]);
    const approvedPlansCount = await client.query("SELECT COUNT(*) FROM content_plans WHERE company_id = $1 AND status = 'Đã duyệt';", [comp.id]);
    const emptyTitleApproved = await client.query("SELECT COUNT(*) FROM content_plans WHERE company_id = $1 AND status = 'Đã duyệt' AND (title IS NULL OR TRIM(title) = '');", [comp.id]);
    const pubsCount = await client.query('SELECT COUNT(*) FROM published_contents WHERE company_id = $1;', [comp.id]);
    
    const totalPlans = parseInt(plansCount.rows[0].count);
    const approvedNum = parseInt(approvedPlansCount.rows[0].count);
    const pubNum = parseInt(pubsCount.rows[0].count);
    const emptyApprovedNum = parseInt(emptyTitleApproved.rows[0].count);
    
    if (totalPlans > 0 || pubNum > 0) {
      results.push({
        id: comp.id,
        name: comp.name,
        totalPlans,
        approvedPlans: approvedNum,
        emptyTitleApproved: emptyApprovedNum,
        publishedCount: pubNum,
        discrepancy: approvedNum - pubNum
      });
    }
  }

  console.table(results);

  await client.end();
}
checkAllCompanies();
