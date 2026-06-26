// Connecteur direct à la GED ICS (ged-tomcat1) — HTTP pur, sans navigateur.
//
// Login en 3 appels (tous GET) :
//   1. GetUserInfos?email&nomSociete&mdp        → numéro de société
//   2. GetPortefeuilles?…&numeroSociete&mdp      → clé de portefeuille
//   3. GetGedToken?…&clePortefeuille&mdp          → jeton (valable ~24 h)
// Puis, avec le jeton :
//   - SearchRootArborescenceServlet               → racine de l'arborescence
//   - DisplayFolderContentInfinityServlet         → contenu d'un dossier
//   - GetPersoInfosServlet?token&idArbo           → infos du tiers
//   - getFileByFTPServlet?token&emplacement&guid  → octets du PDF

const DEFAULT_BASE = "https://ged-tomcat1.ics.fr/tomcat/Ged";

export interface GedCreds { apiBase?: string | null; societe: string; email: string; password: string }
export interface GedSession { token: string; cle: string; portefeuille: string }

interface GedResp<T = unknown> { responseCode: string; msg: string; payload: T }

function base(creds: { apiBase?: string | null }) { return (creds.apiBase || DEFAULT_BASE).replace(/\/+$/, ""); }

async function gedGet<T = unknown>(apiBase: string, servlet: string, params: Record<string, string>): Promise<GedResp<T>> {
  const qs = new URLSearchParams(params);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${apiBase}/${servlet}?${qs}`, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    const data = await res.json().catch(() => ({ responseCode: String(res.status), msg: "Réponse non-JSON", payload: null }));
    return data as GedResp<T>;
  } finally { clearTimeout(t); }
}

/** Authentifie auprès de la GED et renvoie un jeton. */
export async function gedLogin(creds: GedCreds): Promise<{ ok: boolean; session?: GedSession; error?: string }> {
  const b = base(creds);
  try {
    const ui = await gedGet<string>(b, "GetUserInfos", { email: creds.email, nomSociete: creds.societe, mdp: creds.password });
    if (ui.responseCode !== "200" || !ui.payload) return { ok: false, error: `Identifiants GED refusés (${ui.msg || "société introuvable"}).` };
    const numeroSociete = String(ui.payload);

    const pf = await gedGet<Array<{ label: string; cle: string }>>(b, "GetPortefeuilles", { nomProduit: "Ged", email: creds.email, numeroSociete, mdp: creds.password, retour: "json" });
    const portefeuille = Array.isArray(pf.payload) ? pf.payload[0] : undefined;
    if (pf.responseCode !== "200" || !portefeuille?.cle) return { ok: false, error: `Portefeuille GED introuvable (${pf.msg}).` };

    const tk = await gedGet<string>(b, "GetGedToken", { nomProduit: "Ged", email: creds.email, clePortefeuille: portefeuille.cle, mdp: creds.password, retour: "json" });
    if (tk.responseCode !== "200" || !tk.payload) return { ok: false, error: `Jeton GED non délivré (${tk.msg}).` };

    return { ok: true, session: { token: String(tk.payload), cle: portefeuille.cle, portefeuille: portefeuille.label } };
  } catch (e) {
    return { ok: false, error: `Accès à la GED impossible : ${(e as Error).message}` };
  }
}

/** Vérifie qu'un jeton est encore valide. */
export async function gedTokenValid(apiBase: string | null | undefined, token: string): Promise<boolean> {
  const r = await gedGet<string>(base({ apiBase }), "CheckTokenValid", { token }).catch(() => null);
  return !!r && r.responseCode === "200";
}

export interface GedFolder { idArbo: number; nom: string; nomGed: string; type?: string; documentsCount?: number; foldersCount?: number }
export interface GedDoc { guid: string; nom: string; extension?: string; size?: number; emplacement: string; dateUpload?: string; documentType?: string }

/** Racine de l'arborescence. */
export async function gedRoot(apiBase: string | null | undefined, token: string) {
  const r = await gedGet<{ directory: GedFolder; folders?: GedFolder[] }>(base({ apiBase }), "SearchRootArborescenceServlet", { request: JSON.stringify({ token }) });
  return r;
}

/** Contenu d'un dossier (sous-dossiers + documents). */
export async function gedFolder(apiBase: string | null | undefined, token: string, id: number, nomGed: string) {
  const request = JSON.stringify({ token, id, nomGed, droits: "President", resultNumber: 5000, page: 1, sortName: "DESCENDING_NAME", isPermissionFilteringEnabled: false });
  const r = await gedGet<{ directory: GedFolder & { folders?: GedFolder[]; docs?: GedDoc[] } }>(base({ apiBase }), "DisplayFolderContentInfinityServlet", { request });
  return r;
}

/** Infos du tiers attaché à un dossier. */
export async function gedPersoInfos(apiBase: string | null | undefined, token: string, idArbo: number) {
  return gedGet<Record<string, string>>(base({ apiBase }), "GetPersoInfosServlet", { token, idArbo: String(idArbo) });
}

/** Télécharge un fichier (renvoie la réponse fetch brute pour streamer). */
export async function gedFile(apiBase: string | null | undefined, token: string, emplacement: string, guid: string): Promise<Response> {
  const qs = new URLSearchParams({ token, emplacement, guid });
  return fetch(`${base({ apiBase })}/getFileByFTPServlet?${qs}`);
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface GedMatch { idArbo: number; nom: string; nomGed: string; type?: string }

/**
 * Recherche dans la gérance les dossiers (mandats/propriétaires) dont le nom
 * correspond au terme. Les dossiers GED sont nommés « 00XX - NOM PROPRIÉTAIRE ».
 */
export async function gedSearchGerance(apiBase: string | null | undefined, token: string, query: string): Promise<GedMatch[]> {
  const root = await gedRoot(apiBase, token);
  const sons = ((root.payload as { sons?: Array<{ idArbo: number; nom: string; nomGed: string }> })?.sons) ?? [];
  const gerance = sons.find(s => /gerance/i.test(s.nomGed) || /g[ée]rance/i.test(s.nom)) ?? sons[0];
  if (!gerance) return [];

  const r = await gedFolder(apiBase, token, gerance.idArbo, gerance.nomGed);
  const list = ((r.payload as { sons?: Array<{ idArbo: number; nom: string; nomGed: string; type?: string; infos?: { nompr?: string; type?: string } }> })?.sons) ?? [];
  const q = norm(query);
  if (q.length < 2) return [];
  return list
    .filter(s => norm(s.infos?.nompr || s.nom).includes(q))
    .slice(0, 40)
    .map(s => ({ idArbo: s.idArbo, nom: s.infos?.nompr || s.nom, nomGed: s.nomGed, type: s.infos?.type || s.type }));
}

export interface GedFoundDoc { nom: string; emplacement: string; guid: string; extension?: string; dossier: string }

/**
 * Recherche un tiers par nom puis explore ses dossiers pour remonter les
 * documents (exploration bornée). Pour Auguste et l'accès direct par fiche.
 */
export async function gedFindDocuments(apiBase: string | null | undefined, token: string, name: string, maxDocs = 25): Promise<{ folders: GedMatch[]; docs: GedFoundDoc[] }> {
  const folders = await gedSearchGerance(apiBase, token, name);
  const docs: GedFoundDoc[] = [];
  let calls = 0;

  async function walk(id: number, nomGed: string, path: string, depth: number) {
    if (docs.length >= maxDocs || calls >= 30 || depth > 4) return;
    calls++;
    const r = await gedFolder(apiBase, token, id, nomGed);
    const pl = (r.payload ?? {}) as { sons?: Array<{ idArbo: number; nom: string; nomGed: string; infos?: { nompr?: string } }>; docs?: Array<{ nom: string; emplacement: string; guid: string; extension?: string }> };
    for (const d of pl.docs ?? []) {
      docs.push({ nom: d.nom, emplacement: d.emplacement, guid: d.guid, extension: d.extension, dossier: path });
      if (docs.length >= maxDocs) return;
    }
    for (const s of pl.sons ?? []) {
      if (docs.length >= maxDocs || calls >= 30) break;
      await walk(s.idArbo, s.nomGed, `${path}/${s.infos?.nompr || s.nom}`, depth + 1);
    }
  }

  for (const m of folders.slice(0, 2)) await walk(m.idArbo, m.nomGed, m.nom, 0);
  return { folders, docs };
}
