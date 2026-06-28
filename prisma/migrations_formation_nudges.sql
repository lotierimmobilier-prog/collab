-- Anti-spam des relances de formation : date du dernier rappel envoyé à un
-- parrain au sujet de ses filleuls en retard. Table possédée par l'application.
CREATE TABLE IF NOT EXISTS formation_nudges (
  "parrainId" TEXT PRIMARY KEY,
  "lastAt"    TIMESTAMP(3) NOT NULL DEFAULT now()
);
