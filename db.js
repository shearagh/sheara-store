const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const hasDatabase = Boolean(process.env.DATABASE_URL);
let pool = null;
if (hasDatabase) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX || 20),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000
  });
}

const DATA_FILE = process.env.PRICING_FILE || path.join(__dirname, 'data', 'pricing.json');
const DEFAULT = {
  currency: { usdToGhsRate: 11.5 },
  products: {
    'lotion-50': { name:'Sheara Lotion', size:'50ml', priceGhs:15, priceUsd:1.30, image:'assets/lotion-50ml.jpeg', description:'An everyday body lotion made to leave skin feeling soft, moisturised and comfortable.', highlights:['Everyday body moisturising','Shea butter based','Convenient 50ml size'], keyIngredients:['Shea butter','Niacinamide','Sunflower oil','Vitamin E'], ingredients:'Distilled water, shea butter, sunflower oil, emulsifying wax, cetyl alcohol, stearic acid, vegetable glycerine, niacinamide, vitamin E, Germall Plus preservative and fragrance.', howToUse:'Apply a suitable amount to clean, dry skin and massage gently until absorbed.', category:'Body Care', stock:100 },
    'lotion-100': { name:'Sheara Lotion', size:'100ml', priceGhs:25, priceUsd:2.17, image:'assets/lotion-100ml.jpeg', description:'A nourishing everyday lotion formulated with shea butter, niacinamide, sunflower oil and vitamin E for soft, moisturised-looking skin.', highlights:['Everyday hydration','With niacinamide & vitamin E','Shea-powered body care'], keyIngredients:['Shea butter','Niacinamide','Sunflower oil','Vitamin E'], ingredients:'Distilled water, shea butter, sunflower oil, emulsifying wax, cetyl alcohol, stearic acid, vegetable glycerine, niacinamide, vitamin E, Germall Plus preservative and fragrance.', howToUse:'Apply a suitable amount to clean, dry skin and massage gently until absorbed.', category:'Body Care', stock:100 },
    'glow-cream': { name:'Sheara Glow Body Cream', size:'500ml', priceGhs:65, priceUsd:5.65, image:'assets/glow-body-cream.jpeg', description:'A rich shea-based body cream created for a nourishing, soft and moisturised skin feel.', highlights:['Rich body moisturising','Shea butter based','Generous 500ml size'], keyIngredients:['Shea butter','Coconut oil','Sunflower oil','Vitamin E'], ingredients:'Shea butter, coconut oil, sunflower oil, vitamin E oil and corn starch.', howToUse:'Apply a suitable amount to clean, dry skin and massage gently until absorbed.', category:'Body Care', stock:100 }
  }
};

function readJson(){ try { return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); } catch { return DEFAULT; } }
function writeJson(v){ fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true}); fs.writeFileSync(DATA_FILE,JSON.stringify(v,null,2)); }

async function query(text, params=[]){
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return pool.query(text, params);
}
async function withTransaction(fn){
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch(e){ try { await client.query('ROLLBACK'); } catch {} throw e; }
  finally { client.release(); }
}
async function ping(){ if(!pool) return false; await pool.query('SELECT 1'); return true; }
async function close(){ if(pool) await pool.end(); }
module.exports = { hasDatabase, pool, query, withTransaction, ping, close, readJson, writeJson, DEFAULT };
