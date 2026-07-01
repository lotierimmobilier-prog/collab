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
  // Relances de formation : digest aux parrains (1/parrain/7j), idempotent.
  scheduleFormationReminders();
  // Veille juridique : ré-analyse de tous les flux chaque nuit à minuit.
  scheduleVeilleRefresh();
}

let veilleScheduled = false;
function scheduleVeilleRefresh() {
  if (veilleScheduled) return;
  veilleScheduled = true;
  const run = async () => {
    try {
      const { refreshAllFeeds } = await import("@/lib/veille-refresh");
      const r = await refreshAllFeeds();
      console.log(`[veille] rafraîchissement nocturne : ${r.refreshed} flux, ${r.errors} échec(s)`);
      const { refreshAllSources } = await import("@/lib/actualite");
      const a = await refreshAllSources();
      console.log(`[actualite] rafraîchissement nocturne : ${a.refreshed} site(s), ${a.errors} échec(s)`);
    } catch (e) {
      console.error("[veille] échec du rafraîchissement nocturne :", e);
    }
  };
  // Premier déclenchement au prochain minuit (heure locale du serveur), puis
  // toutes les 24 h.
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const delay = Math.max(60_000, next.getTime() - now.getTime());
  setTimeout(() => { run(); setInterval(run, 24 * 60 * 60 * 1000).unref?.(); }, delay).unref?.();
}

let formationScheduled = false;
function scheduleFormationReminders() {
  if (formationScheduled) return;
  formationScheduled = true;
  const run = async () => {
    try {
      const { runFormationReminders } = await import("@/lib/formation-reminders");
      const r = await runFormationReminders();
      if (r.sent) console.log(`[formation] relances : ${r.sent} parrain(s) notifié(s) sur ${r.parrains}`);
    } catch (e) {
      console.error("[formation] échec des relances :", e);
    }
  };
  setTimeout(run, 90_000).unref?.();
  setInterval(run, 24 * 60 * 60 * 1000).unref?.();
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
