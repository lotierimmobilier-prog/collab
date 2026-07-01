-- Planning parrainage : un creneau propose par le parrain ou le filleul,
-- partage sur le meme planning et confirme apres validation des deux.
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "parrainage" BOOLEAN NOT NULL DEFAULT false;
-- Liste des identifiants utilisateurs ayant valide le creneau (proposeur inclus).
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "approvedBy" JSONB;
