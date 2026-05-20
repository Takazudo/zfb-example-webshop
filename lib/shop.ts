/** Catalogue, cart, and checkout queries against D1. */

import type { Env } from "./env";
import type { CartLine, OrderLine, Product } from "./types";

/** All products, ordered for stable display. */
export async function listProducts(env: Env): Promise<Product[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, description, price_cents, category, emoji FROM products ORDER BY id",
  ).all<Product>();
  return results;
}

/** A single product by id, or null. */
export async function getProduct(env: Env, id: number): Promise<Product | null> {
  return env.DB.prepare(
    "SELECT id, name, description, price_cents, category, emoji FROM products WHERE id = ?",
  )
    .bind(id)
    .first<Product>();
}

/** The current user's cart, each line joined with its product. */
export async function getCart(env: Env, userId: number): Promise<CartLine[]> {
  const { results } = await env.DB.prepare(
    `SELECT p.id AS product_id, p.name AS name, p.emoji AS emoji,
            p.price_cents AS price_cents, c.quantity AS quantity
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
      WHERE c.user_id = ?
      ORDER BY c.added_at, p.id`,
  )
    .bind(userId)
    .all<CartLine>();
  return results;
}

/** Total item count in the cart (sum of quantities). Used for the header badge. */
export async function getCartCount(env: Env, userId: number): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(quantity), 0) AS n FROM cart_items WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Add one unit of a product to the user's cart. Adding a product
 * already in the cart bumps its quantity (the UNIQUE(user_id,
 * product_id) constraint drives the upsert).
 */
export async function addToCart(env: Env, userId: number, productId: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES (?, ?, 1)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = quantity + 1`,
  )
    .bind(userId, productId)
    .run();
}

/** Remove a product line from the cart entirely. */
export async function removeFromCart(env: Env, userId: number, productId: number): Promise<void> {
  await env.DB.prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?")
    .bind(userId, productId)
    .run();
}

/** A completed order plus its line items, for the confirmation page. */
export interface OrderSummary {
  id: number;
  total_cents: number;
  created_at: string;
  items: OrderLine[];
}

/**
 * Check out the user's cart: snapshot every cart line into an `orders`
 * + `order_items` record, then empty the cart. Returns the new order's
 * id, or null when the cart is empty.
 *
 * D1 has no interactive transactions; `batch()` runs the writes
 * atomically. The order row is inserted first (separately) because the
 * line-item inserts need its generated id.
 */
export async function checkout(env: Env, userId: number): Promise<number | null> {
  const cart = await getCart(env, userId);
  if (cart.length === 0) return null;

  const total = cart.reduce((sum, line) => sum + line.price_cents * line.quantity, 0);

  const orderInsert = await env.DB.prepare(
    "INSERT INTO orders (user_id, total_cents) VALUES (?, ?)",
  )
    .bind(userId, total)
    .run();
  const orderId = Number(orderInsert.meta.last_row_id);

  const statements = cart.map((line) =>
    env.DB.prepare(
      `INSERT INTO order_items (order_id, product_id, name, price_cents, quantity)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(orderId, line.product_id, line.name, line.price_cents, line.quantity),
  );
  statements.push(env.DB.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(userId));
  await env.DB.batch(statements);

  return orderId;
}

/** Load a completed order owned by the user (404s otherwise). */
export async function getOrder(
  env: Env,
  userId: number,
  orderId: number,
): Promise<OrderSummary | null> {
  const order = await env.DB.prepare(
    "SELECT id, total_cents, created_at FROM orders WHERE id = ? AND user_id = ?",
  )
    .bind(orderId, userId)
    .first<{ id: number; total_cents: number; created_at: string }>();
  if (!order) return null;

  const { results } = await env.DB.prepare(
    "SELECT name, price_cents, quantity FROM order_items WHERE order_id = ? ORDER BY id",
  )
    .bind(orderId)
    .all<OrderLine>();

  return { ...order, items: results };
}
