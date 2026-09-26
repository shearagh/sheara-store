# Sheara Store

## What this version includes
- Luxury Sheara storefront with approved hero image
- Direct checkout through Paystack
- Server-side Paystack initialization + verification + webhook signature checking
- Admin dashboard at `/admin`
- Admin product management: add, edit, price, description, image, hide/show, delete
- Admin delivery-fee settings
- Customer order and delivery dashboard

## Local test
1. Install Node.js 18+
2. In this folder run `npm install`
3. Copy `.env.example` to `.env`
4. Add your Paystack **test secret key** and admin password/hash.
5. Set delivery fees.
6. Run `npm start` and open `http://localhost:3000`.
7. Admin: `http://localhost:3000/admin`.

## Production
Use a hosted Node service such as Render and a managed Postgres database. Set the environment variables in the host dashboard, not in the browser.

Paystack callback: `https://YOUR-DOMAIN/api/paystack/callback`
Paystack webhook: `https://YOUR-DOMAIN/api/paystack/webhook`

Use Paystack Test Mode first. Switch to live keys only after the complete test flow works.
