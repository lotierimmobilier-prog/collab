"use client";
import { useState, useEffect } from "react";
import {
  GmailConfig, GmailTokenStore,
  loadGmailConfigs, saveGmailConfigs,
  loadGmailToken, saveGmailToken, clearGmailToken, isGmailTokenValid,
  requestGmailToken, fetchGmailProfile,
} from "@/lib/googleGmail";

const SERVER_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null;

interface Props {
  onSynced: (accountId: string, token: string) => void;
  onClose: () => void;
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function GoogleMailConnect({ onSynced, onClose }: Props) {
  const [configs, setConfigs]   = useState<GmailConfig[]>([]);
  const [tokens, setTokens]     = useState<Record<string, GmailTokenStore | null>>({});
  const [connecting, setConnecting] = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    const cfgs = loadGmailConfigs();
    setConfigs(cfgs);
    const t: Record<string, GmailTokenStore | null> = {};
    cfgs.forEach(c => { t[c.accountId] = loadGmailToken(c.accountId); });
    setTokens(t);
  }, []);

  async function connect() {
    if (!SERVER_CLIENT_ID) { setError("Client ID Google non configuré sur le serveur."); return; }
    setConnecting(true); setError("");
    try {
      const token   = await requestGmailToken(SERVER_CLIENT_ID);
      const profile = await fetchGmailProfile(token.access_token);
      const accountId = `gmail-${profile.emailAddress.replace(/[^a-z0-9]/gi, "_")}`;
      const config: GmailConfig = { clientId: SERVER_CLIENT_ID, accountId, email: profile.emailAddress, name: profile.emailAddress.split("@")[0] };
      saveGmailToken(accountId, token);
      const updated = [...configs.filter(c => c.accountId !== accountId), config];
      saveGmailConfigs(updated);
      setConfigs(updated);
      setTokens(p => ({ ...p, [accountId]: { ...token, _saved: Date.now(), accountId } }));
      onSynced(accountId, token.access_token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connexion échouée");
    } finally { setConnecting(false); }
  }

  async function reconnect(cfg: GmailConfig) {
    if (!SERVER_CLIENT_ID) return;
    setConnecting(true); setError("");
    try {
      const token = await requestGmailToken(SERVER_CLIENT_ID);
      saveGmailToken(cfg.accountId, token);
      setTokens(p => ({ ...p, [cfg.accountId]: { ...token, _saved: Date.now(), accountId: cfg.accountId } }));
      onSynced(cfg.accountId, token.access_token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reconnexion échouée");
    } finally { setConnecting(false); }
  }

  function disconnect(accountId: string) {
    clearGmailToken(accountId);
    setTokens(p => ({ ...p, [accountId]: null }));
    const updated = configs.filter(c => c.accountId !== accountId);
    saveGmailConfigs(updated);
    setConfigs(updated);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(440px, 94vw)", background: "#fff", borderRadius: 16, zIndex: 50, boxShadow: "0 24px 64px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GoogleIcon size={22} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Comptes Gmail</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Synchronisez vos boîtes Gmail</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Comptes déjà connectés */}
          {configs.map(cfg => {
            const tok   = tokens[cfg.accountId];
            const valid = isGmailTokenValid(tok ?? null);
            return (
              <div key={cfg.accountId} style={{ border: `1px solid ${valid ? "#bbf7d0" : "#fed7aa"}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <GoogleIcon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cfg.email}</div>
                  <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: valid ? "#10b981" : "#f59e0b", display: "inline-block" }} />
                    <span style={{ color: valid ? "#059669" : "#d97706" }}>{valid ? "Connecté" : "Token expiré — reconnexion requise"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!valid && (
                    <button onClick={() => reconnect(cfg)} disabled={connecting} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#1e40af", fontWeight: 600 }}>
                      Reconnecter
                    </button>
                  )}
                  <button onClick={() => disconnect(cfg.accountId)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626" }}>
                    Retirer
                  </button>
                </div>
              </div>
            );
          })}

          {/* Erreur */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#991b1b" }}>
              {error}
            </div>
          )}

          {/* Bouton connexion */}
          {!SERVER_CLIENT_ID ? (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#78350f" }}>
              Client ID Google non configuré. Ajoutez <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> dans le <code>.env.local</code>.
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: connecting ? "default" : "pointer", color: "#374151", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", opacity: connecting ? 0.7 : 1 }}
            >
              <GoogleIcon size={18} />
              {connecting ? "Connexion en cours…" : configs.length > 0 ? "Ajouter un autre compte Gmail" : "Connecter avec Google"}
            </button>
          )}

          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.5 }}>
            Le token OAuth est stocké dans votre navigateur.<br />Aucun mot de passe n&apos;est envoyé au serveur.
          </div>
        </div>
      </div>
    </>
  );
}
