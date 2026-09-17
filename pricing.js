window.ShearaPricing = (() => {
  const fallback = {
    currency: 'GHS', country: 'GH', usdToGhsRate: 11.5,
    products: {
      'lotion-50': {name:'Sheara Lotion — 50ml', price:15, priceGhs:15, priceUsd:1.30, image:'assets/lotion-50ml.jpeg'},
      'lotion-100': {name:'Sheara Lotion — 100ml', price:25, priceGhs:25, priceUsd:2.17, image:'assets/lotion-100ml.jpeg'},
      'glow-cream': {name:'Sheara Glow Body Cream — 500ml', price:65, priceGhs:65, priceUsd:5.65, image:'assets/glow-body-cream.jpeg'}
    }
  };
  let state = fallback;
  const money = (n, currency=state.currency) => new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:2}).format(Number(n));
  async function load(country='') {
    try {
      const qs = country ? `?country=${encodeURIComponent(country)}` : '';
      const r = await fetch('/api/storefront'+qs,{headers:{Accept:'application/json'}});
      if (r.ok) state = await r.json();
    } catch {}
    window.dispatchEvent(new CustomEvent('sheara:pricing-ready',{detail:state}));
    return state;
  }
  function get(){return state;}
  return {load,get,money};
})();
