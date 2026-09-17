import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

async function dumpSchema() {
  const client = new Client({
    host: 'db.csqiuextknnbokqiicnz.supabase.co',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    password: 'Tikovia2026@',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const res = await client.query(`
    SELECT 
      table_name, 
      column_name, 
      data_type, 
      is_nullable, 
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  const schemaMap = {};
  for (const row of res.rows) {
    if (!schemaMap[row.table_name]) schemaMap[row.table_name] = [];
    schemaMap[row.table_name].push(row);
  }

  const backupDir = 'c:/Users/ADMIN/Desktop/agent/Tikovia_ai_agent/backup_data';
  fs.writeFileSync(path.join(backupDir, 'schema_details.json'), JSON.stringify(schemaMap, null, 2), 'utf-8');
  console.log('✅ Schema details saved!');
  await client.end();
}

dumpSchema();
