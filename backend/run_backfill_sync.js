import pg from 'pg';
const { Client } = pg;

function getFallbackTitle(title, desc, date) {
  if (title && title.trim().length > 0) {
    return title.trim();
  }
  if (desc && desc.trim().length > 0) {
    // Take first line or up to 80 chars
    const firstLine = desc.trim().split('\n')[0].trim();
    if (firstLine.length > 80) {
      return firstLine.slice(0, 80) + '...';
    }
    return firstLine;
  }
  return `Bài viết ngày ${date || ''}`;
}

async function runBackfillAndLink() {
  const client = new Client({
    host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('=== STARTING SYNC & BACKFILL FOR ALL COMPANIES ===');

  const companies = await client.query('SELECT id, name FROM companies ORDER BY id ASC;');

  let totalLinked = 0;
  let totalInserted = 0;

  for (const comp of companies.rows) {
    // 1. Get all approved plans for this company
    const plansRes = await client.query(`
      SELECT id, company_id, date, title, "desc", type, material, notes, status, created_at 
      FROM content_plans 
      WHERE company_id = $1 AND status = 'Đã duyệt'
      ORDER BY id ASC;
    `, [comp.id]);

    const approvedPlans = plansRes.rows;
    if (approvedPlans.length === 0) continue;

    // 2. Get all published items for this company
    const pubsRes = await client.query(`
      SELECT id, company_id, plan_id, date, title, "desc", media, notes, link, created_at 
      FROM published_contents 
      WHERE company_id = $1
      ORDER BY id ASC;
    `, [comp.id]);

    const pubs = pubsRes.rows;

    console.log(`\nCompany: ${comp.name} | Approved Plans: ${approvedPlans.length} | Published: ${pubs.length}`);

    // Map existing pubs by plan_id
    const pubsByPlanId = new Map();
    const unlinkedPubs = [];

    for (const pub of pubs) {
      if (pub.plan_id) {
        pubsByPlanId.set(String(pub.plan_id), pub);
      } else {
        unlinkedPubs.push(pub);
      }
    }

    // Try linking unlinked pubs to approved plans by matching (date, desc/title)
    for (const pub of unlinkedPubs) {
      // Find matching plan
      const matchedPlan = approvedPlans.find(p => {
        if (pubsByPlanId.has(String(p.id))) return false;
        // Match by title if both have non-empty title
        if (pub.title && p.title && pub.title.trim() === p.title.trim()) return true;
        // Match by date and starting desc
        if (pub.date === p.date) {
          const pubDescStart = (pub.desc || '').slice(0, 30).trim();
          const pDescStart = (p.desc || '').slice(0, 30).trim();
          if (pubDescStart && pDescStart && pubDescStart === pDescStart) return true;
        }
        return false;
      });

      if (matchedPlan) {
        await client.query('UPDATE published_contents SET plan_id = $1 WHERE id = $2;', [matchedPlan.id, pub.id]);
        pubsByPlanId.set(String(matchedPlan.id), pub);
        totalLinked++;
        // console.log(`  🔗 Linked Pub ID ${pub.id} to Plan ID ${matchedPlan.id} (${pub.date})`);
      }
    }

    // Now check for any approved plans that STILL do not exist in published_contents
    for (const plan of approvedPlans) {
      if (!pubsByPlanId.has(String(plan.id))) {
        const computedTitle = getFallbackTitle(plan.title, plan.desc, plan.date);
        const insertRes = await client.query(`
          INSERT INTO published_contents (company_id, plan_id, date, title, "desc", type, media, notes, link, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', $9)
          RETURNING id;
        `, [
          comp.id,
          plan.id,
          plan.date,
          computedTitle,
          plan.desc || '',
          plan.type || 'Text',
          plan.material || '',
          plan.notes || '',
          plan.created_at
        ]);

        totalInserted++;
        console.log(`  ➕ INSERTED missing post: Plan ID ${plan.id} | Date: ${plan.date} | Title: "${computedTitle.slice(0, 40)}..." -> Pub ID ${insertRes.rows[0].id}`);
      }
    }
  }

  console.log(`\n=== BACKFILL COMPLETE ===`);
  console.log(`Total legacy records linked: ${totalLinked}`);
  console.log(`Total missing posts inserted: ${totalInserted}`);

  await client.end();
}

runBackfillAndLink();
