-- Seed the catalogue with demo products. Users are NOT seeded — they
-- are created through the /signup route.

INSERT INTO products (name, description, price_cents, category, emoji) VALUES
  ('Aeropress Go',        'Compact travel coffee press that brews a clean cup anywhere.',         3980, 'Kitchen',    '☕'),
  ('Ceramic Pour-Over',   'Hand-glazed dripper for a slow, deliberate morning ritual.',           2640, 'Kitchen',    '🫖'),
  ('Linen Apron',         'Stonewashed linen apron with an adjustable crossback strap.',          4500, 'Home',       '🧵'),
  ('Cast Iron Skillet',   'Pre-seasoned 10-inch skillet that only gets better with use.',         5200, 'Kitchen',    '🍳'),
  ('Walnut Cutting Board','End-grain walnut board, gentle on knife edges and built to last.',     6800, 'Kitchen',    '🪵'),
  ('Merino Beanie',       'Lightweight merino-wool beanie in a soft heather grey.',               2900, 'Apparel',    '🧢'),
  ('Canvas Tote',         'Heavyweight cotton-canvas tote with a reinforced flat base.',          1900, 'Apparel',    '👜'),
  ('Field Notebook',      'Pocket-size dotted notebook with a lay-flat softcover binding.',        950, 'Stationery', '📓'),
  ('Brass Pen',           'Solid-brass machined pen that develops a unique patina over time.',    3400, 'Stationery', '🖊️'),
  ('Soy Candle',          'Hand-poured soy candle, cedar and sage, roughly 40 hours of burn.',    2200, 'Home',       '🕯️'),
  ('Glass Carafe',        'Borosilicate carafe with a cork stopper for water or cold brew.',      2800, 'Kitchen',    '🍶'),
  ('Wool Throw Blanket',  'Chunky-knit lambswool throw in a warm oatmeal tone.',                  7400, 'Home',       '🧶');
