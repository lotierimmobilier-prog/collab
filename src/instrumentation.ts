// Démarrage du serveur Next.js : on s'assure que les migrations SQL
// idempotentes sont bien appliquées en base — via la connexion Prisma de
// l'application (qui, elle, fonctionne toujours), en complément du script
// d'entrée qui utilise psql. Cela garantit que les colonnes/tables récentes
// (gedAccess, parrainId, tables Formation…) existent réellement.

export async function register() {
  // Uniquement côté serveur Node (pas Edge), et seulement si la base est configurée.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;

  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { prisma } = await import("@/lib/prisma");

    // Ordre identique à docker-entrypoint.sh
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
    ];

    let applied = 0, ignored = 0;
    for (const f of FILES) {
      const p = join(process.cwd(), "prisma", f);
      if (!existsSync(p)) continue;
      const sql = readFileSync(p, "utf8");
      for (const stmt of splitSql(sql)) {
        try {
          await prisma.$executeRawUnsafe(stmt);
          applied++;
        } catch {
          // Idempotent : « already exists / duplicate » → on ignore.
          ignored++;
        }
      }
    }
    console.log(`[migrations] vérification Prisma terminée (${applied} ok, ${ignored} déjà appliqués/ignorés).`);
  } catch (e) {
    console.error("[migrations] échec de la vérification au démarrage :", e);
    // On ne bloque jamais le démarrage du serveur.
  }
}

// Découpe un fichier SQL en instructions, en respectant les chaînes ('…')
// et les blocs « dollar-quote » ($$ … $$ ou $tag$ … $tag$) pour ne pas
// couper au milieu d'une fonction plpgsql ou d'un bloc DO.
function splitSql(sql: string): string[] {
  const stmts: string[] = [];
  let cur = "";
  let inString = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        cur += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
      } else {
        cur += c;
      }
      continue;
    }

    if (inString) {
      cur += c;
      if (c === "'") inString = false;
      continue;
    }

    // Début d'un bloc dollar-quote ?
    if (c === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        cur += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (c === "'") { inString = true; cur += c; continue; }

    if (c === ";") { stmts.push(cur.trim()); cur = ""; continue; }

    cur += c;
  }
  if (cur.trim()) stmts.push(cur.trim());

  // On retire les fragments vides ou composés uniquement de commentaires.
  return stmts.filter(s => {
    const noComments = s.replace(/--[^\n]*/g, "").trim();
    return noComments.length > 0;
  });
}
