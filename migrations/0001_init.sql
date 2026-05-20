-- zfb-example-webshop — initial schema.
--
-- Applied by `wrangler d1 migrations apply webshop` (--local for dev,
-- --remote in CI). Wrangler tracks applied files in the d1_migrations
-- table so this runs exactly once per database.

-- Catalogue. Seeded by 0002_seed_products.sql.
CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  category    TEXT NOT NULL,
  emoji       TEXT NOT NULL
);

-- Users. Created via the /signup route — never seeded.
-- password_hash / password_salt: PBKDF2(SHA-256, 100k iterations),
-- 256-bit digest + per-user 16-byte salt, both stored as hex.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Server-side sessions. `id` is the opaque 32-byte-hex cookie value.
-- Expired rows are swept lazily on read (expires_at > datetime('now')).
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- The active cart for a user — one row per (user, product). Quantity is
-- collapsed into a single row; adding an existing product bumps qty.
CREATE TABLE cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL DEFAULT 1,
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id)
);

-- A completed purchase. Checkout moves cart_items into order_items and
-- empties the cart.
CREATE TABLE orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  total_cents INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Line items of a completed order. price_cents is captured at purchase
-- time so a later catalogue price change does not rewrite order history.
CREATE TABLE order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  quantity    INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_cart_items_user ON cart_items (user_id);
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_order_items_order ON order_items (order_id);
