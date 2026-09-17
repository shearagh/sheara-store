const fs=require('fs');const db=require('./db');
(async()=>{if(!db.pool)throw new Error('DATABASE_URL is required.');const sql=fs.readFileSync('./schema.sql','utf8');await db.query(sql);
await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_ghs NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_ghs >= 0)");
await db.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost_ghs NUMERIC(12,2) NOT NULL DEFAULT 0");
await db.query("DROP TABLE IF EXISTS inventory_reservations");
console.log('Database schema ready.');await db.close();})().catch(e=>{console.error(e);process.exit(1)});
