let store = window.ShearaPricing?.get() || {currency:'GHS',products:{}};
let cart = JSON.parse(localStorage.getItem('shearaCart') || '[]');
const itemsBox = document.getElementById('checkoutItems');
const form = document.getElementById('fullCheckoutForm');
const button = form.querySelector('button[type=submit]');
const message = document.getElementById('checkoutMessage');
const country = document.getElementById('country');
const shippingOptions = document.getElementById('shippingOptions');
const shippingStatus = document.getElementById('shippingStatus');
let shipping = {enabled:false,options:[]};
let selectedShipping = null;

function money(n){ return window.ShearaPricing?.money ? window.ShearaPricing.money(n, store.currency) : `${store.currency} ${Number(n).toFixed(2)}`; }
async function loadShipping(){try{const r=await fetch('/api/shipping-options?country='+encodeURIComponent(country.value));shipping=await r.json();selectedShipping=shipping.options?.find(x=>x.default)?.id||shipping.options?.[0]?.id||null;renderShipping();refresh();}catch(e){shipping={enabled:false,options:[]};selectedShipping=null;renderShipping();refresh();}}
function renderShipping(){if(!shippingOptions)return;if(!shipping.enabled||!shipping.options?.length){shippingOptions.innerHTML='<div class="notice">Delivery is not currently available for this destination. Please choose another country.</div>';shippingStatus.textContent='No delivery option is currently available.';return;}shippingStatus.textContent=shipping.zone==='international'?'International delivery is available for this destination.':'Ghana delivery is available.';shippingOptions.innerHTML=shipping.options.map(o=>`<label class="shipping-option"><input type="radio" name="shippingProvider" value="${o.id}" ${o.id===selectedShipping?'checked':''}><span><strong>${o.name}</strong><small>${o.feeGhs?money(o.feeGhs):'Included'}${o.notes?' · '+o.notes:''}</small></span></label>`).join('');shippingOptions.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{selectedShipping=i.value;refresh();}));}
function selectedShippingData(){return shipping.options?.find(x=>x.id===selectedShipping)||null;}
function refresh(){
  const priced = store.products || {};
  cart = cart.filter(item => priced[item.id]);
  cart.forEach(item => { const p=priced[item.id]; item.price=p.price; item.name=p.name; item.image=p.image; });
  localStorage.setItem('shearaCart',JSON.stringify(cart));
  const subtotal = cart.reduce((sum,item)=>sum + item.price*item.qty,0);
  if (!cart.length) {
    itemsBox.innerHTML = `<div class="checkout-empty"><h3>Your bag is empty.</h3><p>Add something from the Sheara collection before checking out.</p><a class="button button-dark" href="index.html#shop">Shop Sheara</a></div>`;
    button.disabled = true;
  } else {
    itemsBox.innerHTML = cart.map(item => `<div class="checkout-item"><img src="${item.image}" alt="${item.name}"><div><h3>${item.name}</h3><p>Qty ${item.qty} · ${money(item.price)} each</p></div><strong>${money(item.price*item.qty)}</strong></div>`).join('');
    button.disabled = !selectedShippingData();
  }
  document.getElementById('pageSubtotal').textContent = money(subtotal);
  const sh = selectedShippingData();
  const shippingDisplay = sh ? Number(sh.feeGhs || 0) : 0;
  document.getElementById('pageDelivery').textContent = sh ? money(shippingDisplay) : '—';
  const total = subtotal + shippingDisplay;
  document.getElementById('pageTotal').textContent = money(total);
  const note=document.getElementById('currencyNote');
  if(note) note.textContent = store.currency === 'USD' ? 'Your prices are displayed in USD. Because Sheara is a Ghana-based Paystack business, the payment is processed in the GHS equivalent at checkout.' : 'Your payment is processed securely by Paystack. Sheara never sees or stores your card or mobile-money PIN.';
}
function showMessage(text,isError=false){if(!message)return;message.textContent=text;message.className=`checkout-message ${isError?'error':''}`;message.hidden=false;}

country.addEventListener('change', async()=>{
  localStorage.setItem('shearaCountry',country.value);
  store = await window.ShearaPricing.load(country.value);
  await loadShipping();
});

window.addEventListener('sheara:pricing-ready',e=>{store=e.detail; if(!localStorage.getItem('shearaCountry') && store.country) country.value=store.country; loadShipping();});

form.addEventListener('submit', async e=>{
  e.preventDefault(); if(!cart.length)return;
  const data=Object.fromEntries(new FormData(form).entries());
  const sh=selectedShippingData(); if(!sh){showMessage('Please choose an available delivery option.',true);button.disabled=false;button.textContent='Continue to payment';return;}
  data.shippingProvider=sh.id; data.shippingMethod=sh.name;
  button.disabled=true;button.textContent='Opening secure payment…';showMessage('Connecting securely to Paystack…');
  try{
    const response=await fetch('/api/paystack/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:data,items:cart.map(item=>({id:item.id,qty:item.qty}))})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to start payment.');
    localStorage.setItem('shearaPendingOrder',JSON.stringify({reference:result.reference,customer:data,items:cart}));window.location.href=result.authorizationUrl;
  }catch(error){console.error(error);showMessage(error.message||'We could not start your payment. Please try again.',true);button.disabled=false;button.textContent='Continue to payment';}
});

if (localStorage.getItem('shearaCountry')) { country.value=localStorage.getItem('shearaCountry'); window.ShearaPricing.load(localStorage.getItem('shearaCountry')).then(loadShipping); }
else { window.ShearaPricing.load().then(loadShipping); }
document.getElementById('year').textContent=new Date().getFullYear();
