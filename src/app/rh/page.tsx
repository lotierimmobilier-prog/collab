"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const AMBER = "#B45309"; const GREEN = "#2F855A"; const BLUE = "#2563EB";

const LEAVE_TYPES = [
  { id: "conges_payes", label: "Congés payés" },
  { id: "rtt", label: "RTT" },
  { id: "maladie", label: "Arrêt maladie" },
  { id: "sans_solde", label: "Sans solde" },
  { id: "recuperation", label: "Récupération" },
  { id: "autre", label: "Autre" },
];
const typeLabel = (id: string) => LEAVE_TYPES.find(t => t.id === id)?.label ?? id;
const LEAVE_ST: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: AMBER }, approuve: { label: "Approuvé", color: GREEN },
  refuse: { label: "Refusé", color: RED }, annule: { label: "Annulé", color: "#9ca3af" },
};
const HOURS_ST: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "#9ca3af" }, signe: { label: "Signé — à valider", color: BLUE },
  valide: { label: "Validé", color: GREEN }, refuse: { label: "Refusé", color: RED },
};

interface Leave { id: string; userId: string; type: string; startDate: string; endDate: string; halfDayStart: boolean; halfDayEnd: boolean; days?: number; reason?: string; status: string; decisionNote?: string; who?: string }
interface Hours { id: string; userId: string; month: string; totalHours?: number; note?: string; agentSigned: boolean; agentSignedAt?: string | null; agentSignatureName?: string; status: string; validationNote?: string; who?: string }

export default function RhPage() {
  const { data: session } = useSession();
  const isValidator = ["admin", "dirigeant", "direction"].includes(session?.user?.roleId ?? "");
  const [tab, setTab] = useState<"conges" | "heures" | "validation">("conges");

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="rh" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 24px" }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: DARK, margin: 0 }}>💼 Congés & heures</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>Vos demandes de congés et vos relevés d'heures mensuels.</p>
        </div>
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "0 24px", display: "flex", gap: 4 }}>
          <Tab label="Mes congés" active={tab === "conges"} onClick={() => setTab("conges")} />
          <Tab label="Mes heures" active={tab === "heures"} onClick={() => setTab("heures")} />
          {isValidator && <Tab label="Validation" active={tab === "validation"} onClick={() => setTab("validation")} />}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {tab === "conges" && <CongesTab />}
          {tab === "heures" && <HeuresTab />}
          {tab === "validation" && isValidator && <ValidationTab />}
        </div>
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", borderBottom: `2px solid ${active ? GOLD : "transparent"}`, color: active ? DARK : "#6b7280", fontWeight: active ? 600 : 500, fontSize: 13, padding: "12px 14px", cursor: "pointer" }}>{label}</button>;
}

// ── Mes congés ─────────────────────────────────────────────────────
function CongesTab() {
  const [list, setList] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/rh/leaves?scope=mine"); if (r.ok) setList(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  async function cancel(l: Leave) {
    if (!confirm("Annuler cette demande ?")) return;
    await fetch(`/api/rh/leaves/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    await load();
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", marginBottom: 14 }}>
        <div style={{ flex: 1, fontSize: 13, color: "#6b7280" }}>Vos demandes de congés et leur statut.</div>
        <button onClick={() => setShow(true)} style={btnGold}>+ Nouvelle demande</button>
      </div>
      {loading ? <Empty t="Chargement…" /> : list.length === 0 ? <Empty t="Aucune demande de congé." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(l => { const st = LEAVE_ST[l.status] ?? LEAVE_ST.en_attente; return (
            <div key={l.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${st.color}`, borderRadius: 10, padding: "11px 14px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: DARK }}>{typeLabel(l.type)} · {l.days} j</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{fmtRange(l)}{l.reason ? ` — ${l.reason}` : ""}</div>
                {l.decisionNote && <div style={{ fontSize: 11.5, color: st.color, marginTop: 2 }}>Direction : {l.decisionNote}</div>}
              </div>
              <span style={{ background: st.color + "20", color: st.color, borderRadius: 6, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{st.label}</span>
              {l.status === "en_attente" && <button onClick={() => cancel(l)} style={miniBtn}>Annuler</button>}
            </div>
          ); })}
        </div>
      )}
      {show && <LeaveForm onClose={() => setShow(false)} onSaved={async () => { setShow(false); await load(); }} />}
    </div>
  );
}

function LeaveForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ type: "conges_payes", startDate: "", endDate: "", halfDayStart: false, halfDayEnd: false, reason: "" });
  const [saving, setSaving] = useState(false);
  function set(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }
  async function submit() {
    if (!f.startDate || !f.endDate) return;
    setSaving(true);
    const r = await fetch("/api/rh/leaves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setSaving(false);
    if (r.ok) onSaved(); else { const d = await r.json().catch(() => ({})); alert(d.error || "Échec."); }
  }
  return (
    <Drawer title="Nouvelle demande de congé" onClose={onClose} onSubmit={submit} saving={saving} disabled={!f.startDate || !f.endDate}>
      <L label="Type"><select value={f.type} onChange={e => set("type", e.target.value)} style={inp}>{LEAVE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></L>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <L label="Du"><input type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} style={inp} /></L>
        <L label="Au"><input type="date" value={f.endDate} onChange={e => set("endDate", e.target.value)} style={inp} /></L>
      </div>
      <label style={ck}><input type="checkbox" checked={f.halfDayStart} onChange={e => set("halfDayStart", e.target.checked)} /> Le 1er jour : après-midi seulement</label>
      <label style={ck}><input type="checkbox" checked={f.halfDayEnd} onChange={e => set("halfDayEnd", e.target.checked)} /> Le dernier jour : matin seulement</label>
      <L label="Motif (facultatif)"><textarea value={f.reason} onChange={e => set("reason", e.target.value)} rows={2} style={{ ...inp, height: "auto", padding: "8px 10px" }} /></L>
    </Drawer>
  );
}

// ── Mes heures ─────────────────────────────────────────────────────
function HeuresTab() {
  const [list, setList] = useState<Hours[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [hours, setHours] = useState(""); const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState("");

  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/rh/hours?scope=mine"); if (r.ok) setList(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const current = list.find(h => h.month === month);
  const locked = current?.status === "valide";

  // Pré-remplit le formulaire quand on change de mois.
  useEffect(() => { const c = list.find(h => h.month === month); setHours(c?.totalHours != null ? String(c.totalHours) : ""); setNote(c?.note ?? ""); }, [month, list]);

  async function save(sign: boolean) {
    if (sign && !confirm(`Vous signez votre relevé d'heures de ${month} (${hours || 0} h). Cette signature électronique fait foi. Continuer ?`)) return;
    setSaving(true); setMsg("");
    const r = await fetch("/api/rh/hours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, totalHours: hours, note, sign }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok) { setMsg(sign ? "✓ Relevé signé et transmis à la direction." : "✓ Enregistré (brouillon)."); await load(); }
    else setMsg(d.error || "Échec.");
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 12 }}>Saisir mon relevé d'heures</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <L label="Mois"><input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} /></L>
          <L label="Total d'heures"><input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} style={inp} placeholder="ex. 151.67" disabled={locked} /></L>
        </div>
        <L label="Remarque (facultatif)"><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inp, height: "auto", padding: "8px 10px" }} disabled={locked} /></L>
        {current && <div style={{ fontSize: 12, marginTop: 4 }}>Statut : <b style={{ color: (HOURS_ST[current.status] ?? HOURS_ST.brouillon).color }}>{(HOURS_ST[current.status] ?? HOURS_ST.brouillon).label}</b>{current.agentSignedAt ? ` · signé le ${new Date(current.agentSignedAt).toLocaleDateString("fr-FR")}` : ""}{current.validationNote ? ` · Direction : ${current.validationNote}` : ""}</div>}
        {!locked && (
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => save(false)} disabled={saving} style={btnLight}>Enregistrer (brouillon)</button>
            <button onClick={() => save(true)} disabled={saving || !hours} style={btnGold}>✍ Signer et transmettre</button>
            {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✓") ? GREEN : RED }}>{msg}</span>}
          </div>
        )}
        {locked && <div style={{ fontSize: 12.5, color: GREEN, marginTop: 12 }}>✓ Relevé validé par la direction — verrouillé.</div>}
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>La signature enregistre votre nom, la date/heure et votre adresse IP comme preuve.</div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>HISTORIQUE</div>
      {loading ? <Empty t="Chargement…" /> : list.length === 0 ? <Empty t="Aucun relevé pour le moment." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(h => { const st = HOURS_ST[h.status] ?? HOURS_ST.brouillon; return (
            <div key={h.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${st.color}`, borderRadius: 10, padding: "10px 14px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: DARK }}>{fmtMonth(h.month)} · {h.totalHours ?? "—"} h</div>
                {h.note && <div style={{ fontSize: 12, color: "#6b7280" }}>{h.note}</div>}
              </div>
              <span style={{ background: st.color + "20", color: st.color, borderRadius: 6, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{st.label}</span>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

// ── Validation (direction) ─────────────────────────────────────────
function ValidationTab() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [hours, setHours] = useState<Hours[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const [l, h] = await Promise.all([fetch("/api/rh/leaves?scope=pending"), fetch("/api/rh/hours?scope=tovalidate")]);
    if (l.ok) setLeaves(await l.json()); if (h.ok) setHours(await h.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decideLeave(l: Leave, action: "approve" | "reject") {
    const note = action === "reject" ? (prompt("Motif du refus (facultatif) :") ?? "") : "";
    await fetch(`/api/rh/leaves/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    await load();
  }
  async function decideHours(h: Hours, action: "validate" | "reject") {
    const note = action === "reject" ? (prompt("Motif du refus (facultatif) :") ?? "") : "";
    await fetch(`/api/rh/hours/${h.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    await load();
  }

  if (loading) return <Empty t="Chargement…" />;
  return (
    <div style={{ maxWidth: 860 }}>
      <Section title={`Demandes de congés en attente (${leaves.length})`}>
        {leaves.length === 0 ? <div style={muted}>Aucune demande en attente.</div> : leaves.map(l => (
          <div key={l.id} style={rowCard}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: DARK }}>{l.who} — {typeLabel(l.type)} · {l.days} j</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{fmtRange(l)}{l.reason ? ` — ${l.reason}` : ""}</div>
            </div>
            <button onClick={() => decideLeave(l, "approve")} style={btnGreen}>✓ Approuver</button>
            <button onClick={() => decideLeave(l, "reject")} style={btnRed}>✕ Refuser</button>
          </div>
        ))}
      </Section>

      <Section title={`Relevés d'heures signés à valider (${hours.length})`}>
        {hours.length === 0 ? <div style={muted}>Aucun relevé en attente de validation.</div> : hours.map(h => (
          <div key={h.id} style={rowCard}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: DARK }}>{h.who} — {fmtMonth(h.month)} · {h.totalHours ?? "—"} h</div>
              <div style={{ fontSize: 11.5, color: "#9ca3af" }}>Signé par {h.agentSignatureName || h.who}{h.agentSignedAt ? ` le ${new Date(h.agentSignedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : ""}{h.note ? ` · ${h.note}` : ""}</div>
            </div>
            <button onClick={() => decideHours(h, "validate")} style={btnGreen}>✓ Valider</button>
            <button onClick={() => decideHours(h, "reject")} style={btnRed}>✕ Refuser</button>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ── UI helpers ─────────────────────────────────────────────────────
function fmtRange(l: Leave) {
  const s = new Date(l.startDate).toLocaleDateString("fr-FR"), e = new Date(l.endDate).toLocaleDateString("fr-FR");
  return s === e ? s : `${s} → ${e}`;
}
function fmtMonth(m: string) { const [y, mo] = m.split("-"); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); }
function Empty({ t }: { t: string }) { return <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>{t}</div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 22 }}><div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{title}</div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div></div>;
}
function Drawer({ title, onClose, onSubmit, saving, disabled, children }: { title: string; onClose: () => void; onSubmit: () => void; saving: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, maxWidth: "100vw", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>{title}</span><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button></div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnLight}>Annuler</button>
          <button onClick={onSubmit} disabled={saving || disabled} style={{ ...btnGold, opacity: disabled ? 0.5 : 1 }}>{saving ? "Envoi…" : "Envoyer la demande"}</button>
        </div>
      </div>
    </>
  );
}

const btnGold: React.CSSProperties = { background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const btnLight: React.CSSProperties = { background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" };
const btnGreen: React.CSSProperties = { background: "#fff", color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnRed: React.CSSProperties = { background: "#fff", color: RED, border: `1px solid #fecaca`, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const miniBtn: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", color: "#6b7280", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer" };
const rowCard: React.CSSProperties = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" };
const muted: React.CSSProperties = { color: "#9ca3af", fontSize: 13, padding: "8px 0" };
const inp: React.CSSProperties = { width: "100%", minHeight: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const ck: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: DARK, cursor: "pointer" };
function L({ label, children }: { label: string; children: React.ReactNode }) { return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>{label}</div>{children}</div>; }
void GOLD_BG;
