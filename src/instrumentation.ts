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

  // Relances d'assurance : idempotentes, déclenchées peu après le boot puis
  // toutes les 12 h. (Un /api/cron dédié permet aussi un déclenchement externe.)
  scheduleInsuranceReminders();
}

let insuranceScheduled = false;
function scheduleInsuranceReminders() {
  if (insuranceScheduled) return;
  insuranceScheduled = true;
  const run = async () => {
    try {
      const { runInsuranceReminders } = await import("@/lib/insurance-reminders");
      const r = await runInsuranceReminders();
      if (r.sent || r.errors) console.log(`[assurance] relances : ${r.sent} envoyées, ${r.checked} contrôlées, ${r.errors} échecs`);
    } catch (e) {
      console.error("[assurance] échec des relances :", e);
    }
  };
  setTimeout(run, 60_000).unref?.();
  setInterval(run, 12 * 60 * 60 * 1000).unref?.();
}
