-- ═══════════════════════════════════════════════════════════════
-- Migration Annuaire — table contacts (carnet d'adresses unifié)
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_annuaire.sql
-- Idempotent : peut être rejoué sans risque.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contacts (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL DEFAULT 'autre',
  prenom          TEXT,
  nom             TEXT,
  "raisonSociale" TEXT,
  email           TEXT,
  phone           TEXT,
  note            TEXT,
  "sourceType"    TEXT,
  "sourceId"      TEXT,
  "createdById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (email);
CREATE INDEX IF NOT EXISTS contacts_type_idx  ON contacts (type);

-- Trigger updatedAt (la fonction update_updated_at existe déjà via migrations_vps.sql)
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
