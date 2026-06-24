"use client";
import { useState, useEffect } from "react";
import {
  GmailConfig, GmailTokenStore,
  loadGmailConfigs, saveGmailConfigs,
  loadGmailToken, saveGmailToken, clearGmailToken, isGmailTokenValid,
  requestGmailToken, fetchGmailProfile,
} from "@/lib/googleGmail";

interface Props {
  onSynced: (accountId: string, token: string) => void;
  onClose: () => void;
}

export default function GoogleMailConnect({ onSynced, onClose }: Props) {
  const [configs, setConfigs] = useState<GmailConfig[]>([]);
  const [clientId, setClientId] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [tokens, setTokens] = useState<Record<string, GmailTokenStore | null>>({});

  useEffect(() => {
    const cfgs = loadGmailConfigs();
    setConfigs(cfgs);
    const t: Record<string, GmailTokenStore | null> = {};
    cfgs.forEach(c => { t[c.accountId] = loadGmailToken(c.accountId); });
    setTokens(t);
  }, []);

  async function connect() {
    if (!clientId.trim()) return;
    setConnecting(true);
    setError("");
    try {
      const token = await requestGmailToken(clientId.trim());
      const profile = await fetchGmailProfile(token.access_token);

      const accountId = `gmail-${profile.emailAddress.replace(/[^a-z0-9]/gi, "_")}`;
      const config: GmailConfig = {
        clientId: clientId.trim(),
        accountId,
        email: profile.emailAddress,
        name: profile.emailAddress.split("@")[0],
      };

      saveGmailToken(accountId, token);
      const updated = [...configs.filter(c => c.accountId !== accountId), config];
      saveGmailConfigs(updated);
      setConfigs(updated);
      setTokens(p => ({ ...p, [accountId]: { ...token, _saved: Date.now(), accountId } }));
      setClientId("");
      onSynced(accountId, token.access_token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connexion échouée");
    } finally {
      setConnecting(false);
    }
  }

  async function reconnect(cfg: GmailConfig) {
    setConnecting(true);
    setError("");
    try {
      const token = await requestGmailToken(cfg.clientId);
      saveGmailToken(cfg.accountId, token);
      setTokens(p => ({ ...p, [cfg.accountId]: { ...token, _saved: Date.now(), accountId: cfg.accountId } }));
      onSynced(cfg.accountId, token.access_token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reconnexion échouée");
    } finally {
      setConnecting(false);
    }
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
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "#fff", zIndex: 50, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <GoogleIcon /> Connexion Gmail
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Synchronisez vos boîtes Gmail via OAuth 2.0</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Comptes connectés */}
          {configs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 10 }}>Comptes connectés</div>
              {configs.map(cfg => {
                const tok = tokens[cfg.accountId];
                const valid = isGmailTokenValid(tok ?? null);
                return (
                  <div key={cfg.accountId} style={{ border: `1px solid ${valid ? "#bbf7d0" : "#fecaca"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <GoogleIcon size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{cfg.email}</div>
                        <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: valid ? "#10b981" : "#f59e0b", display: "inline-block" }} />
                          <span style={{ color: valid ? "#059669" : "#d97706" }}>{valid ? "Connecté" : "Token expiré"}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {!valid && (
                          <button onClick={() => reconnect(cfg)} disabled={connecting} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "#1e40af" }}>
                            Reconnecter
                          </button>
                        )}
                        <button onClick={() => disconnect(cfg.accountId)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626" }}>
                          Déconnecter
                        </button>
                      </div>
                    </div>
                    {valid && (
                      <button
                        onClick={() => tok && onSynced(cfg.accountId, tok.access_token)}
                        style={{ width: "100%", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: "pointer", color: "#059669", fontWeight: 500 }}
                      >
                        🔄 Synchroniser INBOX
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Ajouter un compte */}
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
              {configs.length === 0 ? "Connecter un compte Gmail" : "Ajouter un autre compte"}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                Client ID Google OAuth 2.0
                <button onClick={() => setShowHelp(s => !s)} style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontSize: 12, marginLeft: 8 }}>
                  {showHelp ? "Masquer" : "Comment obtenir ?"}
                </button>
              </div>
              <input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                style={{ width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            {showHelp && (
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "14px", fontSize: 12, color: "#374151", lineHeight: 1.7, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: "#7c3aed" }}>Obtenir un Client ID Google :</div>
                <ol style={{ paddingLeft: 18, margin: 0 }}>
                  <li>Aller sur <strong>console.cloud.google.com</strong></li>
                  <li>Créer ou sélectionner un projet</li>
                  <li>Activer l&apos;API <strong>Gmail API</strong></li>
                  <li>Aller dans <strong>Identifiants → Créer → ID client OAuth 2.0</strong></li>
                  <li>Type : <strong>Application Web</strong></li>
                  <li>Ajouter <code style={{ background: "#ede9fe", borderRadius: 3, padding: "1px 5px" }}>{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}</code> aux <strong>Origines JS autorisées</strong></li>
                  <li>Copier le <strong>Client ID</strong></li>
                </ol>
                <div style={{ marginTop: 10, background: "#ede9fe", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "#7c3aed" }}>
                  Le token OAuth est stocké uniquement dans votre navigateur. Aucun mot de passe n&apos;est envoyé.
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#991b1b", marginBottom: 10 }}>
                {error}
              </div>
            )}

            <button
              onClick={connect}
              disabled={!clientId.trim() || connecting}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: clientId.trim() ? "#fff" : "#f9fafb",
                border: `1px solid ${clientId.trim() ? "#e5e7eb" : "#f3f4f6"}`,
                borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600,
                cursor: clientId.trim() ? "pointer" : "default",
                color: clientId.trim() ? "#374151" : "#9ca3af",
                boxShadow: clientId.trim() ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <GoogleIcon size={18} />
              {connecting ? "Connexion en cours..." : "Se connecter avec Google"}
            </button>
          </div>

          {/* Note IMAP */}
          <div style={{ marginTop: 20, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#78350f" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Autres boîtes mail (non Gmail)</div>
            Utilisez le bouton <strong>+ Ajouter un compte</strong> avec configuration IMAP/POP3 pour Outlook, Orange, SFR et les autres fournisseurs.
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb" }}>
          <button onClick={onClose} style={{ width: "100%", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      </div>
    </>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
