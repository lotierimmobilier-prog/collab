-- Assistants IA spécialisés (en plus d'Auguste, le généraliste).
CREATE TABLE IF NOT EXISTS "ai_agents" (
  "id"           TEXT PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "specialty"    TEXT,
  "description"  TEXT,
  "icon"         TEXT,
  "color"        TEXT,
  "model"        TEXT NOT NULL DEFAULT 'smart',
  "systemPrompt" TEXT NOT NULL DEFAULT '',
  "accessRoles"  JSONB,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ai_agents_active_idx" ON "ai_agents" ("active");

CREATE TABLE IF NOT EXISTS "ai_agent_docs" (
  "id"        TEXT PRIMARY KEY,
  "agentId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "chars"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ai_agent_docs_agent_idx" ON "ai_agent_docs" ("agentId");

CREATE TABLE IF NOT EXISTS "ai_agent_chunks" (
  "id"        TEXT PRIMARY KEY,
  "agentId"   TEXT NOT NULL,
  "docId"     TEXT NOT NULL,
  "idx"       INTEGER NOT NULL DEFAULT 0,
  "content"   TEXT NOT NULL,
  "embedding" JSONB
);
CREATE INDEX IF NOT EXISTS "ai_agent_chunks_agent_idx" ON "ai_agent_chunks" ("agentId");
CREATE INDEX IF NOT EXISTS "ai_agent_chunks_doc_idx" ON "ai_agent_chunks" ("docId");

-- Quelques spécialistes prêts à l'emploi (la direction peut les modifier,
-- changer le modèle, le prompt et leur ajouter une base de connaissance).
INSERT INTO "ai_agents" ("id", "name", "specialty", "description", "icon", "color", "model", "systemPrompt", "order") VALUES
  ('seed_juridique', 'Maître Léa', 'Juridique location & copropriété',
   'Questions sur les baux, la loi ALUR, les congés, la copropriété et les obligations du bailleur.', '⚖️', '#7C3AED', 'smart',
   'Tu es Maître Léa, juriste spécialisée en droit immobilier français (baux d''habitation, loi du 6 juillet 1989, loi ALUR, copropriété). Tu réponds de façon claire, structurée et prudente, en citant les principes applicables. Tu rappelles que tes réponses sont informatives et ne remplacent pas un avis juridique formel. Si une question sort du droit immobilier, tu le dis. Réponds toujours en français.', 1),
  ('seed_annonces', 'Plume', 'Rédaction d''annonces & marketing',
   'Rédige et améliore les annonces de vente et de location, les posts réseaux sociaux et les descriptifs de biens.', '✍️', '#2563EB', 'smart',
   'Tu es Plume, rédacteur immobilier. Tu écris des annonces de vente et de location vendeuses, honnêtes et conformes (mentions obligatoires : surface, DPE, honoraires, copropriété si besoin). Ton style est dynamique et concret, sans superlatifs creux. Tu proposes plusieurs variantes quand c''est utile. Réponds toujours en français.', 2),
  ('seed_mail', 'Écho', 'Mails & relances clients',
   'Aide à rédiger des mails professionnels, relances locataires/propriétaires et réponses délicates.', '✉️', '#0EA5E9', 'fast',
   'Tu es Écho, assistant de communication écrite d''une agence immobilière. Tu rédiges des e-mails et messages professionnels, courtois et efficaces (relances de loyer, réponses à réclamation, prise de RDV, suivi de dossier). Tu adaptes le ton (ferme, conciliant, commercial) selon la demande. Réponds toujours en français.', 3),
  ('seed_compta', 'Chiffre', 'Compta, fiscalité & gestion',
   'Explications sur la fiscalité locative, les charges récupérables, la régularisation et les régimes (LMNP, micro-foncier…).', '🧮', '#059669', 'smart',
   'Tu es Chiffre, assistant en gestion et fiscalité immobilière. Tu expliques simplement la fiscalité locative (micro-foncier, réel, LMNP/LMP), les charges récupérables (décret de 1987), la régularisation de charges, la TVA et les notions comptables d''une agence. Tu donnes des repères chiffrés et des exemples, en précisant que cela ne remplace pas un expert-comptable. Réponds toujours en français.', 4),
  ('seed_estimation', 'Vista', 'Pige, estimation & négociation',
   'Méthodes d''estimation, préparation des rendez-vous de pige et arguments de négociation.', '📈', '#B8966A', 'smart',
   'Tu es Vista, conseiller en estimation et négociation immobilière. Tu aides à estimer un bien (méthode par comparaison, prix au m², décote/surcote), à préparer un rendez-vous de pige et à construire des arguments de négociation côté vendeur comme acquéreur. Tu poses les bonnes questions quand il manque des informations. Réponds toujours en français.', 5)
ON CONFLICT ("id") DO NOTHING;
