"use client";
import { useCallback, useEffect, useState } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GREEN = "#2F855A"; const RED = "#9B2C2C";

interface GedCfg { societe: string; email: string | null; hasPassword: boolean; lastTestOk: boolean; lastError: string | null }
interface Folder { idArbo: number; nom: string; nomGed: string; type?: string; count?: number }
interface Doc { guid: string; nom: string; extension?: string; size?: number; emplacement: string; dateUpload?: string }
interface Crumb { id: number | null; nomGed: string; nom: string }

const fmtSize = (n?: number) => !n ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;

export default function GedDrive({ canEdit }: { canEdit: boolean }) {
  const [cfg, setCfg] = useState<GedCfg | null>(null);
  const [societe, setSociete] = useState("LOTIER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [showCreds, setShowCreds] = useState(false);

  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, nomGed: "", nom: "Racine" }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [browseErr, setBrowseErr] = useState("");

  useEffect(() => {
    fetch("/api/ics/ged").then(r => r.json()).then(d => {
      if (d.ged) { setCfg(d.ged); setSociete(d.ged.societe ?? "LOTIER"); setEmail(d.ged.email ?? ""); setShowCreds(!d.ged.hasPassword); }
    }).catch(() => {});
  }, []);

  const browse = useCallback(async (id: number | null, nomGed: string) => {
    setLoading(true); setBrowseErr("");
    try {
      const q = id != null ? `?id=${id}&nomGed=${encodeURIComponent(nomGed)}` : "";
      const r = await fetch(`/api/ics/ged/browse${q}`);
      const d = await r.json();
      if (!r.ok) { setBrowseErr(d.error || "Dossier inaccessible."); setFolders([]); setDocs([]); return; }
      setFolders(d.folders ?? []); setDocs(d.docs ?? []);
    } catch { setBrowseErr("Erreur réseau."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (cfg?.lastTestOk) browse(null, ""); }, [cfg?.lastTestOk, browse]);

  function openFolder(f: Folder) {
    setCrumbs(c => [...c, { id: f.idArbo, nomGed: f.nomGed, nom: f.nom }]);
    browse(f.idArbo, f.nomGed);
  }
  function goCrumb(i: number) {
    const c = crumbs[i]; setCrumbs(cs => cs.slice(0, i + 1)); browse(c.id, c.nomGed);
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { societe, email };
      if (password) body.password = password;
      const r = await fetch("/api/ics/ged", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setMsg({ k: "err", t: d.error || "Erreur" }); return; }
      setPassword(""); setCfg(c => ({ ...(c ?? { lastTestOk: false, lastError: null }), societe, email, hasPassword: true } as GedCfg));
      setMsg({ k: "ok", t: "Identifiants GED enregistrés (chiffrés)." });
    } catch { setMsg({ k: "err", t: "Erreur réseau" }); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true); setMsg(null);
    try {
      const r = await fetch("/api/ics/ged", { method: "PUT" });
      const d = await r.json();
      if (d.ok) { setMsg({ k: "ok", t: `✓ Accès GED réussi (portefeuille ${d.portefeuille ?? "—"}).` }); setCfg(c => c ? { ...c, lastTestOk: true, lastError: null } : c); browse(null, ""); setShowCreds(false); }
      else setMsg({ k: "err", t: d.error || "Échec de l'accès GED." });
    } catch { setMsg({ k: "err", t: "Erreur réseau" }); }
    finally { setTesting(false); }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Documents ICS — GED en direct</div>
        {cfg?.hasPassword && canEdit && (
          <button onClick={() => setShowCreds(s => !s)} style={linkBtn}>{showCreds ? "Masquer les identifiants" : "Identifiants GED"}</button>
        )}
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>
        Consultez les documents directement depuis la GED ICS (aucune copie). Naviguez dans les dossiers ; un clic ouvre le PDF.
      </p>

      {(showCreds || !cfg?.hasPassword) && canEdit && (
        <div style={{ background: "#FAFAF8", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <L label="Société"><input value={societe} onChange={e => setSociete(e.target.value)} placeholder="LOTIER" style={inp} /></L>
            <L label="Email"><input value={email} onChange={e => setEmail(e.target.value)} placeholder="gestion@…" style={inp} /></L>
          </div>
          <div style={{ marginTop: 10 }}>
            <L label={cfg?.hasPassword ? "Mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={cfg?.hasPassword ? "••••••••" : "Mot de passe GED"} style={inp} />
            </L>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "…" : "Enregistrer"}</button>
            <button onClick={test} disabled={testing || !cfg?.hasPassword} style={btnGhost}>{testing ? "Test…" : "Tester l'accès GED"}</button>
            {msg && <span style={{ fontSize: 12, color: msg.k === "ok" ? GREEN : RED }}>{msg.t}</span>}
          </div>
        </div>
      )}

      {cfg?.lastTestOk ? (
        <>
          {/* Fil d'Ariane */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, marginBottom: 10 }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {i > 0 && <span style={{ color: "#cbd5e1" }}>/</span>}
                <button onClick={() => goCrumb(i)} style={{ ...linkBtn, color: i === crumbs.length - 1 ? DARK : GOLD, fontWeight: i === crumbs.length - 1 ? 700 : 600 }}>{c.nom}</button>
              </span>
            ))}
          </div>

          {loading ? <div style={{ color: "#9ca3af", fontSize: 13, padding: 20, textAlign: "center" }}>Chargement…</div>
            : browseErr ? <div style={{ color: RED, fontSize: 13, padding: 16 }}>{browseErr}</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 420, overflowY: "auto" }}>
                {folders.length === 0 && docs.length === 0 && <div style={{ color: "#9ca3af", fontSize: 13, padding: 16, textAlign: "center" }}>Dossier vide.</div>}
                {folders.map(f => (
                  <button key={`f${f.idArbo}`} onClick={() => openFolder(f)} style={rowBtn}>
                    <span style={{ fontSize: 15 }}>📁</span>
                    <span style={{ flex: 1, textAlign: "left", color: DARK, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</span>
                    {f.type && <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{f.type}</span>}
                    <span style={{ color: "#cbd5e1" }}>›</span>
                  </button>
                ))}
                {docs.map(d => (
                  <a key={`d${d.guid}`} href={`/api/ics/ged/file?emplacement=${encodeURIComponent(d.emplacement)}&guid=${encodeURIComponent(d.guid)}&name=${encodeURIComponent(d.nom)}`}
                    target="_blank" rel="noopener noreferrer" style={{ ...rowBtn, textDecoration: "none" }}>
                    <span style={{ fontSize: 15 }}>📄</span>
                    <span style={{ flex: 1, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nom}</span>
                    {d.size ? <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{fmtSize(d.size)}</span> : null}
                  </a>
                ))}
              </div>
            )}
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "10px 0" }}>
          Renseignez les identifiants GED puis cliquez « Tester l&apos;accès GED » pour afficher les documents.
        </div>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const linkBtn: React.CSSProperties = { background: "none", border: "none", color: GOLD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 };
const rowBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, cursor: "pointer" };
