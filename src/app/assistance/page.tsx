"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6"; const GREEN = "#2F855A"; const RED = "#9B2C2C";

interface Photo { id: string; name: string; mime: string; data: string }
interface Req {
  id: string; token: string; role: string; status: string;
  contactName?: string; contactPhone?: string; contactEmail?: string; address?: string;
  description?: string; photos?: Photo[]; odsId?: string; createdAt: string; submittedAt?: string;
}
interface Supplier { id: string; name: string; type: string; email?: string }

const STATUS: Record<string, { label: string; color: string }> = {
  nouvelle: { label: "Lien créé", color: "#6b7280" },
  soumise:  { label: "Reçue", color: "#2563EB" },
  ods_cree: { label: "ODS créé", color: GREEN },
  cloturee: { label: "Clôturée", color: "#9ca3af" },
};

export default function AssistancePage() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ role: "locataire", contactName: "", contactPhone: "", contactEmail: "", address: "", sendEmail: false });
  const [lastLink, setLastLink] = useState("");
  const [odsFor, setOdsFor] = useState<Req | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [odsInitial, setOdsInitial] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [visioFor, setVisioFor] = useState<{ name?: string; email?: string } | null>(null);

  async function analyze(r: Req) {
    setAnalyzing(r.id);
    try {
      const res = await fetch(`/api/assistance/${r.id}/auguste`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { alert(d.error || "Analyse impossible."); return; }
      setOdsInitial({
        supplierId: d.supplier?.id ?? "",
        type: d.interventionType ?? "",
        urgency: d.urgency ?? "normal",
        summary: d.summary, confidence: d.confidence, reason: d.reason,
        supplierName: d.supplier?.name, supplierHasEmail: !!d.supplier?.email,
      });
      setOdsFor(r);
    } catch { alert("Erreur réseau."); }
    finally { setAnalyzing(null); }
  }

  const load = useCallback(async () => {
    try { const r = await fetch("/api/assistance"); if (r.ok) { const d = await r.json(); setRequests(d.requests ?? []); } } catch { /* */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createLink() {
    setCreating(true); setLastLink("");
    try {
      const r = await fetch("/api/assistance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (r.ok) { setLastLink(d.url); setForm(f => ({ ...f, contactName: "", contactPhone: "", contactEmail: "", address: "" })); load(); }
      else alert(d.error || "Échec");
    } finally { setCreating(false); }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="assistance" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Assistance locataire" />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Créer un lien */}
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 4 }}>Envoyer un lien d'assistance</div>
              <p style={{ fontSize: 12.5, color: "#6b7280", margin: "0 0 14px", lineHeight: 1.5 }}>
                Quand un locataire (ou copropriétaire) appelle, créez-lui un lien : il décrira son problème et enverra des photos depuis son téléphone. À réception, vous transformez la demande en ordre de service.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inp}>
                  <option value="locataire">Locataire</option>
                  <option value="coproprietaire">Copropriétaire</option>
                </select>
                <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Nom" style={inp} />
                <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="Téléphone" style={inp} />
                <input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="Email (pour envoyer le lien)" style={inp} />
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adresse du logement" style={{ ...inp, gridColumn: "1 / -1" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.sendEmail} onChange={e => setForm(f => ({ ...f, sendEmail: e.target.checked }))} disabled={!form.contactEmail} />
                  Envoyer le lien par email
                </label>
                <button onClick={createLink} disabled={creating} style={btnGold}>{creating ? "Création…" : "Créer le lien"}</button>
                <button onClick={() => setVisioFor({ name: form.contactName, email: form.contactEmail })} style={btnGhost} title="Démarrer une visio en direct avec le locataire">📹 Visio en direct</button>
              </div>
              {lastLink && (
                <div style={{ marginTop: 12, background: GOLD_BG, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: DARK, wordBreak: "break-all", flex: 1 }}>{lastLink}</span>
                  <button onClick={() => navigator.clipboard?.writeText(lastLink)} style={btnGhost}>Copier</button>
                  <a href={`sms:?&body=${encodeURIComponent("Déclarez votre problème ici : " + lastLink)}`} style={{ ...btnGhost, textDecoration: "none" }}>SMS</a>
                </div>
              )}
            </div>

            {/* Demandes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Demandes reçues</div>
              {requests.length === 0 && <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: 22, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Aucune demande pour le moment.</div>}
              {requests.map(r => {
                const st = STATUS[r.status] ?? { label: r.status, color: "#6b7280" };
                return (
                  <div key={r.id} style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ background: st.color + "20", color: st.color, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{r.contactName || "—"}</span>
                      {r.contactPhone && <span style={{ fontSize: 12, color: "#6b7280" }}>📞 {r.contactPhone}</span>}
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>· {r.role === "coproprietaire" ? "Copropriétaire" : "Locataire"}</span>
                      <div style={{ flex: 1 }} />
                      {r.status === "nouvelle" && (
                        <a href={`/declaration/${r.token}`} target="_blank" style={{ ...btnGhost, textDecoration: "none", fontSize: 12 }}>Ouvrir le lien</a>
                      )}
                      {r.status === "soumise" && (
                        <>
                          <button onClick={() => analyze(r)} disabled={analyzing === r.id} style={{ ...btnGhost, padding: "6px 12px", fontSize: 12, borderColor: GOLD, color: GOLD }}>
                            {analyzing === r.id ? "Analyse…" : "🤖 Analyse Auguste"}
                          </button>
                          <button onClick={() => { setOdsInitial(null); setOdsFor(r); }} style={{ ...btnGold, padding: "6px 12px", fontSize: 12 }}>Créer l'ODS</button>
                        </>
                      )}
                      {r.status === "ods_cree" && (
                        <a href="/ordres-de-service" style={{ ...btnGhost, textDecoration: "none", fontSize: 12 }}>Voir l'ODS →</a>
                      )}
                      <button onClick={() => setVisioFor({ name: r.contactName, email: r.contactEmail })} title="Visio en direct" style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }}>📹</button>
                    </div>
                    {r.address && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>📍 {r.address}</div>}
                    {r.description && <div style={{ fontSize: 13, color: DARK, marginTop: 6, lineHeight: 1.4 }}>{r.description}</div>}
                    {r.photos && r.photos.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {r.photos.map(p => (
                          <a key={p.id} href={`data:${p.mime};base64,${p.data}`} target="_blank" rel="noreferrer">
                            <img src={`data:${p.mime};base64,${p.data}`} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: `1px solid ${BORDER}` }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {odsFor && <ToOdsModal req={odsFor} initial={odsInitial} onClose={() => { setOdsFor(null); setOdsInitial(null); }} onDone={() => { setOdsFor(null); setOdsInitial(null); load(); }} />}
      {visioFor && <VisioModal contact={visioFor} onClose={() => setVisioFor(null)} />}
    </div>
  );
}

function VisioModal({ contact, onClose }: { contact: { name?: string; email?: string }; onClose: () => void }) {
  const [name, setName] = useState(contact.name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function generate(sendEmail: boolean) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/visio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactName: name, contactEmail: email, sendEmail }) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Échec."); return; }
      setUrl(d.cleanUrl);
      if (sendEmail) setMsg(d.emailed ? "Lien envoyé par email." : "Lien généré (email non configuré).");
    } catch { setMsg("Erreur réseau."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 440, maxWidth: "94vw", background: "#fff", borderRadius: 16, zIndex: 70, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: DARK }}>📹 Visio en direct</div>
        <div style={{ fontSize: 12.5, color: "#6b7280" }}>Envoyez un lien : le locataire ouvre la vidéo sur son téléphone (sans installation) et vous montre le problème en direct.</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du contact" style={inp} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (pour envoyer le lien)" style={inp} />
        {!url ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button onClick={onClose} style={btnGhost}>Annuler</button>
            <button onClick={() => generate(false)} disabled={busy} style={{ ...btnGhost, borderColor: GOLD, color: GOLD }}>Générer le lien</button>
            <button onClick={() => generate(true)} disabled={busy || !email} style={btnGold}>✉️ Envoyer par email</button>
          </div>
        ) : (
          <>
            <div style={{ background: GOLD_BG, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: DARK, wordBreak: "break-all" }}>{url}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => navigator.clipboard?.writeText(url)} style={btnGhost}>Copier</button>
              <a href={`sms:?&body=${encodeURIComponent("Visio avec votre agence : " + url)}`} style={{ ...btnGhost, textDecoration: "none" }}>SMS</a>
              <a href={url} target="_blank" rel="noreferrer" style={{ ...btnGold, textDecoration: "none" }}>Rejoindre</a>
            </div>
          </>
        )}
        {msg && <div style={{ fontSize: 12, color: msg.includes("Échec") || msg.includes("réseau") ? RED : GREEN }}>{msg}</div>}
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToOdsModal({ req, initial, onClose, onDone }: { req: Req; initial?: any; onClose: () => void; onDone: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [urgency, setUrgency] = useState(initial?.urgency ?? "normal");
  const [quote, setQuote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/fournisseurs").then(r => r.json()).then(d => { if (Array.isArray(d)) setSuppliers(d.filter((s: Supplier & { active: boolean }) => s.active)); }).catch(() => {});
  }, []);

  async function create(send: boolean) {
    if (!supplierId) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/assistance/${req.id}/to-ods`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, interventionType: type, urgency, quoteRequired: quote }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Échec."); return; }
      if (send && d.odsId) {
        if (!d.supplierEmail) { setMsg(`ODS ${d.ref} créé, mais le fournisseur n'a pas d'email.`); }
        else {
          const s = await fetch(`/api/ods/${d.odsId}/send`, { method: "POST" });
          const sd = await s.json();
          if (!s.ok) { setMsg(`ODS ${d.ref} créé, envoi échoué : ${sd.error || ""}`); }
          else { onDone(); return; }
        }
      } else {
        onDone(); return;
      }
    } catch { setMsg("Erreur réseau."); }
    finally { setBusy(false); }
  }

  const selected = suppliers.find(s => s.id === supplierId);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 460, maxWidth: "94vw", background: "#fff", borderRadius: 16, zIndex: 70, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: DARK }}>Créer l'ordre de service</div>
        <div style={{ fontSize: 12.5, color: "#6b7280" }}>Reprend l'adresse, la description, le contact et les photos de la demande de {req.contactName || "le déclarant"}.</div>
        {initial?.summary && (
          <div style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: DARK }}>
            <div style={{ fontWeight: 700, marginBottom: 3 }}>🤖 Analyse d'Auguste{typeof initial.confidence === "number" ? ` — confiance ${Math.round(initial.confidence * 100)}%` : ""}</div>
            <div>{initial.summary}</div>
            {initial.supplierName && <div style={{ marginTop: 4, color: "#6b7280" }}>Fournisseur suggéré : <strong>{initial.supplierName}</strong>{initial.reason ? ` — ${initial.reason}` : ""}</div>}
          </div>
        )}
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={inp}>
          <option value="">— Fournisseur —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type}){s.email ? "" : " — sans email"}</option>)}
        </select>
        <input value={type} onChange={e => setType(e.target.value)} placeholder="Type d'intervention (Plomberie…)" style={inp} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={urgency} onChange={e => setUrgency(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="normal">Normale</option>
            <option value="urgent">Urgente</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
            <input type="checkbox" checked={quote} onChange={e => setQuote(e.target.checked)} /> Devis avant
          </label>
        </div>
        {msg && <div style={{ fontSize: 12, color: msg.includes("échou") || msg.includes("Échec") ? RED : "#6b7280" }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={onClose} style={btnGhost}>Annuler</button>
          <button onClick={() => create(false)} disabled={!supplierId || busy} style={{ ...btnGhost, borderColor: GOLD, color: GOLD }}>{busy ? "…" : "Créer (brouillon)"}</button>
          <button onClick={() => create(true)} disabled={!supplierId || busy || !selected?.email} title={!selected?.email ? "Fournisseur sans email" : ""} style={{ ...btnGold, opacity: !supplierId || !selected?.email ? 0.5 : 1 }}>✉️ Créer et envoyer</button>
        </div>
      </div>
    </>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, color: DARK, outline: "none", background: "#fff", boxSizing: "border-box" };
const btnGold: React.CSSProperties = { padding: "8px 16px", borderRadius: 9, border: "none", background: GOLD, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { padding: "8px 14px", borderRadius: 9, border: `1px solid ${BORDER}`, background: "#fff", fontSize: 13, fontWeight: 500, color: DARK, cursor: "pointer" };
