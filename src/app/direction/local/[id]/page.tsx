"use client";
import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import {
  DOC_CATEGORIES, docCategoryLabel, PREMISE_SINISTRE_TYPES, premiseSinistreLabel,
  CONTROL_TYPES, controlTypeLabel, CONTROL_STATUS, controlStatusMeta,
  PremiseDoc, PremiseSinistre, SecurityControl, MAX_PREMISE_DOCS_BYTES,
} from "@/lib/premise";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const MUTED = "#6B7280";

interface Premise {
  id: string; label: string; address: string | null; bailleur: string | null; insurer: string | null;
  rentMonthly: number | null; charges: number | null; endDate: string | null;
  documents: PremiseDoc[] | null; sinistres: PremiseSinistre[] | null; controls: SecurityControl[] | null;
}

function humanSize(b: number) { return b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(0)} Ko` : `${(b / 1048576).toFixed(1)} Mo`; }
function fmtDate(v?: string | null) { return v ? new Date(v).toLocaleDateString("fr-FR") : "—"; }
function daysUntil(v?: string) { return v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86400_000) : null; }

export default function LocalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const role = session?.user?.roleId;
  const allowed = role === "admin" || role === "direction" || role === "dirigeant";

  const [p, setP] = useState<Premise | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/direction/premise?id=${id}`);
    if (!r.ok) { setNotFound(true); setLoading(false); return; }
    const d = await r.json(); setP(d.premise); setLoading(false);
  }, [id]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  async function patch(payload: Record<string, unknown>) {
    const r = await fetch("/api/direction/premise", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) });
    if (r.ok) { const d = await r.json(); setP(d.premise); return true; }
    return false;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="direction" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Direction — Fiche local" />
        {!allowed ? <Center>Réservé aux utilisateurs de la direction.</Center>
        : loading ? <Center>Chargement…</Center>
        : notFound || !p ? <Center>Local introuvable.</Center>
        : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ maxWidth: 920, margin: "0 auto" }}>
              <Link href="/direction" style={{ fontSize: 12, color: GOLD, textDecoration: "none", fontWeight: 600 }}>‹ Retour aux locaux</Link>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", marginTop: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: DARK }}>{p.label}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                  {p.address || "Adresse non renseignée"}
                  {p.bailleur ? <span> · Bailleur : {p.bailleur}</span> : null}
                </div>
                <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap", fontSize: 13, color: DARK }}>
                  {p.rentMonthly != null && <span><b>Loyer</b> {p.rentMonthly.toLocaleString("fr-FR")} €/mois</span>}
                  {p.charges != null && <span><b>Charges</b> {p.charges.toLocaleString("fr-FR")} €/mois</span>}
                  {p.endDate && <span><b>Fin de bail</b> {fmtDate(p.endDate)}</span>}
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" }}>Assureur</span>
                  <InsurerField value={p.insurer ?? ""} onSave={v => patch({ insurer: v })} />
                </div>
              </div>

              <DocumentsSection premise={p} patch={patch} />
              <ControlsSection premise={p} patch={patch} />
              <SinistresSection premise={p} patch={patch} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InsurerField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <span style={{ display: "flex", gap: 6 }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder="Nom de l'assureur" style={{ ...inp, height: 30, width: 220 }} />
      {v !== value && <button onClick={() => onSave(v)} style={{ ...primaryBtn, padding: "5px 10px" }}>Enregistrer</button>}
    </span>
  );
}

/* ── Documents ──────────────────────────────────────────────── */
function DocumentsSection({ premise, patch }: { premise: Premise; patch: (p: Record<string, unknown>) => Promise<boolean> }) {
  const docs = premise.documents || [];
  const [category, setCategory] = useState(DOC_CATEGORIES[0].id);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setErr("");
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.readAsDataURL(file); });
    const next: PremiseDoc[] = [...docs, { id: `d_${docs.length}_${Date.now() % 100000}`, category, name: file.name, mime: file.type || undefined, size: file.size, data, uploadedAt: new Date().toISOString() }];
    const total = next.reduce((s, d) => s + d.size, 0);
    if (total > MAX_PREMISE_DOCS_BYTES) { setErr("Documents trop volumineux (max 25 Mo au total)."); return; }
    await patch({ documents: next });
  }
  async function remove(docId: string) { await patch({ documents: docs.filter(d => d.id !== docId) }); }

  return (
    <Section title="Documents" action={
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, height: 34, width: "auto" }}>
          {DOC_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (e.target) e.target.value = ""; if (f) upload(f); }} />
        <button onClick={() => fileRef.current?.click()} style={primaryBtn}>Téléverser</button>
      </span>
    }>
      {err && <div style={{ color: "#B91C1C", fontSize: 12, marginBottom: 8 }}>{err}</div>}
      {docs.length === 0 ? <Empty>Aucun document.</Empty> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map(d => (
            <div key={d.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, background: GOLD_BG, borderRadius: 5, padding: "2px 8px", whiteSpace: "nowrap" }}>{docCategoryLabel(d.category)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              <span style={{ fontSize: 11, color: MUTED }}>{humanSize(d.size)}</span>
              <a href={`data:${d.mime || "application/octet-stream"};base64,${d.data}`} download={d.name} style={linkBtn}>Télécharger</a>
              <button onClick={() => remove(d.id)} style={{ ...textBtn, color: "#B91C1C" }}>Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ── Contrôles de sécurité ──────────────────────────────────── */
function ControlsSection({ premise, patch }: { premise: Premise; patch: (p: Record<string, unknown>) => Promise<boolean> }) {
  const controls = [...(premise.controls || [])].sort((a, b) => (a.nextDate || "9999").localeCompare(b.nextDate || "9999"));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: CONTROL_TYPES[0].id, date: "", nextDate: "", status: "conforme", note: "" });

  async function add() {
    const item: SecurityControl = { id: `c_${controls.length}_${Date.now() % 100000}`, type: form.type, date: form.date || undefined, nextDate: form.nextDate || undefined, status: form.status, note: form.note.trim() || undefined };
    if (await patch({ controls: [...controls, item] })) { setOpen(false); setForm({ type: CONTROL_TYPES[0].id, date: "", nextDate: "", status: "conforme", note: "" }); }
  }
  async function remove(cid: string) { await patch({ controls: controls.filter(c => c.id !== cid) }); }

  return (
    <Section title="Contrôles de sécurité" action={<button onClick={() => setOpen(o => !o)} style={primaryBtn}>{open ? "Annuler" : "Ajouter un contrôle"}</button>}>
      {open && (
        <div style={{ background: "#FAFAF8", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Type"><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>{CONTROL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          <Field label="Dernier contrôle"><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></Field>
          <Field label="Prochaine échéance"><input type="date" value={form.nextDate} onChange={e => setForm(f => ({ ...f, nextDate: e.target.value }))} style={inp} /></Field>
          <Field label="Statut"><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>{CONTROL_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="Note" full><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Prestataire, observations…" style={{ ...inp, minWidth: 240 }} /></Field>
          <button onClick={add} style={primaryBtn}>Enregistrer</button>
        </div>
      )}
      {controls.length === 0 ? <Empty>Aucun contrôle enregistré.</Empty> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {controls.map(c => {
            const st = controlStatusMeta(c.status);
            const tone = st?.tone === "ok" ? { bg: "#F2F1EC", color: "#5b6b58" } : st?.tone === "bad" ? { bg: "#F5E9E6", color: "#9B2C2C" } : { bg: GOLD_BG, color: "#8A6D44" };
            const due = daysUntil(c.nextDate);
            return (
              <div key={c.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: DARK, minWidth: 150 }}>{controlTypeLabel(c.type)}</span>
                <span style={{ fontSize: 11, color: MUTED }}>Fait : {fmtDate(c.date)}</span>
                {c.nextDate && <span style={{ fontSize: 11, color: due != null && due < 0 ? "#9B2C2C" : due != null && due <= 30 ? "#8A6D44" : MUTED }}>Prochain : {fmtDate(c.nextDate)}{due != null ? ` (${due < 0 ? "dépassé" : "dans " + due + " j"})` : ""}</span>}
                <span style={{ fontSize: 11, fontWeight: 700, color: tone.color, background: tone.bg, borderRadius: 6, padding: "2px 8px" }}>{st?.label ?? c.status}</span>
                {c.note && <span style={{ flex: 1, fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.note}</span>}
                <button onClick={() => remove(c.id)} style={{ ...textBtn, color: "#B91C1C", marginLeft: "auto" }}>Supprimer</button>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/* ── Sinistres ──────────────────────────────────────────────── */
function SinistresSection({ premise, patch }: { premise: Premise; patch: (p: Record<string, unknown>) => Promise<boolean> }) {
  const sinistres = [...(premise.sinistres || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: PREMISE_SINISTRE_TYPES[0].id, declared: false, description: "" });

  async function add() {
    const item: PremiseSinistre = { id: `s_${sinistres.length}_${Date.now() % 100000}`, date: new Date(form.date).toISOString(), type: form.type, declared: form.declared, description: form.description.trim() || undefined };
    if (await patch({ sinistres: [...sinistres, item] })) { setOpen(false); setForm({ date: new Date().toISOString().slice(0, 10), type: PREMISE_SINISTRE_TYPES[0].id, declared: false, description: "" }); }
  }
  async function toggleDeclared(sid: string) { await patch({ sinistres: sinistres.map(s => s.id === sid ? { ...s, declared: !s.declared } : s) }); }
  async function remove(sid: string) { await patch({ sinistres: sinistres.filter(s => s.id !== sid) }); }

  return (
    <Section title="Sinistres" action={<button onClick={() => setOpen(o => !o)} style={primaryBtn}>{open ? "Annuler" : "Déclarer un sinistre"}</button>}>
      {open && (
        <div style={{ background: "#FAFAF8", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></Field>
          <Field label="Type"><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>{PREMISE_SINISTRE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          <Field label="Description" full><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Circonstances, dégâts…" style={{ ...inp, minWidth: 280 }} /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: DARK }}>
            <input type="checkbox" checked={form.declared} onChange={e => setForm(f => ({ ...f, declared: e.target.checked }))} style={{ accentColor: GOLD }} /> Déclaré à l&apos;assurance
          </label>
          <button onClick={add} style={primaryBtn}>Enregistrer</button>
        </div>
      )}
      {sinistres.length === 0 ? <Empty>Aucun sinistre enregistré.</Empty> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sinistres.map(s => (
            <div key={s.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: MUTED, width: 78, flexShrink: 0 }}>{fmtDate(s.date)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: DARK, width: 130, flexShrink: 0 }}>{premiseSinistreLabel(s.type)}</span>
              <span style={{ flex: 1, fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description || "—"}</span>
              <button onClick={() => toggleDeclared(s.id)} style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, cursor: "pointer", border: `1px solid ${s.declared ? GOLD : "#E2C9C9"}`, background: s.declared ? GOLD_BG : "#FCF2F2", color: s.declared ? GOLD : "#B91C1C" }}>{s.declared ? "Déclaré" : "Non déclaré"}</button>
              <button onClick={() => remove(s.id)} style={{ ...textBtn, color: "#B91C1C", flexShrink: 0 }}>Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ── UI ─────────────────────────────────────────────────────── */
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px", marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{title}</span>{action}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: full ? 1 : undefined }}><span style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>{children}</div>;
}
function Center({ children }: { children: React.ReactNode }) { return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 14 }}>{children}</div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>{children}</div>; }

const inp: React.CSSProperties = { height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const textBtn: React.CSSProperties = { background: "none", border: "none", color: GOLD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 };
const linkBtn: React.CSSProperties = { ...textBtn, textDecoration: "none" };
