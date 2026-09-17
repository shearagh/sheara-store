let store = window.ShearaPricing?.get() || null;
let cart = [];
try { cart = JSON.parse(localStorage.getItem('shearaCart') || '[]'); } catch { cart = []; }
const currentCountry = localStorage.getItem('shearaCountry') || '';
async function loadSiteContent(){
  if(!document.getElementById('heroText')) return;
  try{
    const r=await fetch('/api/site-config');
    if(!r.ok) return;
    const d=await r.json(), c=d.content||{};
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.textContent=v;};
    set('heroEyebrow',c.heroEyebrow); set('heroText',c.heroText); set('heroCta',c.heroCta);
    const title=document.getElementById('heroTitle');
    if(title&&c.heroTitle) title.textContent=c.heroTitle;
    const img=document.getElementById('heroImage');
    if(img&&c.heroImage){img.src=c.heroImage;img.alt='Sheara shea-powered body care';}
  }catch{}
}
loadSiteContent();

function products(){ return store?.products || {}; }
function money(n){ return window.ShearaPricing?.money ? window.ShearaPricing.money(n, store?.currency || 'GHS') : `${store?.currency || 'GHS'} ${Number(n).toFixed(2)}`; }
function renderProducts(){
  const grid=document.getElementById('storeProductGrid'); if(!grid)return;
  const list=Object.values(products()).filter(p=>p.active!==false);
  grid.innerHTML=list.map(p=>`<article class="product-card" data-id="${p.id}"><div class="product-image"><img src="${p.image}" alt="${p.name}${p.size?' '+p.size:''}" loading="lazy"><a class="product-view" href="product.html?id=${encodeURIComponent(p.id)}">View product</a><button class="quick-add" data-add="${p.id}" type="button">Add to bag</button></div><div class="product-meta"><div><h3>${p.name}</h3><span>${p.size||p.category||''}</span></div><strong class="price">${money(p.price)}</strong></div><p>${p.description||''}</p></article>`).join('');
  grid.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.add)));
}
function syncCartPrices(){ const ps=products();cart=cart.filter(i=>ps[i.id]);cart.forEach(i=>{i.name=ps[i.id].name;i.image=ps[i.id].image;i.price=ps[i.id].price;});localStorage.setItem('shearaCart',JSON.stringify(cart)); }
function renderCart(){
  const box=document.getElementById('cartItems'),countEl=document.getElementById('cartCount'),sub=document.getElementById('subtotal'),total=document.getElementById('checkoutTotal');
  const count=cart.reduce((s,i)=>s+i.qty,0),subtotal=cart.reduce((s,i)=>s+i.qty*i.price,0);if(countEl)countEl.textContent=count;if(sub)sub.textContent=money(subtotal);if(total)total.textContent=money(subtotal);if(!box)return;
  if(!cart.length){box.innerHTML='<p class="empty">Your bag is empty.</p>';return;}
  box.innerHTML=cart.map(i=>`<div class="cart-row"><img src="${i.image}" alt="${i.name}"><div><h4>${i.name}</h4><p>${money(i.price)} each</p><div class="qty"><button type="button" data-qty="${i.id}" data-change="-1" aria-label="Decrease quantity">−</button><span>${i.qty}</span><button type="button" data-qty="${i.id}" data-change="1" aria-label="Increase quantity">+</button><button type="button" class="remove" data-remove="${i.id}">Remove</button></div></div><strong>${money(i.price*i.qty)}</strong></div>`).join('');
}
function add(id,quantity=1){const p=products()[id];if(!p)return;const existing=cart.find(i=>i.id===id);if(existing)existing.qty=Math.min(20,existing.qty+quantity);else cart.push({id,name:p.name,image:p.image,price:p.price,qty:Math.min(20,quantity)});localStorage.setItem('shearaCart',JSON.stringify(cart));renderCart();openDrawer();}
function openDrawer(){document.getElementById('cartDrawer')?.classList.add('open');document.getElementById('overlay')?.classList.add('open');}
function closeDrawer(){document.getElementById('cartDrawer')?.classList.remove('open');document.getElementById('overlay')?.classList.remove('open');}
function openCheckout(){if(!cart.length){alert('Your bag is empty.');return;}window.location.href='checkout.html';}
window.ShearaStore={products,money,getCurrency:()=>store?.currency||'GHS'};
window.addEventListener('sheara:pricing-ready',e=>{store=e.detail;syncCartPrices();renderProducts();renderCart();});
document.getElementById('openCart')?.addEventListener('click',openDrawer);document.getElementById('closeCart')?.addEventListener('click',closeDrawer);document.getElementById('overlay')?.addEventListener('click',closeDrawer);document.getElementById('checkoutButton')?.addEventListener('click',openCheckout);
document.getElementById('cartItems')?.addEventListener('click',e=>{const id=e.target.dataset.qty;if(id){const item=cart.find(i=>i.id===id);if(item){item.qty+=Number(e.target.dataset.change);if(item.qty<=0)cart=cart.filter(x=>x.id!==id);item.qty=Math.min(20,item.qty);localStorage.setItem('shearaCart',JSON.stringify(cart));renderCart();}}const remove=e.target.dataset.remove;if(remove){cart=cart.filter(i=>i.id!==remove);localStorage.setItem('shearaCart',JSON.stringify(cart));renderCart();}});
const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
const mobileToggle=document.getElementById('mobileMenuToggle'),mobileNav=document.getElementById('mobileNav');if(mobileToggle&&mobileNav){mobileToggle.addEventListener('click',()=>{const open=mobileNav.classList.toggle('open');mobileToggle.setAttribute('aria-expanded',open?'true':'false');mobileToggle.setAttribute('aria-label',open?'Close menu':'Open menu');document.body.classList.toggle('menu-open',open);});mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mobileNav.classList.remove('open');mobileToggle.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');}));}
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;closeDrawer();if(mobileNav?.classList.contains('open')){mobileNav.classList.remove('open');mobileToggle?.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');}});
renderCart();window.ShearaPricing?.load(currentCountry);
