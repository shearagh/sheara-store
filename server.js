import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_PRODUCTS = [
  { id:'glow', name:'Glow Body Cream', size:'500ml', price:65, img:'/assets/glow-body-cream.jpeg', desc:'Rich body cream for deep nourishment, softness and a healthy-looking glow.', active:true },
  { id:'lotion50', name:'Sheara Lotion', size:'50ml', price:15, img:'/assets/lotion-50ml.jpeg', desc:'Lightweight moisture for soft, radiant-looking skin, enriched with niacinamide, sunflower oil and vitamin E.', active:true },
  { id:'lotion100', name:'Sheara Lotion', size:'100ml', price:25, img:'/assets/lotion-100ml.jpeg', desc:'Our everyday lotion in a larger size, enriched with niacinamide, sunflower oil and vitamin E.', active:true }
];
const DEFAULT_SETTINGS = { delivery_accra: 0, delivery_other_ghana: 0 };

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
let jsonWrite = Promise.resolve();

async function ensureJsonFile(file, fallback) {
  await fs.mkdir(DATA_DIR, { recursive:true });
  try { await fs.access(file); } catch { await fs.writeFile(file, JSON.stringify(fallback, null, 2)); }
}

async function ensureDb() {
  if (pool) {
    await pool.query(`CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT,
      region TEXT,
      delivery_zone TEXT NOT NULL,
      items JSONB NOT NULL,
      subtotal NUMERIC(12,2) NOT NULL,
      delivery_fee NUMERIC(12,2) NOT NULL,
      total NUMERIC(12,2) NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      order_status TEXT NOT NULL DEFAULT 'new',
      paystack_reference TEXT,
      paystack_transaction_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL,
      img TEXT,
      image_data TEXT,
      description TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const count = Number((await pool.query('SELECT COUNT(*)::int AS count FROM products')).rows[0].count);
    if (!count) for (const p of DEFAULT_PRODUCTS) await pool.query('INSERT INTO products (id,name,size,price,img,description,active) VALUES ($1,$2,$3,$4,$5,$6,$7)', [p.id,p.name,p.size,p.price,p.img,p.desc,p.active]);
    const settings = await pool.query('SELECT key FROM site_settings');
    if (!settings.rows.length) for (const [k,v] of Object.entries(DEFAULT_SETTINGS)) await pool.query('INSERT INTO site_settings (key,value) VALUES ($1,$2)', [k,String(v)]);
    return;
  }
  await ensureJsonFile(DATA_FILE, []);
  await ensureJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  await ensureJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
}

async function readOrders() {
  if (pool) return (await pool.query('SELECT * FROM orders ORDER BY created_at DESC')).rows;
  return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
}
async function getOrderByNumber(orderNumber) {
  if (pool) return (await pool.query('SELECT * FROM orders WHERE order_number=$1', [orderNumber])).rows[0] || null;
  const orders = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); return orders.find(o => o.order_number === orderNumber) || null;
}
async function getOrderByReference(reference) {
  if (pool) return (await pool.query('SELECT * FROM orders WHERE paystack_reference=$1', [reference])).rows[0] || null;
  const orders = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); return orders.find(o => o.paystack_reference === reference) || null;
}
async function createOrder(order) {
  if (pool) {
    const q = `INSERT INTO orders (order_number,customer_name,phone,email,address,city,region,delivery_zone,items,subtotal,delivery_fee,total,payment_status,order_status,paystack_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`;
    const values=[order.order_number,order.customer_name,order.phone,order.email,order.address,order.city,order.region,order.delivery_zone,JSON.stringify(order.items),order.subtotal,order.delivery_fee,order.total,order.payment_status,order.order_status,order.paystack_reference];
    return (await pool.query(q,values)).rows[0];
  }
  jsonWrite=jsonWrite.then(async()=>{const orders=JSON.parse(await fs.readFile(DATA_FILE,'utf8'));orders.unshift(order);await fs.writeFile(DATA_FILE,JSON.stringify(orders,null,2));}); await jsonWrite; return order;
}
async function updateOrder(orderNumber, patch) {
  if (pool) { const keys=Object.keys(patch); if(!keys.length)return getOrderByNumber(orderNumber); const sets=keys.map((k,i)=>`${k}=$${i+1}`).join(', '); const vals=keys.map(k=>patch[k]); vals.push(orderNumber); return (await pool.query(`UPDATE orders SET ${sets}, updated_at=NOW() WHERE order_number=$${vals.length} RETURNING *`,vals)).rows[0]||null; }
  let updated; jsonWrite=jsonWrite.then(async()=>{const orders=JSON.parse(await fs.readFile(DATA_FILE,'utf8'));const idx=orders.findIndex(o=>o.order_number===orderNumber);if(idx<0)return;orders[idx]={...orders[idx],...patch,updated_at:new Date().toISOString()};updated=orders[idx];await fs.writeFile(DATA_FILE,JSON.stringify(orders,null,2));});await jsonWrite;return updated;
}
async function readProducts() {
  if (pool) return (await pool.query('SELECT id,name,size,price,img,image_data,description,active,updated_at FROM products ORDER BY updated_at DESC')).rows;
  return JSON.parse(await fs.readFile(PRODUCTS_FILE,'utf8'));
}
async function getProduct(id) { const ps=await readProducts(); return ps.find(p=>p.id===id) || null; }
async function writeProducts(list) { jsonWrite=jsonWrite.then(()=>fs.writeFile(PRODUCTS_FILE,JSON.stringify(list,null,2))); await jsonWrite; }
async function upsertProduct(p, existingId=null) {
  if (pool) {
    const id=existingId||p.id;
    const q=existingId
      ? `UPDATE products SET name=$1,size=$2,price=$3,img=$4,image_data=$5,description=$6,active=$7,updated_at=NOW() WHERE id=$8 RETURNING *`
      : `INSERT INTO products (id,name,size,price,img,image_data,description,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
    const vals=existingId?[p.name,p.size,p.price,p.img||null,p.image_data||null,p.description||'',p.active!==false,id]:[id,p.name,p.size,p.price,p.img||null,p.image_data||null,p.description||'',p.active!==false];
    return (await pool.query(q,vals)).rows[0];
  }
  const list=JSON.parse(await fs.readFile(PRODUCTS_FILE,'utf8')); const idx=list.findIndex(x=>x.id===(existingId||p.id)); const out={...p,id:existingId||p.id,active:p.active!==false}; if(idx>=0)list[idx]=out;else list.unshift(out); await writeProducts(list); return out;
}
async function deleteProduct(id) {
  if(pool){await pool.query('DELETE FROM products WHERE id=$1',[id]);return;}
  const list=JSON.parse(await fs.readFile(PRODUCTS_FILE,'utf8')).filter(p=>p.id!==id); await writeProducts(list);
}
async function readSettings() {
  if(pool){const rows=(await pool.query('SELECT key,value FROM site_settings')).rows;return Object.fromEntries(rows.map(r=>[r.key,Number(r.value)]));}
  return JSON.parse(await fs.readFile(SETTINGS_FILE,'utf8'));
}
async function writeSettings(s) {
  if(pool){for(const [k,v] of Object.entries(s)) await pool.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[k,String(v)]);return;}
  await fs.writeFile(SETTINGS_FILE,JSON.stringify(s,null,2));
}
function makeOrderNumber(){return `SH-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;}
function deliveryFee(zone){const s=globalThis.__settings||DEFAULT_SETTINGS;const value=zone==='accra'?s.delivery_accra:s.delivery_other_ghana;const fee=Number(value);return Number.isFinite(fee)&&fee>=0?fee:null;}
function normalizeItems(raw){if(!Array.isArray(raw)||!raw.length)throw new Error('Your cart is empty.');const products=globalThis.__products||[];return raw.map(row=>{const p=products.find(x=>x.id===row.id&&x.active!==false);const qty=Math.max(1,Math.min(20,Number(row.qty||1)));if(!p)throw new Error('One of the products in your cart is no longer available.');return{id:p.id,name:p.name,size:p.size,price:Number(p.price),qty,img:p.image_data||p.img||''};});}
function adminAuth(req,res,next){const token=req.cookies?.sheara_admin;if(!token)return res.status(401).json({error:'Not signed in.'});try{req.admin=jwt.verify(token,JWT_SECRET);next();}catch{return res.status(401).json({error:'Session expired.'});}}
function cleanProductInput(body){const name=String(body?.name||'').trim(),size=String(body?.size||'').trim(),description=String(body?.description||'').trim();const price=Number(body?.price);if(!name||!size||!Number.isFinite(price)||price<0)throw new Error('Enter a product name, size and valid price.');return{name,size,price,img:String(body?.img||'').trim()||null,image_data:String(body?.image_data||'').trim()||null,description,active:body?.active!==false};}

const app=express();
app.use(express.json({limit:'8mb',verify:(req,res,buf)=>{req.rawBody=Buffer.from(buf)}}));
app.use((req,res,next)=>{const cookie=req.headers.cookie||'';req.cookies=Object.fromEntries(cookie.split(';').filter(Boolean).map(v=>{const i=v.indexOf('=');return[i<0?v:v.slice(0,i).trim(),i<0?'':decodeURIComponent(v.slice(i+1))]}));next();});
app.use(express.static(path.join(__dirname,'public')));

app.get('/api/config',async(req,res)=>res.json({paystackReady:Boolean(PAYSTACK_SECRET_KEY),siteUrl:SITE_URL,delivery:await readSettings()}));
app.get('/api/products',async(req,res)=>res.json({products:(await readProducts()).filter(p=>p.active!==false).map(p=>({...p,price:Number(p.price)}))}));

app.post('/api/orders/initialize',async(req,res)=>{try{
  if(!PAYSTACK_SECRET_KEY)return res.status(503).json({error:'Paystack is not connected yet. Add PAYSTACK_SECRET_KEY on the server.'});
  const {customer,items:rawItems}=req.body||{};
  if(!customer?.name||!customer?.phone||!customer?.email||!customer?.address||!customer?.city||!customer?.region||!customer?.deliveryZone)return res.status(400).json({error:'Please complete all delivery and contact fields.'});
  if(!['accra','other_ghana'].includes(customer.deliveryZone))return res.status(400).json({error:'Please select a delivery zone.'});
  const items=normalizeItems(rawItems);const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);const fee=deliveryFee(customer.deliveryZone);if(fee===null)return res.status(503).json({error:'Delivery fees have not been configured yet.'});
  const total=subtotal+fee,orderNumber=makeOrderNumber(),reference=`sheara_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await createOrder({order_number:orderNumber,customer_name:customer.name.trim(),phone:customer.phone.trim(),email:customer.email.trim().toLowerCase(),address:customer.address.trim(),city:customer.city.trim(),region:customer.region.trim(),delivery_zone:customer.deliveryZone,items,subtotal,delivery_fee:fee,total,payment_status:'pending',order_status:'new',paystack_reference:reference,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({email:customer.email.trim().toLowerCase(),amount:String(Math.round(total*100)),currency:'GHS',reference,callback_url:`${SITE_URL}/api/paystack/callback`,metadata:{order_number:orderNumber,customer_name:customer.name,phone:customer.phone,address:customer.address,city:customer.city,region:customer.region,delivery_zone:customer.deliveryZone,items,subtotal,delivery_fee:fee,total}})});
  const data=await response.json();if(!response.ok||!data.status){await updateOrder(orderNumber,{payment_status:'failed'});return res.status(502).json({error:data.message||'Could not start Paystack checkout.'});}res.json({authorization_url:data.data.authorization_url,reference,order_number:orderNumber});
}catch(e){console.error(e);res.status(400).json({error:e.message||'Unable to create order.'});}});

app.get('/api/paystack/callback',async(req,res)=>{const reference=String(req.query.reference||'');if(!reference||!PAYSTACK_SECRET_KEY)return res.redirect('/checkout.html?payment=error');try{const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`}});const data=await response.json();const order=await getOrderByReference(reference);if(data.status&&data.data?.status==='success'&&order&&Math.round(Number(order.total)*100)===Number(data.data.amount)){await updateOrder(order.order_number,{payment_status:'paid',order_status:'paid',paystack_transaction_id:String(data.data.id)});return res.redirect(`/success.html?order=${encodeURIComponent(order.order_number)}`);}if(order)await updateOrder(order.order_number,{payment_status:data.data?.status||'failed'});return res.redirect(`/checkout.html?payment=failed&order=${encodeURIComponent(order?.order_number||'')}`);}catch(e){console.error(e);return res.redirect('/checkout.html?payment=error');}});

app.post('/api/paystack/webhook',async(req,res)=>{try{const signature=req.headers['x-paystack-signature'];const expected=crypto.createHmac('sha512',PAYSTACK_SECRET_KEY).update(req.rawBody||Buffer.from('')).digest('hex');if(!signature||signature!==expected)return res.sendStatus(401);const event=req.body;if(event.event==='charge.success'){const data=event.data;const order=await getOrderByReference(data.reference);if(order&&Math.round(Number(order.total)*100)===Number(data.amount))await updateOrder(order.order_number,{payment_status:'paid',order_status:'paid',paystack_transaction_id:String(data.id)});}return res.sendStatus(200);}catch(e){console.error('Webhook error',e);return res.sendStatus(500);}});

app.get('/api/orders/:orderNumber',async(req,res)=>{const o=await getOrderByNumber(req.params.orderNumber);if(!o)return res.status(404).json({error:'Order not found.'});res.json({order_number:o.order_number,payment_status:o.payment_status,order_status:o.order_status,total:Number(o.total),created_at:o.created_at});});

app.post('/api/admin/login',async(req,res)=>{const{password}=req.body||{};let ok=false;if(ADMIN_PASSWORD_HASH)ok=await bcrypt.compare(String(password||''),ADMIN_PASSWORD_HASH);else if(ADMIN_PASSWORD)ok=String(password||'')===ADMIN_PASSWORD;if(!ok)return res.status(401).json({error:'Incorrect password.'});const token=jwt.sign({role:'admin'},JWT_SECRET,{expiresIn:'7d'});res.setHeader('Set-Cookie',`sheara_admin=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);res.json({ok:true});});
app.post('/api/admin/logout',(req,res)=>{res.setHeader('Set-Cookie','sheara_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');res.json({ok:true});});
app.get('/api/admin/me',adminAuth,(req,res)=>res.json({ok:true}));
app.get('/api/admin/orders',adminAuth,async(req,res)=>res.json({orders:await readOrders()}));
app.patch('/api/admin/orders/:orderNumber',adminAuth,async(req,res)=>{const allowed=['new','processing','paid','shipped','completed','cancelled'];if(!allowed.includes(req.body?.order_status))return res.status(400).json({error:'Invalid order status.'});const o=await updateOrder(req.params.orderNumber,{order_status:req.body.order_status});if(!o)return res.status(404).json({error:'Order not found.'});res.json({order:o});});

app.get('/api/admin/products',adminAuth,async(req,res)=>res.json({products:(await readProducts()).map(p=>({...p,price:Number(p.price)}))}));
app.post('/api/admin/products',adminAuth,async(req,res)=>{try{const p=cleanProductInput(req.body);const id=String(req.body.id||`${Date.now()}_${crypto.randomBytes(3).toString('hex')}`).toLowerCase().replace(/[^a-z0-9_-]+/g,'-');if(await getProduct(id))return res.status(409).json({error:'That product ID already exists.'});const out=await upsertProduct({...p,id});globalThis.__products=await readProducts();res.json({product:{...out,price:Number(out.price)}});}catch(e){res.status(400).json({error:e.message});}});
app.patch('/api/admin/products/:id',adminAuth,async(req,res)=>{try{const existing=await getProduct(req.params.id);if(!existing)return res.status(404).json({error:'Product not found.'});const p=cleanProductInput({...existing,...req.body});const out=await upsertProduct({...p,id:existing.id},existing.id);globalThis.__products=await readProducts();res.json({product:{...out,price:Number(out.price)}});}catch(e){res.status(400).json({error:e.message});}});
app.delete('/api/admin/products/:id',adminAuth,async(req,res)=>{const existing=await getProduct(req.params.id);if(!existing)return res.status(404).json({error:'Product not found.'});await deleteProduct(req.params.id);globalThis.__products=await readProducts();res.json({ok:true});});
app.get('/api/admin/settings',adminAuth,async(req,res)=>res.json({settings:await readSettings()}));
app.patch('/api/admin/settings',adminAuth,async(req,res)=>{const a=Number(req.body?.delivery_accra),b=Number(req.body?.delivery_other_ghana);if(!Number.isFinite(a)||a<0||!Number.isFinite(b)||b<0)return res.status(400).json({error:'Enter valid delivery fees.'});const s={delivery_accra:a,delivery_other_ghana:b};await writeSettings(s);globalThis.__settings=s;res.json({settings:s});});

app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public/admin/index.html')));
app.get('/success.html',(req,res)=>res.sendFile(path.join(__dirname,'public/success.html')));

ensureDb().then(async()=>{globalThis.__products=await readProducts();globalThis.__settings=await readSettings();app.listen(PORT,()=>console.log(`Sheara running on ${SITE_URL}`));}).catch(err=>{console.error(err);process.exit(1)});
