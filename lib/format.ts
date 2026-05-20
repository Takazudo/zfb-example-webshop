/** Format an integer cents amount as a USD price string, e.g. 3980 → "$39.80". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
