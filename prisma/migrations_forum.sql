-- Forum communautaire : categories, sujets, reponses, reactions.
CREATE TABLE IF NOT EXISTS "forum_categories" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "icon"        TEXT,
  "color"       TEXT,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "forum_topics" (
  "id"          TEXT PRIMARY KEY,
  "categoryId"  TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "userName"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "pinned"      BOOLEAN NOT NULL DEFAULT false,
  "locked"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReplyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "forum_topics_cat_idx" ON "forum_topics" ("categoryId");

CREATE TABLE IF NOT EXISTS "forum_replies" (
  "id"        TEXT PRIMARY KEY,
  "topicId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "userName"  TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "forum_replies_topic_idx" ON "forum_replies" ("topicId");

CREATE TABLE IF NOT EXISTS "forum_likes" (
  "id"        TEXT PRIMARY KEY,
  "kind"      TEXT NOT NULL,
  "refId"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "forum_likes_unique" ON "forum_likes" ("kind", "refId", "userId");
CREATE INDEX IF NOT EXISTS "forum_likes_ref_idx" ON "forum_likes" ("refId");

-- Catégories par défaut (la direction peut les renommer / en ajouter).
INSERT INTO "forum_categories" ("id", "name", "description", "icon", "color", "order") VALUES
  ('cat_annonces', 'Annonces',         'Informations officielles de l''agence.',                 '📣', '#B8966A', 1),
  ('cat_idees',    'Idées & astuces',  'Partagez vos bonnes pratiques et astuces du métier.',    '💡', '#2563EB', 2),
  ('cat_metier',   'Questions métier', 'Entraide : posez vos questions, répondez à vos collègues.', '🏠', '#059669', 3),
  ('cat_agence',   'Vie de l''agence', 'Événements, organisation, sujets internes.',              '🤝', '#7C3AED', 4),
  ('cat_detente',  'Détente',          'Discussions libres, humeur du jour, hors sujet.',         '☕', '#C2710C', 5)
ON CONFLICT ("id") DO NOTHING;
