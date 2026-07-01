-- QCM du parrain (auto-evaluation) : memes questions que le filleul, mais
-- reponses PRIVEES du parrain. Le filleul n y a jamais acces. Table geree par l app.
CREATE TABLE IF NOT EXISTS parrain_quiz_results (
  id             TEXT PRIMARY KEY,
  "parrainId"    TEXT NOT NULL,
  "competenceId" TEXT NOT NULL,
  quiz           JSONB,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS parrain_quiz_unique ON parrain_quiz_results("parrainId", "competenceId");
