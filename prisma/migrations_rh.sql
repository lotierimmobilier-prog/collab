-- Module RH : demandes de congés + relevés d'heures mensuels signés. Idempotent.

CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'conges_payes',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "halfDayStart" BOOLEAN NOT NULL DEFAULT false,
  "halfDayEnd" BOOLEAN NOT NULL DEFAULT false,
  "days" DOUBLE PRECISION,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'en_attente',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "leave_requests_userId_idx" ON "leave_requests"("userId");

CREATE TABLE IF NOT EXISTS "monthly_hours" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "totalHours" DOUBLE PRECISION,
  "entries" JSONB,
  "note" TEXT,
  "agentSigned" BOOLEAN NOT NULL DEFAULT false,
  "agentSignedAt" TIMESTAMP(3),
  "agentSignatureName" TEXT,
  "agentSignatureIp" TEXT,
  "status" TEXT NOT NULL DEFAULT 'brouillon',
  "validatedById" TEXT,
  "validatedAt" TIMESTAMP(3),
  "validationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_hours_user_month_key" ON "monthly_hours"("userId", "month");
