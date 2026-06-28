// Intégration Canva Connect API — génération de visuels à partir d'un Brand
// Template (autofill) puis export en image. La connexion se fait par OAuth 2
// (PKCE) ; le jeton de chaque utilisateur est stocké dans la table Setting.
//
// Configuration requise (variables d'environnement) :
//   CANVA_CLIENT_ID      — identifiant de l'app Canva (developer.canva.com)
//   CANVA_CLIENT_SECRET  — secret de l'app
//   CANVA_REDIRECT_URI   — ex. https://collab.lotier-immobilier.com/api/canva/callback
import { prisma } from "@/lib/prisma";

const AUTH_URL  = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const API       = "https://api.canva.com/rest/v1";

// Scopes nécessaires : lire les Brand Templates + leur dataset, écrire le
// contenu (autofill/export), téléverser des assets (photos).
export const CANVA_SCOPES = [
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:write",
].join(" ");

export function canvaConfigured(): boolean {
  return !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET && process.env.CANVA_REDIRECT_URI);
}

export interface CanvaToken { access_token: string; refresh_token?: string; expires_at: number }

const tokenKey = (uid: string) => `canva_token_${uid}`;
const pkceKey  = (uid: string) => `canva_pkce_${uid}`;

export async function getStoredToken(uid: string): Promise<CanvaToken | null> {
  const s = await prisma.setting.findUnique({ where: { key: tokenKey(uid) } }).catch(() => null);
  if (!s?.value) return null;
  try { return JSON.parse(s.value) as CanvaToken; } catch { return null; }
}

async function storeToken(uid: string, t: CanvaToken): Promise<void> {
  const value = JSON.stringify(t);
  await prisma.setting.upsert({ where: { key: tokenKey(uid) }, update: { value }, create: { key: tokenKey(uid), value } });
}

export async function disconnectCanva(uid: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: tokenKey(uid) } }).catch(() => {});
}

// ── PKCE ──────────────────────────────────────────────────────────
function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function createPkce(uid: string): Promise<{ verifier: string; challenge: string }> {
  const { randomBytes, createHash } = await import("crypto");
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  await prisma.setting.upsert({ where: { key: pkceKey(uid) }, update: { value: verifier }, create: { key: pkceKey(uid), value: verifier } });
  return { verifier, challenge };
}
async function consumePkce(uid: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key: pkceKey(uid) } }).catch(() => null);
  await prisma.setting.deleteMany({ where: { key: pkceKey(uid) } }).catch(() => {});
  return s?.value ?? null;
}

export function buildAuthorizeUrl(challenge: string, state: string): string {
  const p = new URLSearchParams({
    code_challenge_method: "s256",
    code_challenge: challenge,
    scope: CANVA_SCOPES,
    response_type: "code",
    client_id: process.env.CANVA_CLIENT_ID!,
    redirect_uri: process.env.CANVA_REDIRECT_URI!,
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

function basicAuth(): string {
  return Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCode(uid: string, code: string): Promise<boolean> {
  const verifier = await consumePkce(uid);
  if (!verifier) return false;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: process.env.CANVA_REDIRECT_URI!,
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth()}` }, body });
  if (!r.ok) return false;
  const d = await r.json();
  await storeToken(uid, { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in ?? 3600) * 1000 - 60_000 });
  return true;
}

// Renvoie un access token valide (rafraîchi si nécessaire), ou null.
export async function validAccessToken(uid: string): Promise<string | null> {
  const t = await getStoredToken(uid);
  if (!t) return null;
  if (Date.now() < t.expires_at) return t.access_token;
  if (!t.refresh_token) return null;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth()}` }, body });
  if (!r.ok) return null;
  const d = await r.json();
  const next: CanvaToken = { access_token: d.access_token, refresh_token: d.refresh_token ?? t.refresh_token, expires_at: Date.now() + (d.expires_in ?? 3600) * 1000 - 60_000 };
  await storeToken(uid, next);
  return next.access_token;
}

async function api(uid: string, path: string, init?: RequestInit): Promise<Response | null> {
  const token = await validAccessToken(uid);
  if (!token) return null;
  return fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
}

export interface CanvaTemplate { id: string; title: string; thumbnailUrl?: string; fields: { name: string; type: string }[] }

// Liste les Brand Templates exploitables en autofill (dataset non vide).
export async function listBrandTemplates(uid: string): Promise<CanvaTemplate[]> {
  const r = await api(uid, "/brand-templates?dataset=non_empty&limit=50");
  if (!r || !r.ok) return [];
  const d = await r.json();
  const items = Array.isArray(d.items) ? d.items : [];
  return items.map((t: { id: string; title?: string; thumbnail?: { url?: string } }) => ({
    id: t.id, title: t.title ?? "Modèle", thumbnailUrl: t.thumbnail?.url, fields: [],
  }));
}

// Détail du dataset d'un modèle (les champs à remplir).
export async function getTemplateDataset(uid: string, templateId: string): Promise<{ name: string; type: string }[]> {
  const r = await api(uid, `/brand-templates/${templateId}/dataset`);
  if (!r || !r.ok) return [];
  const d = await r.json();
  const ds = d.dataset ?? {};
  return Object.entries(ds).map(([name, def]) => ({ name, type: (def as { type?: string })?.type ?? "text" }));
}

// Lance un autofill puis attend le design résultant.
async function poll(uid: string, path: string, ok: (d: { job?: { status?: string } }) => boolean, max = 20): Promise<{ job?: Record<string, unknown> } | null> {
  for (let i = 0; i < max; i++) {
    const r = await api(uid, path);
    if (!r || !r.ok) return null;
    const d = await r.json();
    if (d.job?.status === "failed") return null;
    if (ok(d)) return d;
    await new Promise(res => setTimeout(res, 1500));
  }
  return null;
}

// Génère un visuel : autofill du modèle avec `data`, puis export JPG.
// `data` : { champ: { type:"text", text } | { type:"image", asset_id } }
export async function generateVisual(uid: string, templateId: string, data: Record<string, unknown>): Promise<{ url: string } | { error: string }> {
  const create = await api(uid, "/autofills", { method: "POST", body: JSON.stringify({ brand_template_id: templateId, data }) });
  if (!create) return { error: "not_connected" };
  if (!create.ok) return { error: `autofill_${create.status}` };
  const job = await create.json();
  const jobId = job.job?.id;
  if (!jobId) return { error: "no_job" };
  const done = await poll(uid, `/autofills/${jobId}`, d => d.job?.status === "success");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const designId = (done?.job as any)?.result?.design?.id;
  if (!designId) return { error: "autofill_timeout" };

  const exp = await api(uid, "/exports", { method: "POST", body: JSON.stringify({ design_id: designId, format: { type: "jpg", quality: 90 } }) });
  if (!exp || !exp.ok) return { error: "export_failed" };
  const expJob = await exp.json();
  const expId = expJob.job?.id;
  const expDone = await poll(uid, `/exports/${expId}`, d => d.job?.status === "success");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (expDone?.job as any)?.urls?.[0];
  if (!url) return { error: "export_timeout" };
  return { url };
}
