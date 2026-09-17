SHEARA WEBSITE — VERSION 17

Included:
- Responsive premium homepage with an ingredient-led shea hero visual
- Real Sheara product photography
- Product pages for 50ml, 100ml and 500ml products
- Shopping bag with local cart persistence
- Dedicated checkout flow
- Paystack-ready server integration (GHS; card + mobile money)
- Retailer / stockist enquiry flow to WhatsApp
- Our Story, Journal and Customer Care pages
- Ingredient education and Sheara ritual sections
- Lotion size selector and refined product-page UX
- Accessibility polish (Escape-to-close overlays/menus)
- Lazy-loaded below-fold product imagery for better page performance
- Mobile navigation
- SEO metadata and robots.txt foundation

BEFORE LIVE LAUNCH:
1. Choose and connect the final domain.
2. Set SITE_URL and PAYSTACK_SECRET_KEY as server environment variables. Never place the secret key in frontend code.
3. Test Paystack in test mode from checkout through callback/webhook.
4. Confirm delivery partner, delivery zones and delivery charges.
5. Replace placeholder customer-care policy wording with final business policies.
6. Add genuine customer reviews only.
7. Confirm final product labels, claims and regulatory requirements before publishing.
8. Connect a real email/newsletter service if automated newsletter subscriptions are required.
9. Optimise final production images if page speed requires it.

The site deliberately does not invent FDA approval/registration claims, customer reviews, delivery pricing or a final domain.


PRICING / CURRENCY ADMIN
- Product prices are stored in data/pricing.json, not hard-coded into checkout.
- Each product has an editable GHS price and international USD display price.
- USD-to-GHS conversion rate is editable in the admin dashboard.
- Admin dashboard: /admin.html
- Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET as server environment variables before deployment.
- Ghana customers are shown GHS; international customers are shown USD. Country can come from the customer account/checkout and supported geo headers.
- Paystack is initialized in GHS for this Ghana-based merchant; international USD display is converted to the GHS equivalent for the Paystack transaction.
- Do not treat the initial USD values as final international retail pricing; review them in Admin before launch.


VERSION 17 PAYMENT + CHECKOUT FOUNDATION
---------------------------------------
- Multi-provider shipping architecture stored in PostgreSQL site settings. Providers can be enabled/disabled and added from the admin Shipping tab.
- Starter provider catalog includes DHL, FedEx, UPS, Ghana Post and Local Courier; these are disabled by default except Ghana delivery itself remains enabled with a zero fee.
- International countries are explicitly allow-listed before checkout can accept them.
- Checkout asks the customer to choose an enabled delivery provider. Shipping fee is included in the Paystack amount. Ghana-based Paystack checkout is sent in GHS.
- Admin can record tracking numbers and update fulfilment status.
- Inventory policy now follows Sheara's requested rule: cart and checkout do NOT reserve stock. Verified successful payment triggers an atomic stock check/deduction and inventory movement.
- If payment succeeds but stock is unavailable at the final atomic confirmation, the order is marked paid_stock_unavailable for manual refund/alternative-product handling rather than silently overselling.
- Paystack webhook signatures remain verified using HMAC SHA512. Payment processing is idempotent for already-paid orders.
- Before production launch, connect PostgreSQL, set Paystack live credentials, finalize policies, configure shipping providers/rates, confirm destination-country cosmetics requirements, and load-test the application.

International compliance note
-----------------------------
Ghana FDA requirements for exporting regulated cosmetics can include an approved export permit and Manufacture and Free Sale Certificate, with export inspection and supporting documentation. Destination-country rules and carrier acceptance must also be confirmed before enabling a country/provider.


VERSION 17 CHANGES
-------------------
- Fixed checkout total/shipping rendering so the submit button and totals correctly reflect the selected delivery option.
- Paystack webhook processing acknowledges valid events immediately and processes fulfilment asynchronously, reducing webhook timeout/retry risk.
- Server health/version reports Version 17.
- No shipping provider is activated by default; provider/rate configuration remains intentionally deferred until Sheara chooses its delivery partners.


V17 notes:
- Inventory is not reserved during cart or checkout; stock is deducted only after verified payment.
- Removed the unused inventory reservation table and cleanup cron.
- Shipping providers remain configurable but inactive until Sheara selects delivery partners.


VERSION 17 WEBSITE EDITABILITY
-------------------------------
- Admin website-content editor now includes the hero image path/URL.
- Homepage hero copy and hero image are loaded from the site configuration when available.
- Product records retain editable image paths/URLs so packaging/product visuals can be replaced without changing the storefront HTML.
- The current build does not include binary media upload storage; production media uploads should later use durable object storage rather than the application filesystem.
