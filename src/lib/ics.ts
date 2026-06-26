// Connecteur ICS (MyICS / Spirit) — authentification Keycloak (OpenID Connect).
//
// L'URL de connexion observée :
//   https://auth.ics.fr/auth/realms/Production/protocol/openid-connect/auth
//     ?client_id=myics-customer&redirect_uri=https://my.ics.fr/login&response_type=code…
// → Keycloak standard, client public « myics-customer ».
//
// Deux modes d'authentification :
//  1. grant « password » (ROPC) — direct, sans navigateur.
//  2. flux « authorization code » + PKCE rejoué sans navigateur (icsLoginAuthCode)
//     lorsque le realm interdit le ROPC (cas confirmé pour myics-customer).
import { createHash, randomBytes } from "crypto";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// User-Agent « navigateur » pour que Keycloak serve la page de login standard.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface IcsConfigData {
  authBaseUrl: string;
  realm: string;
  clientId: string;
  portalUrl: string;
  apiBaseUrl?: string | null;
  spiritApiBase?: string | null;
  gedApiBase?: string | null;
  idSociete?: string | null;
  username?: string | null;
}

/** Rôles autorisés à consulter la GED ICS depuis Collab : direction + gestion locative. */
export function canAccessIcsGed(roleId?: string | null): boolean {
  return roleId === "admin" || roleId === "direction" || roleId === "dirigeant" || roleId === "gestionnaire";
}

export interface IcsLoginResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
  /** true si l'échec vient d'un grant ROPC refusé par le realm (→ fallback navigateur). */
  ropcUnsupported?: boolean;
}

export function icsTokenUrl(cfg: IcsConfigData): string {
  const base = cfg.authBaseUrl.replace(/\/+$/, "");
  return `${base}/realms/${encodeURIComponent(cfg.realm)}/protocol/openid-connect/token`;
}

/**
 * Tente une authentification ROPC (username/password) sur Keycloak.
 * Ne lève jamais : renvoie un résultat structuré.
 */
export async function icsLogin(cfg: IcsConfigData, username: string, password: string): Promise<IcsLoginResult> {
  const url = icsTokenUrl(cfg);
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: cfg.clientId,
    username,
    password,
    scope: "openid",
  });

  let res: Response;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
  } catch (e) {
    return { ok: false, error: `Connexion au serveur ICS impossible : ${(e as Error).message}` };
  }

  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* corps non-JSON */ }

  if (res.ok && typeof data.access_token === "string") {
    return {
      ok: true,
      accessToken: data.access_token as string,
      refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
    };
  }

  const err = String(data.error ?? "");
  const desc = String(data.error_description ?? "");
  // Realm qui interdit le grant « password » pour ce client public.
  const ropcUnsupported = err === "unauthorized_client" || err === "invalid_client" ||
    /not allowed|direct access grants|unauthorized/i.test(desc);

  if (err === "invalid_grant") {
    return { ok: false, error: "Identifiant ou mot de passe ICS refusé.", ropcUnsupported: false };
  }
  return {
    ok: false,
    ropcUnsupported,
    error: ropcUnsupported
      ? "ICS n'autorise pas l'authentification directe pour ce client : un login par navigateur sera nécessaire (étape suivante)."
      : (desc || err || `Réponse inattendue d'ICS (HTTP ${res.status}).`),
  };
}

export interface IcsGedLink {
  ok: boolean;
  status: number;
  raw?: string;        // réponse brute du GedServlet (URL magique)
  gedToken?: string;
  dossier?: string;
  error?: string;
}

/**
 * Appelle le GedServlet de Spirit pour un bail (ou un mandat) et extrait le
 * jeton GED + le dossier. Authentifié par Bearer (jeton Keycloak).
 * Réponse attendue : une URL texte de la forme
 *   https://ged1.ics.fr/#/login?token=…&dossier=…&login=…&mdp=…&cle=…
 */
export async function icsGedLink(
  cfg: IcsConfigData, accessToken: string, params: { idBail?: string; idMandat?: string },
): Promise<IcsGedLink> {
  const base = (cfg.spiritApiBase || "https://spirit6back.ics.fr/GeranceNet").replace(/\/+$/, "");
  const qs = new URLSearchParams({ idSociete: cfg.idSociete || "54246" });
  if (params.idBail) qs.set("idBail", params.idBail);
  if (params.idMandat) qs.set("idMandat", params.idMandat);
  const url = `${base}/GedServlet?${qs}`;

  let res: Response;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "text/plain" }, signal: ctrl.signal });
    clearTimeout(t);
  } catch (e) {
    return { ok: false, status: 0, error: `Appel GedServlet impossible : ${(e as Error).message}` };
  }

  const raw = (await res.text().catch(() => "")).trim();
  if (!res.ok) {
    return { ok: false, status: res.status, raw: raw.slice(0, 200), error: `GedServlet a renvoyé HTTP ${res.status}.` };
  }
  const tok = /[?&]token=([^&\s]+)/.exec(raw);
  const dos = /[?&]dossier=([^&\s]+)/.exec(raw);
  if (!tok) {
    return { ok: false, status: res.status, raw: raw.slice(0, 200), error: "Réponse GedServlet inattendue (pas de jeton)." };
  }
  return { ok: true, status: res.status, raw, gedToken: tok[1], dossier: dos?.[1] };
}

// ── Login « navigateur » sans navigateur : flux authorization code + PKCE ──
// Reproduit ce que fait my.ics.fr : GET de la page de login Keycloak, POST des
// identifiants, récupération du « code », puis échange contre un jeton.

function parseSetCookies(res: Response, jar: Map<string, string>) {
  const getter = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const list = typeof getter === "function" ? getter.call(res.headers) : [];
  for (const c of list) {
    const pair = c.split(";")[0];
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const cookieHeader = (jar: Map<string, string>) => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

export async function icsLoginAuthCode(cfg: IcsConfigData, username: string, password: string): Promise<IcsLoginResult> {
  const authBase = cfg.authBaseUrl.replace(/\/+$/, "");
  const realm = encodeURIComponent(cfg.realm);
  const authUrl = `${authBase}/realms/${realm}/protocol/openid-connect/auth`;
  const tokenUrl = icsTokenUrl(cfg);
  const redirectUri = `${cfg.portalUrl.replace(/\/+$/, "")}/login`;

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const params = new URLSearchParams({
    client_id: cfg.clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid",
    state: b64url(randomBytes(8)), nonce: b64url(randomBytes(8)),
    response_mode: "query", code_challenge: challenge, code_challenge_method: "S256",
  });

  const authOrigin = new URL(authUrl).origin;
  const jar = new Map<string, string>();
  try {
    // 1. Page de connexion (suivre quelques redirections internes Keycloak).
    let url: string | null = `${authUrl}?${params}`;
    let html = "";
    let pageUrl = url;
    for (let hop = 0; hop < 5 && url; hop++) {
      const res: Response = await fetch(url, { redirect: "manual", headers: { Cookie: cookieHeader(jar), "User-Agent": UA } });
      parseSetCookies(res, jar);
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        url = next ? new URL(next, url).toString() : null;
        continue;
      }
      pageUrl = url;
      html = await res.text();
      break;
    }
    // On repère le formulaire de connexion (action vers login-actions/authenticate)
    // ET on lit ses VRAIS champs : noms des inputs identifiant/mot de passe et
    // champs cachés (le thème ICS peut renommer les champs).
    let action = "", formInner = "";
    for (const fm of html.matchAll(/<form\b[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/gi)) {
      const act = fm[1].replace(/&amp;/g, "&");
      if (/login-actions\/authenticate/i.test(act)) { action = act; formInner = fm[2]; break; }
      if (!action) { action = act; formInner = fm[2]; }
    }
    if (!action) return { ok: false, error: "Page de connexion ICS non reconnue (formulaire de connexion introuvable)." };
    action = new URL(action, pageUrl).toString();

    const body = new URLSearchParams();
    let userField = "", passField = "";
    for (const im of formInner.matchAll(/<input\b[^>]*>/gi)) {
      const tag = im[0];
      const name = /name="([^"]*)"/i.exec(tag)?.[1];
      if (!name) continue;
      const type = (/type="([^"]*)"/i.exec(tag)?.[1] || "text").toLowerCase();
      const value = (/value="([^"]*)"/i.exec(tag)?.[1] ?? "").replace(/&amp;/g, "&");
      if (type === "password") { passField = name; continue; }
      if (!userField && (type === "text" || type === "email" || /user|email|login|ident/i.test(name))) { userField = name; continue; }
      if (type === "hidden") body.set(name, value);
    }
    body.set(userField || "username", username);
    body.set(passField || "password", password);

    // 2. Envoi des identifiants (avec Origin/Referer, comme un navigateur).
    const post: Response = await fetch(action, {
      method: "POST", redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader(jar),
        Origin: authOrigin, Referer: pageUrl, "User-Agent": UA,
      },
      body,
    });
    parseSetCookies(post, jar);
    const loc = post.headers.get("location");
    if (!loc) {
      // Pas de redirection → Keycloak a réaffiché le formulaire avec un message.
      const errHtml = await post.text().catch(() => "");
      const kc = /kc-feedback-text[^>]*>([^<]+)<|id="input-error[^"]*"[^>]*>\s*([^<]+)|class="(?:alert|message|pf-c-alert__title)[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<]{3,})/i.exec(errHtml);
      const detail = (kc?.[1] || kc?.[2] || kc?.[3] || "").replace(/\s+/g, " ").trim();
      const stillLogin = /login-actions\/authenticate|type="password"/i.test(errHtml);
      const diag = `cookies=${jar.size}, userField=${userField || "?"}, passField=${passField || "?"}, action=${new URL(action).host}, postStatus=${post.status}, reLogin=${stillLogin}`;
      return { ok: false, error: detail
        ? `ICS a refusé la connexion : « ${detail} ».`
        : `ICS n'a pas validé la connexion (HTTP ${post.status}). [diag: ${diag}]` };
    }
    const cm = /[?&#]code=([^&]+)/.exec(loc);
    if (!cm) {
      const head = loc.split("#")[0].split("?")[0];
      return { ok: false, error: `Connexion ICS : pas de code reçu (redirection vers ${head}). Une action du compte est peut-être requise.` };
    }

    // 3. Échange du code contre un jeton.
    const tk: Response = await fetch(tokenUrl, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: cfg.clientId, code: decodeURIComponent(cm[1]), redirect_uri: redirectUri, code_verifier: verifier }),
    });
    const data = await tk.json().catch(() => ({})) as Record<string, unknown>;
    if (tk.ok && typeof data.access_token === "string") {
      return { ok: true, accessToken: data.access_token, refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined, expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined };
    }
    return { ok: false, error: String(data.error_description || data.error || `Échange du code échoué (HTTP ${tk.status}).`) };
  } catch (e) {
    return { ok: false, error: `Connexion à ICS impossible : ${(e as Error).message}` };
  }
}

/** Authentifie auprès d'ICS : ROPC d'abord, puis flux navigateur si refusé. */
export async function icsAuthenticate(cfg: IcsConfigData, username: string, password: string): Promise<IcsLoginResult & { mode?: "ropc" | "authcode" }> {
  const ropc = await icsLogin(cfg, username, password);
  if (ropc.ok) return { ...ropc, mode: "ropc" };
  if (!ropc.ropcUnsupported) return ropc; // mauvais identifiants : inutile de réessayer
  const auth = await icsLoginAuthCode(cfg, username, password);
  return { ...auth, mode: "authcode" };
}
