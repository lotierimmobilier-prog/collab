import crypto from "crypto";

/**
 * Accès en LECTURE SEULE au Google Drive partagé de l'agence, via un compte
 * de service (server-side). Aucune écriture. Zéro dépendance externe : le JWT
 * du compte de service est signé avec le module crypto natif.
 *
 * Configuration (variables d'environnement) :
 *   GOOGLE_SERVICE_ACCOUNT_JSON  → contenu JSON de la clé du compte de service
 *   GOOGLE_DRIVE_FOLDER_ID       → (optionnel) limite la recherche à ce dossier
 *                                  ou Drive partagé
 *
 * Le Drive (ou dossier) doit être partagé en lecture avec l'email du compte
 * de service (client_email du JSON).
 */

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface ServiceAccount { client_email: string; private_key: string; }

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) return null;
    // Les clés copiées en .env ont souvent des \n échappés
    sa.private_key = String(sa.private_key).replace(/\\n/g, "\n");
    return sa;
  } catch { return null; }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// ── Cache du token d'accès (réutilisé jusqu'à expiration) ──────
let cached: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const signature = base64url(crypto.sign("RSA-SHA256", Buffer.from(signingInput), sa.private_key));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Auth Google échouée (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  cached = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return cached.token;
}

export interface DriveFile {
  name: string;
  mimeType: string;
  link: string;
  modifiedTime?: string;
}

export interface DriveSearchResult {
  configured: boolean;
  files: DriveFile[];
  error?: string;
}

/** Indique si l'accès Drive est configuré (compte de service présent). */
export function isDriveConfigured(): boolean {
  return loadServiceAccount() !== null;
}

/**
 * Recherche en texte intégral dans le Drive partagé (lecture seule).
 * @param query termes de recherche
 * @param limit nombre max de résultats (défaut 8)
 */
export async function searchDrive(query: string, limit = 8): Promise<DriveSearchResult> {
  const sa = loadServiceAccount();
  if (!sa) return { configured: false, files: [], error: "Accès Drive non configuré (GOOGLE_SERVICE_ACCOUNT_JSON manquant)." };

  const q = (query || "").trim();
  if (!q) return { configured: true, files: [] };

  try {
    const token = await getAccessToken(sa);

    // Échappe les apostrophes pour la requête Drive
    const safe = q.replace(/'/g, "\\'");
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const clauses = [`fullText contains '${safe}'`, "trashed = false"];
    if (folderId) clauses.push(`'${folderId}' in parents`);

    const params = new URLSearchParams({
      q: clauses.join(" and "),
      fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
      pageSize: String(Math.min(Math.max(limit, 1), 20)),
      orderBy: "modifiedTime desc",
      // Couvre à la fois les fichiers partagés du My Drive et les Drive partagés
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
      corpora: "allDrives",
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const txt = await res.text();
      return { configured: true, files: [], error: `Recherche Drive échouée (${res.status}): ${txt.slice(0, 200)}` };
    }
    const data = await res.json();
    const files: DriveFile[] = (data.files ?? []).map((f: { name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }) => ({
      name: f.name,
      mimeType: f.mimeType,
      link: f.webViewLink ?? "",
      modifiedTime: f.modifiedTime,
    }));
    return { configured: true, files };
  } catch (err) {
    return { configured: true, files: [], error: err instanceof Error ? err.message : String(err) };
  }
}
