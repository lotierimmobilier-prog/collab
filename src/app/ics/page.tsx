"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import GedDrive from "@/components/ics/GedDrive";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";
const GOLD_BG = "#F7F0E6"; const RED = "#9B2C2C"; const GREEN = "#2F855A";

interface IcsConfig {
  authBaseUrl: string; realm: string; clientId: string; portalUrl: string;
  apiBaseUrl: string | null; username: string | null; enabled: boolean;
  hasPassword: boolean; lastTestAt: string | null; lastTestOk: boolean; lastError: string | null;
}

interface IcsTenant {
  id: string; idBail: string; idLot: string | null; idMandat: string | null;
  nomLocataire: string | null; prenomLocataire: string | null; email: string | null; mobile: string | null;
  nomImmeuble: string | null; adresseImmeuble: string | null;
  nomProprietaire: string | null; prenomProprietaire: string | null; loyer: string | null;
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

  // Index ICS (export Locataires)
  const [tenants, setTenants] = useState<IcsTenant[]>([]);
  const [tenantTotal, setTenantTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/ics/config").then(r => r.json()).then(d => {
      if (d.config) { setCfg(d.config); setUsername(d.config.username ?? ""); }
    }).catch(() => {});
  }, []);

  const loadTenants = useCallback(async (q: string) => {
    try {
      const r = await fetch(`/api/ics/tenants?q=${encodeURIComponent(q)}`);
      if (!r.ok) return;
      const d = await r.json();
      setTenants(d.tenants ?? []); setTenantTotal(d.total ?? 0);
    } catch { /* silencieux */ }
  }, []);
  useEffect(() => { const t = setTimeout(() => loadTenants(search), 250); return () => clearTimeout(t); }, [search, loadTenants]);

  const [creatingContacts, setCreatingContacts] = useState(false);
  const [ownerImporting, setOwnerImporting] = useState(false);
  const ownerFileRef = useRef<HTMLInputElement>(null);
  const [syncingGestion, setSyncingGestion] = useState(false);

  // Import des fournisseurs (PDF ICS)
  const fournFileRef = useRef<HTMLInputElement>(null);
  const [fournImporting, setFournImporting] = useState(false);
  const [fournScope, setFournScope] = useState<"gestion" | "syndic">("gestion");
  const [fournMsg, setFournMsg] = useState("");

  async function importFournisseurs(file: File) {
    setFournImporting(true); setFournMsg("Lecture du PDF…");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const r = await fetch("/api/ics/fournisseurs/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: base64, scope: fournScope, createContacts: true }),
      });
      const d = await r.json();
      setFournMsg(r.ok ? (d.message || "Import terminé.") : (d.error || "Échec de l'import."));
    } catch { setFournMsg("Erreur réseau pendant l'import."); }
    finally { setFournImporting(false); }
  }

  async function syncGestion() {
    setSyncingGestion(true); setImportMsg("");
    try {
      const r = await fetch("/api/gestion/sync-ics", { method: "POST" });
      const d = await r.json();
      setImportMsg(r.ok ? (d.message || "Module Gestion synchronisé.") : (d.error || "Échec de la synchronisation."));
    } catch { setImportMsg("Erreur réseau pendant la synchronisation Gestion."); }
    finally { setSyncingGestion(false); }
  }

  async function importOwners(file: File) {
    setOwnerImporting(true); setImportMsg("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/ics/owners/import", { method: "POST", body: fd });
      const d = await r.json();
      setImportMsg(r.ok ? (d.message || "Propriétaires importés.") : (d.error || "Échec de l'import."));
    } catch { setImportMsg("Erreur réseau pendant l'import des propriétaires."); }
    finally { setOwnerImporting(false); }
  }

  async function createContacts() {
    setCreatingContacts(true); setImportMsg("");
    try {
      const r = await fetch("/api/ics/tenants/create-contacts", { method: "POST" });
      const d = await r.json();
      setImportMsg(r.ok ? (d.message || "Contacts créés.") : (d.error || "Échec de la création."));
    } catch { setImportMsg("Erreur réseau pendant la création des contacts."); }
    finally { setCreatingContacts(false); }
  }

  async function importFile(file: File) {
    setImporting(true); setImportMsg("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/ics/tenants/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setImportMsg(d.error || "Échec de l'import"); return; }
      setImportMsg(d.message || "Import terminé.");
      loadTenants(search);
    } catch { setImportMsg("Erreur réseau pendant l'import."); }
    finally { setImporting(false); }
  }

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
        const gedTxt = d.ged?.tested
          ? (d.ged.ok ? " Accès aux documents GED confirmé ✓" : ` (accès documents : ${d.ged.detail || "à finaliser"})`)
          : (d.ged?.detail ? ` (${d.ged.detail})` : "");
        setMsg({ kind: d.ged?.tested && !d.ged.ok ? "info" : "ok", text: `✓ Connexion à ICS réussie. Le robot peut s'authentifier.${gedTxt}` });
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
              <Row label="API documents">{cfg?.apiBaseUrl || <span style={{ color: "#9ca3af" }}>GED ICS native (spirit6back · ged-tomcat1)</span>}</Row>
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

            {/* Index ICS (export Locataires) */}
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Index ICS — locataires & propriétaires</div>
                <span style={{ fontSize: 11.5, color: "#6b7280" }}>{tenantTotal} bail(s) référencé(s)</span>
              </div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>
                Importez l'export ICS « Locataires » (.xls, .xlsx ou .csv). Il relie chaque bail à son locataire,
                son bien et son propriétaire — sans copier aucun document, uniquement les références.
              </p>
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
              <input ref={ownerFileRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importOwners(f); e.target.value = ""; }} />
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => fileRef.current?.click()} disabled={importing} style={btnPrimary}>
                  {importing ? "Import en cours…" : "Importer l'export Locataires"}
                </button>
                <button onClick={() => ownerFileRef.current?.click()} disabled={ownerImporting} style={btnGhost}
                  title="Importer/mettre à jour les propriétaires dans l'annuaire (nouveautés et modifications uniquement)">
                  {ownerImporting ? "Import…" : "Importer l'export Propriétaires"}
                </button>
                {tenantTotal > 0 && (
                  <button onClick={createContacts} disabled={creatingContacts} style={btnGhost}
                    title="Créer dans l'annuaire les locataires et propriétaires de l'index ICS (sans doublon)">
                    {creatingContacts ? "Création…" : "Créer les contacts dans l'annuaire"}
                  </button>
                )}
                {tenantTotal > 0 && allowed && (
                  <button onClick={syncGestion} disabled={syncingGestion} style={btnGhost}
                    title="Créer/mettre à jour les propriétaires, locataires, lots et baux du module Gestion depuis ICS (sans doublon)">
                    {syncingGestion ? "Synchro…" : "Synchroniser le module Gestion"}
                  </button>
                )}
                {importMsg && <span style={{ fontSize: 12, color: importMsg.startsWith("Échec") || importMsg.startsWith("Erreur") ? RED : GREEN }}>{importMsg}</span>}
              </div>

              {tenantTotal > 0 && (
                <>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un locataire, propriétaire, adresse ou idBail…"
                    style={{ ...inp, marginTop: 16, background: "#fff" }} />
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                    {tenants.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af", padding: 12, textAlign: "center" }}>Aucun résultat.</div>}
                    {tenants.map(t => (
                      <div key={t.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>
                            {[t.prenomLocataire, t.nomLocataire].filter(Boolean).join(" ") || "—"}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.adresseImmeuble || t.nomImmeuble || "—"}
                            {t.nomProprietaire && <> · propriétaire : {[t.prenomProprietaire, t.nomProprietaire].filter(Boolean).join(" ")}</>}
                          </div>
                        </div>
                        <a href="#ged-drive" onClick={() => document.getElementById("ged-drive")?.scrollIntoView({ behavior: "smooth" })}
                          title="Ouvrir le Drive ICS (consultation des documents)" style={{ ...btnGhost, textDecoration: "none", fontSize: 12, padding: "7px 12px" }}>
                          Documents ICS →
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Import des fournisseurs (PDF ICS) */}
            {allowed && (
              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 8 }}>Fournisseurs ICS</div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Importez la « Liste des fournisseurs » exportée d'ICS (PDF) — gestion ou syndic. Les fournisseurs
                  sont créés/mis à jour dans le module Gestion (réutilisables dans les ordres de service) et ajoutés
                  à l'annuaire. Lecture automatique du PDF (numéro, métier, coordonnées, IBAN, mode de règlement).
                </p>
                <input ref={fournFileRef} type="file" accept=".pdf" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) importFournisseurs(f); e.target.value = ""; }} />
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <select value={fournScope} onChange={e => setFournScope(e.target.value as "gestion" | "syndic")} style={{ ...inp, width: "auto", background: "#fff" }}>
                    <option value="gestion">Gestion locative</option>
                    <option value="syndic">Syndic</option>
                  </select>
                  <button onClick={() => fournFileRef.current?.click()} disabled={fournImporting} style={btnPrimary}>
                    {fournImporting ? "Import en cours…" : "Importer le PDF fournisseurs"}
                  </button>
                  {fournMsg && <span style={{ fontSize: 12, color: fournMsg.startsWith("Échec") || fournMsg.startsWith("Erreur") ? RED : GREEN }}>{fournMsg}</span>}
                </div>
              </div>
            )}

            {/* Drive GED — consultation directe des documents */}
            <div id="ged-drive"><GedDrive canEdit={allowed} /></div>

            {/* Feuille de route */}
            <div style={{ background: GOLD_BG, borderRadius: 14, border: `1px solid ${GOLD}33`, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 10 }}>Étapes du connecteur</div>
              <Step n="1" done state="Fait">Fondation : stockage chiffré des identifiants + test d'authentification Keycloak.</Step>
              <Step n="2" done state="Fait">Index ICS : import de l'export Locataires (bail ↔ locataire ↔ bien ↔ propriétaire).</Step>
              <Step n="3" done state="Fait">Consultation des documents ICS en direct (GED), sans copie.</Step>
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
