-- Boutique : objets logotés de l'agence (catalogue + commandes internes).
CREATE TABLE IF NOT EXISTS "shop_products" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "price"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "category"    TEXT,
  "image"       TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "shop_products_active_idx" ON "shop_products" ("active");

CREATE TABLE IF NOT EXISTS "shop_orders" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "userName"  TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'nouveau',
  "total"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "shop_orders_user_idx" ON "shop_orders" ("userId");
CREATE INDEX IF NOT EXISTS "shop_orders_status_idx" ON "shop_orders" ("status");

CREATE TABLE IF NOT EXISTS "shop_order_items" (
  "id"        TEXT PRIMARY KEY,
  "orderId"   TEXT NOT NULL,
  "productId" TEXT,
  "name"      TEXT NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qty"       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS "shop_order_items_order_idx" ON "shop_order_items" ("orderId");

-- Quelques articles d'exemple pour que la boutique ne soit pas vide au lancement.
-- La direction pourra les modifier / supprimer / compléter ensuite.
INSERT INTO "shop_products" ("id", "name", "description", "price", "category", "image", "order") VALUES
  ('seed_gourde',     'Gourde isotherme',        'Gourde inox 500 ml, logo agence gravé. Garde le chaud/froid.', 18.00, 'accessoire', '🍶', 1),
  ('seed_totebag',    'Tote bag en coton',       'Sac en coton bio, anses longues, logo sérigraphié.',          8.00, 'textile',    '👜', 2),
  ('seed_dessousverre','Dessous de verre (x4)',  'Lot de 4 dessous de verre en liège, logo gravé.',             12.00, 'bureau',     '🟫', 3),
  ('seed_serviette',  'Serviette de bain',       'Serviette éponge 70×140 cm, logo brodé.',                     22.00, 'textile',    '🛁', 4),
  ('seed_mug',        'Mug céramique',           'Mug 30 cl, logo imprimé, passe au lave-vaisselle.',           10.00, 'bureau',     '☕', 5),
  ('seed_stylo',      'Stylo métal',             'Stylo bille en métal brossé, logo gravé.',                     4.00, 'bureau',     '🖊️', 6),
  ('seed_casquette',  'Casquette',               'Casquette ajustable, logo brodé.',                            14.00, 'textile',    '🧢', 7),
  ('seed_parapluie',  'Parapluie',               'Parapluie tempête, ouverture automatique, logo imprimé.',     20.00, 'accessoire', '☂️', 8)
ON CONFLICT ("id") DO NOTHING;
