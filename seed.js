const { pool, withTransaction, readJson } = require('./db');
(async()=>{
  if(!pool) throw new Error('DATABASE_URL is required to seed production database.');
  const data = readJson();
  await withTransaction(async c=>{
    await c.query("INSERT INTO site_settings(key,value) VALUES('store',{\"brand\":\"Sheara\"}) ON CONFLICT(key) DO NOTHING");
    await c.query("INSERT INTO site_settings(key,value) VALUES('currency', $1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()", [JSON.stringify(data.currency)]);
    for(const [id,p] of Object.entries(data.products)){
      await c.query(`INSERT INTO products(id,name,size,category,description,highlights,key_ingredients,ingredients,how_to_use,image_url,price_ghs,price_usd,stock,active,featured)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,TRUE,$14)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,size=EXCLUDED.size,category=EXCLUDED.category,description=EXCLUDED.description,highlights=EXCLUDED.highlights,key_ingredients=EXCLUDED.key_ingredients,ingredients=EXCLUDED.ingredients,how_to_use=EXCLUDED.how_to_use,image_url=EXCLUDED.image_url,price_ghs=EXCLUDED.price_ghs,price_usd=EXCLUDED.price_usd,updated_at=NOW()`,
        [id,p.name,p.size,p.category||'Body Care',p.description||'',JSON.stringify(p.highlights||[]),JSON.stringify(p.keyIngredients||[]),p.ingredients||'',p.howToUse||'',p.image||'',Number(p.priceGhs),Number(p.priceUsd),Number(p.stock||100),Boolean(p.featured)]);
    }
  });
  console.log('Sheara production database seeded.');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
