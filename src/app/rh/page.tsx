"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import { monthDays, dayHours, totals, round2, OBS_OPTIONS, PRIME_MOTIFS, ACOMPTE_MODES, type DayEntry } from "@/lib/decompte";

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
  const role = session?.user?.roleId ?? "";
  const isValidator = ["admin", "dirigeant", "direction"].includes(role);
  const isAgent = role === "agent";
  const [tab, setTab] = useState<"conges" | "heures" | "validation">("conges");

  if (isAgent) return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="rh" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>Module réservé aux collaborateurs</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, maxWidth: 360 }}>Les congés et relevés d'heures concernent les collaborateurs salariés, pas les agents commerciaux.</div>
        </div>
      </div>
    </div>
  );

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

// ── Mes heures — décompte au format légal ──────────────────────────
function HeuresTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<Record<number, DayEntry>>({});
  const [hebdo, setHebdo] = useState(""); const [note, setNote] = useState("");
  const [avNat, setAvNat] = useState(""); const [acompte, setAcompte] = useState(""); const [acMode, setAcMode] = useState("");
  const [primeMotif, setPrimeMotif] = useState(""); const [primeMontant, setPrimeMontant] = useState("");
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState("");

  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/rh/hours?scope=mine"); if (r.ok) setList(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const current = list.find(h => h.month === month);
  const locked = current?.status === "valide";

  // Pré-remplit depuis l'enregistrement du mois sélectionné.
  useEffect(() => {
    const c = list.find(h => h.month === month);
    const map: Record<number, DayEntry> = {};
    if (Array.isArray(c?.entries)) for (const e of c.entries) if (e?.d) map[e.d] = e;
    setEntries(map);
    setHebdo(c?.heureHebdo != null ? String(c.heureHebdo) : "");
    setNote(c?.note ?? ""); setAvNat(c?.avantageNature ?? ""); setAcompte(c?.acompte != null ? String(c.acompte) : "");
    setAcMode(c?.acompteMode ?? ""); setPrimeMotif(c?.primeMotif ?? ""); setPrimeMontant(c?.primeMontant != null ? String(c.primeMontant) : "");
  }, [month, list]);

  const days = monthDays(month);
  const entriesArr = days.map(({ d }) => ({ ...(entries[d] || {}), d }));
  const t = totals(month, entriesArr);

  function setDay(d: number, k: keyof DayEntry, v: string | boolean | number) {
    setEntries(p => ({ ...p, [d]: { ...(p[d] || { d }), d, [k]: v } }));
  }

  async function save(sign: boolean) {
    if (sign && !confirm(`Vous signez votre décompte d'heures de ${fmtMonth(month)} (${t.monthTotal} h). Cette signature électronique fait foi. Continuer ?`)) return;
    setSaving(true); setMsg("");
    const payload = {
      month, entries: entriesArr.filter(e => e.m1 || e.a1 || e.s1 || e.nuit || e.panier || e.obs),
      heureHebdo: hebdo, note, avantageNature: avNat, acompte, acompteMode: acMode, primeMotif, primeMontant, sign,
    };
    const r = await fetch("/api/rh/hours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok) { setMsg(sign ? "✓ Décompte signé et transmis à la direction." : "✓ Enregistré (brouillon)."); await load(); }
    else setMsg(d.error || "Échec.");
  }

  const tin: React.CSSProperties = { width: 52, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 4px", fontSize: 11, outline: "none", background: locked ? "#f3f4f6" : "#fff" };

  return (
    <div>
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
          <L label="Mois"><input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: 160 }} /></L>
          <L label="Heure hebdo. (contrat)"><input type="number" step="0.5" value={hebdo} onChange={e => setHebdo(e.target.value)} style={{ ...inp, width: 130 }} placeholder="ex. 35" disabled={locked} /></L>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Total du mois</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{t.monthTotal} h</div>
          </div>
        </div>
        {current && <div style={{ fontSize: 12 }}>Statut : <b style={{ color: (HOURS_ST[current.status] ?? HOURS_ST.brouillon).color }}>{(HOURS_ST[current.status] ?? HOURS_ST.brouillon).label}</b>
          {current.agentSignedAt ? ` · vous : ${new Date(current.agentSignedAt).toLocaleDateString("fr-FR")}` : ""}
          {current.directionSignedAt ? ` · employeur : ${new Date(current.directionSignedAt).toLocaleDateString("fr-FR")}` : ""}
          {current.id && <a href={`/api/rh/hours/${current.id}/pdf`} target="_blank" rel="noreferrer" style={{ marginLeft: 10, color: GOLD }}>📄 PDF</a>}</div>}
      </div>

      {/* Grille quotidienne */}
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 16, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 720 }}>
          <thead>
            <tr style={{ background: GOLD_BG, color: DARK }}>
              <th style={th}>Jour</th><th style={th} colSpan={2}>Matin</th><th style={th} colSpan={2}>Après-midi</th><th style={th} colSpan={2}>Soir</th>
              <th style={th}>Nuit</th><th style={th}>Pan.</th><th style={th}>Observation</th><th style={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ d, weekday, dow }, i) => {
              const e = entries[d] || { d };
              const wk = dow === 0 || dow === 6;
              const dh = dayHours({ ...e, d });
              const weekEnd = (i + 1) % 7 === 0;
              return (
                <tr key={d} style={{ background: wk ? "#fafafa" : "#fff", borderBottom: weekEnd ? `2px solid ${GOLD}` : `1px solid #f1f1f1` }}>
                  <td style={{ ...td, whiteSpace: "nowrap", color: wk ? "#9ca3af" : DARK }}>{String(d).padStart(2, "0")} {weekday.slice(0, 3)}</td>
                  <td style={td}><input type="time" value={e.m1 ?? ""} onChange={ev => setDay(d, "m1", ev.target.value)} style={tin} disabled={locked} /></td>
                  <td style={td}><input type="time" value={e.m2 ?? ""} onChange={ev => setDay(d, "m2", ev.target.value)} style={tin} disabled={locked} /></td>
                  <td style={td}><input type="time" value={e.a1 ?? ""} onChange={ev => setDay(d, "a1", ev.target.value)} style={tin} disabled={locked} /></td>
                  <td style={td}><input type="time" value={e.a2 ?? ""} onChange={ev => setDay(d, "a2", ev.target.value)} style={tin} disabled={locked} /></td>
                  <td style={td}><input type="time" value={e.s1 ?? ""} onChange={ev => setDay(d, "s1", ev.target.value)} style={tin} disabled={locked} /></td>
                  <td style={td}><input type="time" value={e.s2 ?? ""} onChange={ev => setDay(d, "s2", ev.target.value)} style={tin} disabled={locked} /></td>
                  <td style={td}><input type="number" step="0.5" value={e.nuit ?? ""} onChange={ev => setDay(d, "nuit", ev.target.value ? Number(ev.target.value) : 0)} style={{ ...tin, width: 38 }} disabled={locked} /></td>
                  <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={!!e.panier} onChange={ev => setDay(d, "panier", ev.target.checked)} disabled={locked} /></td>
                  <td style={td}>
                    <select value={e.obs ?? ""} onChange={ev => setDay(d, "obs", ev.target.value)} style={{ ...tin, width: 150 }} disabled={locked}>
                      {OBS_OPTIONS.map(o => <option key={o} value={o}>{o || "—"}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: dh ? GREEN : "#d1d5db", textAlign: "right" }}>{dh ? round2(dh).toFixed(2) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>Totaux hebdo. : {t.weeks.map((w, i) => `S${i + 1} ${w.hours}h`).join("  ·  ")} — Nuit {t.nuitTotal}h · Paniers {t.paniers}</div>
      </div>

      {/* Avantages / prime / acompte */}
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <L label="Avantage en nature"><input value={avNat} onChange={e => setAvNat(e.target.value)} style={inp} disabled={locked} placeholder="nature…" /></L>
        <L label="Prime — motif"><select value={primeMotif} onChange={e => setPrimeMotif(e.target.value)} style={inp} disabled={locked}>{PRIME_MOTIFS.map(p => <option key={p} value={p}>{p || "—"}</option>)}</select></L>
        <L label="Prime — montant (€)"><input type="number" value={primeMontant} onChange={e => setPrimeMontant(e.target.value)} style={inp} disabled={locked} /></L>
        <L label="Acompte (€)"><input type="number" value={acompte} onChange={e => setAcompte(e.target.value)} style={inp} disabled={locked} /></L>
        <L label="Acompte — mode"><select value={acMode} onChange={e => setAcMode(e.target.value)} style={inp} disabled={locked}>{ACOMPTE_MODES.map(m => <option key={m} value={m}>{m || "—"}</option>)}</select></L>
        <L label="Remarque"><input value={note} onChange={e => setNote(e.target.value)} style={inp} disabled={locked} /></L>
      </div>

      {!locked ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => save(false)} disabled={saving} style={btnLight}>Enregistrer (brouillon)</button>
          <button onClick={() => save(true)} disabled={saving || t.monthTotal === 0} style={btnGold}>✍ Signer et transmettre</button>
          {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✓") ? GREEN : RED }}>{msg}</span>}
          <span style={{ fontSize: 11, color: "#9ca3af" }}>La signature enregistre nom, date/heure et IP comme preuve.</span>
        </div>
      ) : <div style={{ fontSize: 12.5, color: GREEN }}>✓ Décompte validé et signé par l'employeur — verrouillé. <a href={`/api/rh/hours/${current.id}/pdf`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Télécharger le PDF</a></div>}
    </div>
  );
}
const th: React.CSSProperties = { padding: "5px 4px", fontSize: 10, fontWeight: 700, textAlign: "center", borderBottom: "1px solid #e5e7eb" };
const td: React.CSSProperties = { padding: "2px 4px", textAlign: "center" };

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
            <a href={`/api/rh/hours/${h.id}/pdf`} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: "none", color: GOLD }}>📄 PDF</a>
            <button onClick={() => decideHours(h, "validate")} style={btnGreen}>✓ Valider (signer)</button>
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
