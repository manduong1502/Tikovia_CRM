import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const passwordsToTry = ['Tikovia2026@'];

async function tryConnect() {
  const configs = [
    {
      host: 'db.csqiuextknnbokqiicnz.supabase.co',
      port: 5432,
      user: 'postgres',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    },
    {
      host: 'aws-0-ap-northeast-1.pooler.supabase.com',
      port: 6543,
      user: 'postgres.csqiuextknnbokqiicnz',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    },
    {
      host: 'aws-0-ap-northeast-1.pooler.supabase.com',
      port: 5432,
      user: 'postgres.csqiuextknnbokqiicnz',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    }
  ];

  for (const pw of passwordsToTry) {
    for (const conf of configs) {
      console.log(`Connecting to ${conf.host}:${conf.port} as ${conf.user}...`);
      const client = new Client({ ...conf, password: pw });
      try {
        await client.connect();
        console.log(`\n🎉 CONNECTED SUCCESSFULLY to ${conf.host}!`);
        
        // List all public tables
        const resTables = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE';
        `);
        
        const tables = resTables.rows.map(r => r.table_name);
        console.log('Tables found:', tables);
        
        const backupDir = 'c:/Users/ADMIN/Desktop/agent/Tikovia_ai_agent/backup_data';
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const fullBackup = {};
        
        for (const table of tables) {
          try {
            const res = await client.query(`SELECT * FROM "public"."${table}";`);
            console.log(`Fetched table [${table}]: ${res.rows.length} rows`);
            fullBackup[table] = res.rows;
            fs.writeFileSync(path.join(backupDir, `${table}.json`), JSON.stringify(res.rows, null, 2), 'utf-8');
          } catch (e) {
            console.error(`Error fetching table ${table}:`, e.message);
          }
        }
        
        fs.writeFileSync(path.join(backupDir, `all_data_backup.json`), JSON.stringify(fullBackup, null, 2), 'utf-8');
        console.log(`\n✅ ALL DATA BACKED UP SUCCESSFULLY TO ${backupDir}!`);
        await client.end();
        return true;
      } catch (err) {
        console.log(`Failed on ${conf.host}:${conf.port}:`, err.message);
        try { await client.end(); } catch(_) {}
      }
    }
  }
  return false;
}

tryConnect();
