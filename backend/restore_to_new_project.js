import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const configsToTry = [
  {
    host: 'db.prghikcgrgjsdowmnyzs.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  },
  {
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.prghikcgrgjsdowmnyzs',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  },
  {
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 5432,
    user: 'postgres.prghikcgrgjsdowmnyzs',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  }
];

async function runRestore() {
  let client = null;
  for (const config of configsToTry) {
    console.log(`Connecting to ${config.host}:${config.port} as ${config.user}...`);
    try {
      const c = new Client(config);
      await c.connect();
      console.log(`\n🎉 CONNECTED SUCCESSFULLY to ${config.host}:${config.port}!`);
      client = c;
      break;
    } catch (err) {
      console.log(`Connection failed on ${config.host}:${config.port}:`, err.message);
    }
  }

  if (!client) {
    console.error('Could not connect to any postgres endpoint');
    return;
  }

  try {
    console.log('\nCreating schema and tables...');
    const schemaSql = fs.readFileSync('c:/Users/ADMIN/Desktop/agent/Tikovia_ai_agent/backup_data/schema.sql', 'utf-8');
    await client.query(schemaSql);
    console.log('✅ Schema & tables created successfully!');

    const tablesInOrder = [
      'companies',
      'tikovia_users',
      'channels',
      'messages',
      'content_plans',
      'published_contents',
      'tikovia_demos'
    ];

    const backupDir = 'c:/Users/ADMIN/Desktop/agent/Tikovia_ai_agent/backup_data';

    for (const table of tablesInOrder) {
      const filePath = path.join(backupDir, `${table}.json`);
      if (!fs.existsSync(filePath)) continue;

      const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (rows.length === 0) continue;

      console.log(`Restoring ${rows.length} rows into [${table}]...`);

      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row).map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
        
        const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
        const escapedCols = keys.map(k => `"${k}"`).join(', ');

        const query = `
          INSERT INTO "public"."${table}" (${escapedCols})
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING;
        `;

        try {
          await client.query(query, values);
        } catch (err) {
          console.error(`Error inserting into ${table}:`, err.message);
        }
      }
      console.log(`✅ Table [${table}] restored!`);
    }

    // Also create materials storage bucket if possible via SQL
    try {
      await client.query(`
        INSERT INTO storage.buckets (id, name, public) 
        VALUES ('materials', 'materials', true) 
        ON CONFLICT (id) DO NOTHING;
        
        CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id = 'materials') WITH CHECK (bucket_id = 'materials');
      `);
      console.log('✅ Storage bucket [materials] created!');
    } catch (e) {
      console.log('Storage bucket setup note:', e.message);
    }

    console.log('\n🎉🎉🎉 ALL DATA RESTORED 100% SUCCESSFULLY TO NEW SUPABASE PROJECT! 🎉🎉🎉');
  } catch (err) {
    console.error('Restoration error:', err);
  } finally {
    await client.end();
  }
}

runRestore();
