"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const GOLD = "#B8966A"; const NAVY = "#1A3A5C"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const RED = "#DC2626"; const GREEN = "#2F855A";

const card: React.CSSProperties = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 14 };
const h2: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 };
const lbl: React.CSSProperties = { fontSize: 12, color: "#666", display: "block", marginBottom: 3 };
const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, boxSizing: "border-box", outline: "none" };
const grid = (n: number): React.CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 10 });

interface Data {
  civilite: "M" | "Mme" | "MM" | "asso" | "societe"; prenom1: string; nom1: string; email1: string;
  prenom2: string; nom2: string; email2: string;
  agentPrenom: string; agentNom: string; agentTel: string; agentEmail: string;
  adresse: string; etage: string; numPorte: string;
  typeLgt: "nu" | "meuble" | "commercial"; dateEntree: string;
  loyer: string; charges: string; hono: string; depot: string;
  pdlEdf: string; ancienEdf: string; numEau: string; ancienEau: string; numGaz: string; ancienGaz: string;
}
const EMPTY: Data = {
  civilite: "M", prenom1: "", nom1: "", email1: "", prenom2: "", nom2: "", email2: "",
  agentPrenom: "", agentNom: "", agentTel: "", agentEmail: "",
  adresse: "", etage: "", numPorte: "", typeLgt: "nu", dateEntree: "",
  loyer: "", charges: "", hono: "", depot: "", pdlEdf: "", ancienEdf: "", numEau: "", ancienEau: "", numGaz: "", ancienGaz: "",
};

export default function MailBienvenuePage() {
  const { data: session } = useSession();
  const [d, setD] = useState<Data>(EMPTY);
  const [second, setSecond] = useState(false);
  const [files, setFiles] = useState<{ filename: string; content: string; mime: string }[]>([]);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof Data, v: string) => setD(p => ({ ...p, [k]: v }));

  // Préremplit l'agent avec l'utilisateur connecté.
  useEffect(() => {
    const u = session?.user as { name?: string; email?: string } | undefined;
    if (!u) return;
    const parts = (u.name || "").split(" ");
    setD(p => ({ ...p, agentPrenom: p.agentPrenom || parts[0] || "", agentNom: p.agentNom || parts.slice(1).join(" ") || "", agentEmail: p.agentEmail || u.email || "" }));
  }, [session]);

  // Calcul du dépôt + prorata + total (aperçu).
  const nums = () => {
    const loyer = parseFloat(d.loyer) || 0, charges = parseFloat(d.charges) || 0, hono = parseFloat(d.hono) || 0;
    let depot = parseFloat(d.depot) || 0;
    if (!depot) depot = d.typeLgt === "meuble" ? loyer * 2 : d.typeLgt === "commercial" ? 0 : loyer;
    const base = loyer + charges;
    let jm = 30, jo = 0, pro = 0;
    if (d.dateEntree) { const dt = new Date(d.dateEntree); jm = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(); jo = jm - dt.getDate() + 1; pro = base / jm * jo; }
    return { loyer, charges, hono, depot, base, jm, jo, pro, total: pro + depot + hono };
  };
  const a = nums();

  async function onFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      if (f.size > 8 * 1024 * 1024) { alert(`« ${f.name} » dépasse 8 Mo.`); continue; }
      const content = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
      setFiles(p => [...p, { filename: f.name, content, mime: f.type || "application/pdf" }]);
    }
  }

  const payload = useCallback(() => ({
    data: { ...d, loyer: parseFloat(d.loyer) || 0, charges: parseFloat(d.charges) || 0, hono: parseFloat(d.hono) || 0, depot: parseFloat(d.depot) || 0, prenom2: second ? d.prenom2 : "", nom2: second ? d.nom2 : "", email2: second ? d.email2 : "" },
    attachments: files,
  }), [d, second, files]);

  async function doPreview() {
    setBusy(true);
    try {
      const r = await fetch("/api/gestion/mail-bienvenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: true, ...payload() }) });
      const j = await r.json();
      setPreview(j.html || "");
    } catch { /* ignore */ }
    setBusy(false);
  }
  async function send() {
    if (!d.email1.trim()) { alert("Renseignez l'email du locataire."); return; }
    if (!confirm("Envoyer le mail de bienvenue au(x) locataire(s) (copie gestion@ et vous) ?")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/gestion/mail-bienvenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const j = await r.json();
      if (r.ok && j.ok) { setMsg({ ok: true, text: `Envoyé à ${j.sentTo.join(", ")} (copie : ${j.cc.join(", ")}).` }); }
      else setMsg({ ok: false, text: j.error || "Envoi échoué." });
    } catch { setMsg({ ok: false, text: "Erreur réseau." }); }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="mail-bienvenue" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Mail de bienvenue" />
        <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: "0 0 4px" }}>🏠 Mail de bienvenue locataire</h1>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 18 }}>Remplissez le dossier : le locataire reçoit un mail de bienvenue (envoyé depuis collab@, copie à gestion@ et à vous, RIB en PDF joint).</p>

          <div style={card}>
            <div style={h2}>Locataire(s)</div>
            <div style={grid(4)}>
              <div><label style={lbl}>Civilité</label>
                <select value={d.civilite} onChange={e => set("civilite", e.target.value)} style={inp}>
                  <option value="M">Monsieur</option><option value="Mme">Madame</option><option value="MM">Monsieur et Madame</option>
                  <option value="asso">Association</option><option value="societe">Société</option>
                </select></div>
              <div><label style={lbl}>Prénom</label><input value={d.prenom1} onChange={e => set("prenom1", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Nom</label><input value={d.nom1} onChange={e => set("nom1", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Email</label><input type="email" value={d.email1} onChange={e => set("email1", e.target.value)} style={inp} /></div>
            </div>
            {second && (
              <div style={{ ...grid(4), marginTop: 10 }}>
                <div style={{ alignSelf: "end", color: GOLD, fontWeight: 600, fontSize: 12 }}>2ème locataire</div>
                <div><label style={lbl}>Prénom</label><input value={d.prenom2} onChange={e => set("prenom2", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Nom</label><input value={d.nom2} onChange={e => set("nom2", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Email</label><input type="email" value={d.email2} onChange={e => set("email2", e.target.value)} style={inp} /></div>
              </div>
            )}
            <button onClick={() => setSecond(s => !s)} style={{ marginTop: 10, background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "5px 10px", fontSize: 12, color: NAVY, cursor: "pointer" }}>{second ? "− Retirer le 2ème locataire" : "+ 2ème locataire"}</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={h2}>Agent en charge</div>
              <div style={grid(2)}>
                <div><label style={lbl}>Prénom</label><input value={d.agentPrenom} onChange={e => set("agentPrenom", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Nom</label><input value={d.agentNom} onChange={e => set("agentNom", e.target.value)} style={inp} /></div>
              </div>
              <div style={{ marginTop: 8 }}><label style={lbl}>Téléphone</label><input value={d.agentTel} onChange={e => set("agentTel", e.target.value)} placeholder="06 XX XX XX XX" style={inp} /></div>
              <div style={{ marginTop: 8 }}><label style={lbl}>Email</label><input type="email" value={d.agentEmail} onChange={e => set("agentEmail", e.target.value)} style={inp} /></div>
            </div>
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={h2}>Logement</div>
              <div><label style={lbl}>Adresse</label><input value={d.adresse} onChange={e => set("adresse", e.target.value)} style={inp} /></div>
              <div style={{ ...grid(2), marginTop: 8 }}>
                <div><label style={lbl}>Étage</label><input value={d.etage} onChange={e => set("etage", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>N° de porte</label><input value={d.numPorte} onChange={e => set("numPorte", e.target.value)} style={inp} /></div>
              </div>
              <div style={{ ...grid(2), marginTop: 8 }}>
                <div><label style={lbl}>Type</label>
                  <select value={d.typeLgt} onChange={e => set("typeLgt", e.target.value)} style={inp}>
                    <option value="nu">Non meublé</option><option value="meuble">Meublé</option><option value="commercial">Local commercial</option>
                  </select></div>
                <div><label style={lbl}>Date d&apos;entrée</label><input type="date" value={d.dateEntree} onChange={e => set("dateEntree", e.target.value)} style={inp} /></div>
              </div>
            </div>
          </div>

          <div style={{ ...card, marginTop: 14 }}>
            <div style={h2}>Éléments financiers</div>
            <div style={grid(4)}>
              <div><label style={lbl}>Loyer HC (€)</label><input type="number" value={d.loyer} onChange={e => set("loyer", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Charges (€)</label><input type="number" value={d.charges} onChange={e => set("charges", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Honoraires (€)</label><input type="number" value={d.hono} onChange={e => set("hono", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Dépôt (€) — auto</label><input type="number" value={d.depot} onChange={e => set("depot", e.target.value)} placeholder={a.depot ? String(a.depot) : "auto"} style={inp} /></div>
            </div>
            <div style={{ background: "#f8f5f0", border: "1px solid #e8dcc8", borderRadius: 6, padding: 10, fontSize: 12.5, color: "#5a4a2a", marginTop: 10 }}>
              Prorata {a.jo || "?"}j/{a.jm}j : <strong>{a.pro.toFixed(2)} €</strong> · Dépôt : <strong>{a.depot.toFixed(2)} €</strong> · Honoraires : <strong>{a.hono.toFixed(2)} €</strong> · <strong style={{ color: NAVY }}>TOTAL : {a.total.toFixed(2)} €</strong>
            </div>
          </div>

          <div style={card}>
            <div style={h2}>Compteurs</div>
            <div style={grid(2)}>
              <div><label style={lbl}>PDL EDF</label><input value={d.pdlEdf} onChange={e => set("pdlEdf", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Ancien titulaire EDF</label><input value={d.ancienEdf} onChange={e => set("ancienEdf", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>N° compteur eau</label><input value={d.numEau} onChange={e => set("numEau", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Ancien titulaire eau</label><input value={d.ancienEau} onChange={e => set("ancienEau", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>N° compteur gaz</label><input value={d.numGaz} onChange={e => set("numGaz", e.target.value)} placeholder="Vide si absent" style={inp} /></div>
              <div><label style={lbl}>Ancien titulaire gaz</label><input value={d.ancienGaz} onChange={e => set("ancienGaz", e.target.value)} style={inp} /></div>
            </div>
          </div>

          <div style={card}>
            <div style={h2}>Pièces jointes</div>
            <div style={{ background: "#f0f7ec", border: "1px solid #c3ddb0", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#3a6e1a", marginBottom: 8 }}>📄 RIB LOTIER (PDF) — joint automatiquement</div>
            <label style={{ display: "block", border: "1px dashed #ccc", borderRadius: 6, padding: 12, textAlign: "center", cursor: "pointer", fontSize: 12, color: "#888" }}>
              + Ajouter d&apos;autres PDF
              <input type="file" accept=".pdf" multiple onChange={e => onFiles(e.target.files)} style={{ display: "none" }} />
            </label>
            {files.map((f, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, background: "#f5f5f5", padding: "5px 9px", borderRadius: 5, marginTop: 4 }}>
                <span>📎 {f.filename}</span>
                <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 15 }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <button onClick={doPreview} disabled={busy} style={{ background: "#fff", color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>👁 Aperçu du mail</button>
            <button onClick={send} disabled={busy} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{busy ? "…" : "✉️ Envoyer le mail de bienvenue"}</button>
          </div>

          {msg && <div style={{ background: msg.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${msg.ok ? "#BBF7D0" : "#FECACA"}`, color: msg.ok ? GREEN : RED, borderRadius: 10, padding: "12px 16px", fontSize: 13, marginBottom: 16 }}>{msg.ok ? "✓ " : "⚠️ "}{msg.text}</div>}

          {preview && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Aperçu</div>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#f4f4f4", padding: 16 }} dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
