// Connecteur ICS (MyICS / Spirit) — authentification Keycloak (OpenID Connect).
//
// L'URL de connexion observée :
//   https://auth.ics.fr/auth/realms/Production/protocol/openid-connect/auth
//     ?client_id=myics-customer&redirect_uri=https://my.ics.fr/login&response_type=code…
// → Keycloak standard, client public « myics-customer ».
//
// Première tentative d'authentification : grant « password » (ROPC), qui ne
// nécessite pas de navigateur. Si le realm le désactive (fréquent pour un
// client public), on le saura via l'erreur renvoyée et on basculera plus tard
// sur un login piloté par navigateur (Playwright).

export interface IcsConfigData {
  authBaseUrl: string;
  realm: string;
  clientId: string;
  portalUrl: string;
  apiBaseUrl?: string | null;
  username?: string | null;
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
