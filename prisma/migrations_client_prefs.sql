-- Préférences du locataire (espace client) : ville pour la météo quand
-- l'adresse du logement n'est pas connue. Table possédée par l'application.
CREATE TABLE IF NOT EXISTS client_prefs (
  "tenantId"  TEXT PRIMARY KEY,
  city        TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
