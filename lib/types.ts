/** Row shapes mirroring the D1 schema in migrations/0001_init.sql. */

export interface Product {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  emoji: string;
}

export interface User {
  id: number;
  email: string;
}

/** A cart row joined with its product, as rendered on the cart page. */
export interface CartLine {
  product_id: number;
  name: string;
  emoji: string;
  price_cents: number;
  quantity: number;
}

export interface OrderLine {
  name: string;
  price_cents: number;
  quantity: number;
}
