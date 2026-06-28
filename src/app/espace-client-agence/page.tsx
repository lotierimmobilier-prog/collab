"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";

interface InsStatus { state: "absente" | "valide" | "bientot" | "expiree"; label: string; validUntil: string | null; days: number | null }
interface Client { id: string; prenom: string; nom: string; email: string | null; hasPortal: boolean; uploads: number; insurance?: InsStatus }

const INS_COLOR: Record<string, string> = { valide: "#059669", bientot: "#d97706", expiree: "#dc2626", absente: "#9ca3af" };
function InsBadge({ ins, compact }: { ins?: InsStatus; compact?: boolean }) {
  if (!ins) return null;
  const c = INS_COLOR[ins.state];
  const short = ins.state === "valide" ? "Assurance OK" : ins.state === "bientot" ? "Assurance bientôt" : ins.state === "expiree" ? "Assurance expirée" : "Sans assurance";
  return <span title={ins.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: c, border: `1px solid ${c}33`, background: `${c}14`, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>🛡 {compact ? short : ins.label}</span>;
}
interface Doc { id: string; source: string; category: string; fileName: string; mime: string | null; size: number | null; createdAt: string }

const CAT_LABEL: Record<string, string> = {
  assurance: "Assurance habitation", chaudiere: "Entretien chaudière", climatisation: "Entretien climatisation",
  bail: "Bail", etat_lieux: "État des lieux", quittance: "Quittance", attestation_loyer: "Attestation de loyer", caf: "Document CAF", autre: "Document",
};
const AGENCY_CATS = [
  { id: "bail", label: "Bail" }, { id: "etat_lieux", label: "État des lieux" },
  { id: "quittance", label: "Quittance de loyer" }, { id: "attestation_loyer", label: "Attestation de loyer" },
  { id: "caf", label: "Document CAF" }, { id: "autre", label: "Autre document" },
];

export default function EspaceClientAgencePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/agency/clients").then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter(c => { const s = q.toLowerCase(); return !s || `${c.prenom} ${c.nom} ${c.email ?? ""}`.toLowerCase().includes(s); });
  const stats = {
    total: clients.length, portal: clients.filter(c => c.hasPortal).length, uploads: clients.reduce((s, c) => s + c.uploads, 0),
    insAlert: clients.filter(c => c.insurance && (c.insurance.state === "bientot" || c.insurance.state === "expiree")).length,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="espace-client" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Espace client" />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <Stat label="Locataires" value={stats.total} />
              <Stat label="Accès portail" value={stats.portal} color="#059669" />
              <Stat label="Justificatifs reçus" value={stats.uploads} color={GOLD} />
              <Stat label="Assurances à relancer" value={stats.insAlert} color={stats.insAlert ? "#dc2626" : DARK} />
            </div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un locataire…"
              style={{ width: "100%", maxWidth: 360, height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", background: "#fff", marginBottom: 16 }} />

            {loading ? <div style={{ color: "#9ca3af", fontSize: 13, padding: 30, textAlign: "center" }}>Chargement…</div> : (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                {filtered.map((c, i) => (
                  <div key={c.id} onClick={() => setSel(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < filtered.length - 1 ? `1px solid #f4f1ec` : "none", cursor: "pointer" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F7F0E6", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{(c.prenom[0] ?? "").toUpperCase()}{(c.nom[0] ?? "").toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{c.prenom} {c.nom}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email || "— pas d'email —"}</div>
                    </div>
                    {c.insurance && c.insurance.state !== "valide" && c.insurance.state !== "absente" && <InsBadge ins={c.insurance} compact />}
                    {c.uploads > 0 && <span style={{ background: "#F7F0E6", color: GOLD, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{c.uploads} justif.</span>}
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.hasPortal ? "#059669" : "#d1d5db" }}>{c.hasPortal ? "● Portail" : "○ sans email"}</span>
                    <span style={{ color: "#d1d5db" }}>›</span>
                  </div>
                ))}
                {filtered.length === 0 && <div style={{ color: "#9ca3af", fontSize: 13, padding: 30, textAlign: "center" }}>Aucun locataire.</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {sel && <ClientPanel client={sel} onClose={() => { setSel(null); load(); }} />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 16px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? DARK }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{label}</div>
    </div>
  );
}

function ClientPanel({ client, onClose }: { client: Client; onClose: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [category, setCategory] = useState("bail");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => { fetch(`/api/agency/clients/${client.id}/docs`).then(r => r.json()).then(d => setDocs(d.documents || [])).catch(() => {}); }, [client.id]);
  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    setMsg("");
    if (file.size > 10 * 1024 * 1024) { setMsg("Fichier trop volumineux (max 10 Mo)."); return; }
    setBusy(true);
    try {
      const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
      const r = await fetch(`/api/agency/clients/${client.id}/docs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, fileName: file.name, mime: file.type, size: file.size, data }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error || "Échec du dépôt."); return; }
      load();
    } catch { setMsg("Erreur lors du dépôt."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function del(id: string) { if (!confirm("Supprimer ce document ?")) return; await fetch(`/api/agency/docs/${id}`, { method: "DELETE" }).catch(() => {}); load(); }
  async function invite() {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/tenants/${client.id}/invite`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? `✓ Invitation envoyée à ${d.to}` : (d.error || "Échec de l'invitation."));
    setBusy(false);
  }
  async function relanceAssurance() {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/agency/clients/${client.id}/relance-assurance`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? "✓ Relance d'assurance envoyée au locataire." : (d.error || "Échec de la relance."));
    setBusy(false);
  }

  const agency = docs.filter(d => d.source === "agency");
  const tenant = docs.filter(d => d.source === "tenant");

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, maxWidth: "94vw", background: "#fff", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.14)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{client.prenom} {client.nom}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{client.email || "pas d'email"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {/* Inviter */}
          <div style={{ marginBottom: 18 }}>
            <button onClick={invite} disabled={busy || !client.email} style={{ background: client.email ? GOLD : "#e5e7eb", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: client.email ? "pointer" : "default" }}>✉ {client.email ? "Renvoyer l'invitation au portail" : "Pas d'email"}</button>
            {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? "#059669" : "#dc2626", marginTop: 8 }}>{msg}</div>}
          </div>

          {/* Suivi de l'assurance */}
          {client.insurance && (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 8 }}>Assurance habitation</div>
              <div style={{ marginBottom: 10 }}><InsBadge ins={client.insurance} /></div>
              <button onClick={relanceAssurance} disabled={busy || !client.email || client.insurance.state === "absente"}
                style={{ background: client.email && client.insurance.state !== "absente" ? "#1C1A17" : "#e5e7eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: client.email && client.insurance.state !== "absente" ? "pointer" : "default" }}>
                🛡 Relancer l'assurance par email
              </button>
              {client.insurance.state === "absente" && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 6 }}>Aucune attestation déposée — rien à relancer.</div>}
            </div>
          )}

          {/* Déposer un document */}
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 8 }}>Déposer un document pour le locataire</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, background: "#fff" }}>
                {AGENCY_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} disabled={busy} style={{ fontSize: 13 }} />
              {busy && <div style={{ fontSize: 12, color: GOLD }}>Envoi…</div>}
            </div>
          </div>

          <DocList title="Documents fournis par l'agence" docs={agency} onDelete={del} />
          <DocList title="Justificatifs reçus du locataire" docs={tenant} onDelete={del} empty="Aucun justificatif reçu." />
        </div>
      </div>
    </>
  );
}

function DocList({ title, docs, onDelete, empty }: { title: string; docs: Doc[]; onDelete: (id: string) => void; empty?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{title}</div>
      {docs.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>{empty || "Aucun document."}</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {docs.map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 11px" }}>
              <span style={{ fontSize: 16 }}>📎</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fileName}</div>
                <div style={{ fontSize: 10.5, color: "#9ca3af" }}>{CAT_LABEL[d.category] || "Document"} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}</div>
              </div>
              <a href={`/api/agency/docs/${d.id}`} title="Télécharger" style={{ textDecoration: "none", color: GOLD, fontWeight: 700, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "5px 9px", fontSize: 12 }}>↓</a>
              <button onClick={() => onDelete(d.id)} title="Supprimer" style={{ background: "none", border: "1px solid #fecaca", borderRadius: 7, padding: "5px 8px", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
