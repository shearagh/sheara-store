-- Sheara v16: inventory is never reserved during cart or checkout.
-- Payment confirmation is the only event that deducts stock.
DROP TABLE IF EXISTS inventory_reservations;
