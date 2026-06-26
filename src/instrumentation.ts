// Au démarrage du serveur, on s'assure que les migrations SQL idempotentes
// sont appliquées via la connexion Prisma de l'application (fiable même quand
// psql ne peut pas se connecter). Voir aussi /api/admin/migrate (déclenchement
// manuel et observable).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;
  try {
    const { runMigrations } = await import("@/lib/run-migrations");
    const r = await runMigrations();
    console.log(`[migrations] démarrage : ${r.applied} ok, ${r.ignored} ignorés ; colonnes=${JSON.stringify(r.columns)}`);
  } catch (e) {
    console.error("[migrations] échec au démarrage :", e);
  }
}
