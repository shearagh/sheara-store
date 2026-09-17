CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT,
  category TEXT NOT NULL DEFAULT 'Body Care',
  description TEXT NOT NULL DEFAULT '',
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  ingredients TEXT NOT NULL DEFAULT '',
  how_to_use TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price_ghs NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_ghs >= 0),
  price_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  cost_ghs NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_ghs >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'GH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'GH',
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_currency CHAR(3) NOT NULL DEFAULT 'GHS',
  subtotal_display NUMERIC(12,2) NOT NULL,
  usd_to_ghs_rate NUMERIC(12,4) NOT NULL,
  amount_ghs NUMERIC(12,2) NOT NULL,
  amount_pesewas INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'pending_payment',
  paystack_reference TEXT,
  paystack_transaction_id TEXT,
  payment_channel TEXT,
  shipping_provider TEXT,
  shipping_method TEXT,
  shipping_fee_ghs NUMERIC(12,2) NOT NULL DEFAULT 0,
  tracking_number TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(payment_status, order_status);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee_ghs NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  size TEXT,
  image_url TEXT,
  unit_price_display NUMERIC(12,2) NOT NULL,
  unit_price_ghs NUMERIC(12,2) NOT NULL,
  unit_price_usd NUMERIC(12,2) NOT NULL,
  unit_cost_ghs NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT NOT NULL UNIQUE,
  provider_transaction_id TEXT,
  status TEXT NOT NULL,
  amount_pesewas INTEGER NOT NULL,
  currency CHAR(3) NOT NULL,
  raw_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL DEFAULT '',
  amount_ghs NUMERIC(12,2) NOT NULL CHECK (amount_ghs >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_ghs NUMERIC(12,2) NOT NULL CHECK (amount_ghs >= 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refunds_order_idx ON refunds(order_id);
