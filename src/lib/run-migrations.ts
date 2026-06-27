// Applique les migrations SQL idempotentes via la connexion Prisma de
// l'application (fiable même quand psql ne peut pas se connecter).
// Utilisé au démarrage (instrumentation) et par /api/admin/migrate (manuel).
import { prisma } from "@/lib/prisma";

const FILES = [
  "migrations_vps.sql",
  "migrations_annuaire.sql",
  "migrations_cloisonnement.sql",
  "migrations_taches_completion.sql",
  "migrations_auguste_logs.sql",
  "migrations_user_phone.sql",
  "migrations_performance.sql",
  "migrations_internal_attachments.sql",
  "migrations_direction.sql",
  "migrations_comptabilite.sql",
  "migrations_vehicle_details.sql",
  "migrations_premise_details.sql",
  "migrations_task_recurrence.sql",
  "migrations_direction_meetings.sql",
  "migrations_ics.sql",
  "migrations_activity.sql",
  "migrations_gestion_ics.sql",
  "migrations_formation.sql",
  "migrations_formation_questions.sql",
  "migrations_fournisseurs.sql",
  "migrations_ods_detail.sql",
  "migrations_assistance.sql",
  "migrations_ods_exchange.sql",
  "migrations_personal_space.sql",
  "migrations_supplier_insurance.sql",
  "migrations_supplier_conformite.sql",
  "migrations_procedures.sql",
  "migrations_procedures_roles.sql",
  "migrations_rh.sql",
  "migrations_rh_decompte.sql",
  "migrations_user_employee.sql",
];

export interface MigrationReport {
  applied: number;
  ignored: number;
  files: number;
  columns: Record<string, boolean>;
  tables: Record<string, boolean>;
  error?: string;
}

export async function runMigrations(): Promise<MigrationReport> {
  const report: MigrationReport = { applied: 0, ignored: 0, files: 0, columns: {}, tables: {} };
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");

    for (const f of FILES) {
      const p = join(process.cwd(), "prisma", f);
      if (!existsSync(p)) continue;
      report.files++;
      const sql = readFileSync(p, "utf8");
      for (const stmt of splitSql(sql)) {
        try { await prisma.$executeRawUnsafe(stmt); report.applied++; }
        catch { report.ignored++; }
      }
    }

    // Vérifications utiles (présence des colonnes/tables récentes).
    report.columns = {
      "users.parrainId": await columnExists("users", "parrainId"),
      "users.gedAccess": await columnExists("users", "gedAccess"),
      "competence_validations.quiz": await columnExists("competence_validations", "quiz"),
    };
    report.tables = {
      training_modules: await tableExists("training_modules"),
      training_competences: await tableExists("training_competences"),
      competence_validations: await tableExists("competence_validations"),
      training_questions: await tableExists("training_questions"),
    };
  } catch (e) {
    report.error = e instanceof Error ? e.message : String(e);
  }
  return report;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      table, column,
    ) as { n: number }[];
    return Number(rows?.[0]?.n ?? 0) > 0;
  } catch { return false; }
}

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = $1`,
      table,
    ) as { n: number }[];
    return Number(rows?.[0]?.n ?? 0) > 0;
  } catch { return false; }
}

// Découpe un fichier SQL en instructions, en respectant les chaînes '…' et
// les blocs dollar-quote ($$ … $$) pour ne pas couper une fonction/bloc DO.
export function splitSql(sql: string): string[] {
  const stmts: string[] = [];
  let cur = "";
  let inString = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { cur += dollarTag; i += dollarTag.length - 1; dollarTag = null; }
      else cur += c;
      continue;
    }
    if (inString) { cur += c; if (c === "'") inString = false; continue; }
    if (c === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) { dollarTag = m[0]; cur += dollarTag; i += dollarTag.length - 1; continue; }
    }
    if (c === "'") { inString = true; cur += c; continue; }
    if (c === ";") { stmts.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) stmts.push(cur.trim());

  return stmts.filter(s => s.replace(/--[^\n]*/g, "").trim().length > 0);
}
