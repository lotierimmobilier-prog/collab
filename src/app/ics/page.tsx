"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";
const GOLD_BG = "#F7F0E6"; const RED = "#9B2C2C"; const GREEN = "#2F855A";

interface IcsConfig {
  authBaseUrl: string; realm: string; clientId: string; portalUrl: string;
  apiBaseUrl: string | null; username: string | null; enabled: boolean;
  hasPassword: boolean; lastTestAt: string | null; lastTestOk: boolean; lastError: string | null;
}

export default function IcsPage() {
  const { data: session } = useSession();
  const allowed = ["admin", "direction", "dirigeant"].includes(session?.user?.roleId ?? "");

  const [cfg, setCfg] = useState<IcsConfig | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/ics/config").then(r => r.json()).then(d => {
      if (d.config) { setCfg(d.config); setUsername(d.config.username ?? ""); }
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { username };
      if (password) body.password = password;
      const r = await fetch("/api/ics/config", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ kind: "err", text: d.error || "Erreur" }); return; }
      setCfg(d.config); setPassword("");
      setMsg({ kind: "ok", text: "Identifiants enregistrés (mot de passe chiffré)." });
    } catch { setMsg({ kind: "err", text: "Erreur réseau" }); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true); setMsg(null);
    try {
      const r = await fetch("/api/ics/test", { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        setMsg({ kind: "ok", text: "✓ Connexion à ICS réussie. Le robot peut s'authentifier." });
      } else if (d.ropcUnsupported) {
        setMsg({ kind: "info", text: d.error || "ICS exige un login par navigateur (étape suivante du connecteur)." });
      } else {
        setMsg({ kind: "err", text: d.error || "Échec de la connexion." });
      }
      // rafraîchit le statut
      const c = await fetch("/api/ics/config").then(x => x.json());
      if (c.config) setCfg(c.config);
    } catch { setMsg({ kind: "err", text: "Erreur réseau" }); }
    finally { setTesting(false); }
  }

  if (!allowed) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
        <Sidebar active="ics" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh" }}>
          <Topbar title="Connecteur ICS" />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>
            Réservé à la direction.
          </div>
        </div>
      </div>
    );
  }

  const msgColor = msg?.kind === "ok" ? GREEN : msg?.kind === "err" ? RED : "#6b7280";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="ics" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Connecteur ICS" />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px" }}>
          <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

            <div>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: DARK, margin: 0 }}>Connecteur ICS — MyICS / Spirit</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 0", lineHeight: 1.5 }}>
                Récupération automatique des documents (propriétaires, locataires, copropriétaires)
                depuis votre logiciel ICS. Vos identifiants sont stockés <strong>chiffrés</strong> et
                utilisés uniquement par Collab pour se connecter à ICS en lecture seule.
              </p>
            </div>

            {/* Identifiants */}
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 14 }}>Identifiants ICS</div>
              <Field label="Nom d'utilisateur ou email">
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="glotier" style={inp} />
              </Field>
              <div style={{ height: 12 }} />
              <Field label={cfg?.hasPassword ? "Mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={cfg?.hasPassword ? "••••••••" : "Mot de passe ICS"} style={{ ...inp, flex: 1 }} />
                  <button onClick={() => setShowPwd(s => !s)} title={showPwd ? "Masquer" : "Afficher"}
                    style={{ ...btnGhost, width: 44 }}>{showPwd ? "🙈" : "👁"}</button>
                </div>
              </Field>
              <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
                <button onClick={test} disabled={testing || !cfg?.hasPassword} style={btnGhost}
                  title={cfg?.hasPassword ? "Vérifier la connexion à ICS" : "Enregistrez d'abord les identifiants"}>
                  {testing ? "Test en cours…" : "Tester la connexion"}
                </button>
              </div>
              {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: msgColor, lineHeight: 1.5 }}>{msg.text}</div>}
            </div>

            {/* Statut */}
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 12 }}>État de la connexion</div>
              <Row label="Portail">{cfg?.portalUrl ?? "—"}</Row>
              <Row label="Serveur d'authentification">{cfg?.authBaseUrl ?? "—"} · realm {cfg?.realm ?? "—"}</Row>
              <Row label="API documents">{cfg?.apiBaseUrl || <span style={{ color: "#9ca3af" }}>à configurer (étape 2, via le HAR)</span>}</Row>
              <Row label="Dernier test">
                {cfg?.lastTestAt
                  ? <span style={{ color: cfg.lastTestOk ? GREEN : RED, fontWeight: 600 }}>
                      {cfg.lastTestOk ? "Réussi" : "Échec"} · {new Date(cfg.lastTestAt).toLocaleString("fr-FR")}
                    </span>
                  : <span style={{ color: "#9ca3af" }}>jamais testé</span>}
              </Row>
              {cfg?.lastError && !cfg.lastTestOk && (
                <div style={{ marginTop: 8, fontSize: 12, color: RED, background: "#FBEAEA", borderRadius: 8, padding: "8px 10px" }}>{cfg.lastError}</div>
              )}
            </div>

            {/* Feuille de route */}
            <div style={{ background: GOLD_BG, borderRadius: 14, border: `1px solid ${GOLD}33`, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 10 }}>Étapes du connecteur</div>
              <Step n="1" done state="Fait">Fondation : stockage chiffré des identifiants + test d'authentification Keycloak.</Step>
              <Step n="2" state="En attente du HAR">Cartographie de l'API Spirit (URL des tiers et des documents) à partir de l'enregistrement réseau.</Step>
              <Step n="3" state="À venir">Récupération des documents et rangement automatique dans la GED Collab.</Step>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12.5 }}>
      <span style={{ width: 200, color: "#6b7280", flexShrink: 0 }}>{label}</span>
      <span style={{ color: DARK, wordBreak: "break-all" }}>{children}</span>
    </div>
  );
}

function Step({ n, children, state, done }: { n: string; children: React.ReactNode; state: string; done?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", alignItems: "flex-start" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: done ? GREEN : "#fff", color: done ? "#fff" : GOLD, border: `1.5px solid ${done ? GREEN : GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{done ? "✓" : n}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12.5, color: DARK }}>{children}</span>
        <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: done ? GREEN : "#9ca3af", textTransform: "uppercase" }}>· {state}</span>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
