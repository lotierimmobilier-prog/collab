"use client";
import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { DOC_SLOTS, DocSlot, SINISTRE_TYPES, sinistreTypeLabel, VehicleDoc, KmReading, Sinistre, MAX_VEHICLE_DOCS_BYTES } from "@/lib/vehicle";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const MUTED = "#6B7280";

interface Vehicle {
  id: string; label: string; immatriculation: string | null; holdType: string;
  assignedName: string | null; insurer: string | null; currentKm: number | null;
  documents: Partial<Record<DocSlot, VehicleDoc>> | null;
  kmReadings: KmReading[] | null;
  sinistres: Sinistre[] | null;
}

function humanSize(b: number) { return b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(0)} Ko` : `${(b / 1048576).toFixed(1)} Mo`; }
function fmtDate(v?: string) { return v ? new Date(v).toLocaleDateString("fr-FR") : "—"; }
function fmtKm(n?: number | null) { return n != null ? `${n.toLocaleString("fr-FR")} km` : "—"; }

export default function VehiculePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const role = session?.user?.roleId;
  const allowed = role === "admin" || role === "direction" || role === "dirigeant";

  const [v, setV] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/direction/vehicle?id=${id}`);
    if (!r.ok) { setNotFound(true); setLoading(false); return; }
    const d = await r.json(); setV(d.vehicle); setLoading(false);
  }, [id]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  async function patch(payload: Record<string, unknown>) {
    const r = await fetch("/api/direction/vehicle", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) });
    if (r.ok) { const d = await r.json(); setV(d.vehicle); return true; }
    return false;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="direction" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Direction — Fiche véhicule" />
        {!allowed ? (
          <Center>Réservé aux utilisateurs de la direction.</Center>
        ) : loading ? <Center>Chargement…</Center>
        : notFound || !v ? <Center>Véhicule introuvable.</Center>
        : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ maxWidth: 920, margin: "0 auto" }}>
              <Link href="/direction" style={{ fontSize: 12, color: GOLD, textDecoration: "none", fontWeight: 600 }}>‹ Retour à la flotte</Link>

              {/* En-tête */}
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: DARK }}>{v.label}</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    {v.immatriculation || "Immatriculation non renseignée"}
                    {v.assignedName ? <span> · Conducteur : {v.assignedName}</span> : null}
                    {v.insurer ? <span> · Assureur : {v.insurer}</span> : null}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Kilométrage</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>{fmtKm(v.currentKm)}</div>
                </div>
              </div>

              <DocumentsSection vehicle={v} patch={patch} />
              <KmSection vehicle={v} patch={patch} />
              <SinistresSection vehicle={v} patch={patch} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Documents ──────────────────────────────────────────────── */
function DocumentsSection({ vehicle, patch }: { vehicle: Vehicle; patch: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [err, setErr] = useState("");
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const docs = vehicle.documents || {};

  async function upload(slot: DocSlot, file: File) {
    setErr("");
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.readAsDataURL(file); });
    const next = { ...docs, [slot]: { name: file.name, mime: file.type || undefined, size: file.size, data, uploadedAt: new Date().toISOString() } };
    const total = Object.values(next).filter(Boolean).reduce((s, d) => s + ((d as VehicleDoc).size || 0), 0);
    if (total > MAX_VEHICLE_DOCS_BYTES) { setErr("Documents trop volumineux (max 20 Mo au total)."); return; }
    await patch({ documents: next });
  }
  async function remove(slot: DocSlot) {
    const next = { ...docs }; delete next[slot];
    await patch({ documents: next });
  }

  return (
    <Section title="Documents">
      {err && <div style={{ color: "#B91C1C", fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {DOC_SLOTS.map(slot => {
          const doc = docs[slot.id];
          return (
            <div key={slot.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 8 }}>{slot.label}</div>
              {doc ? (
                <div>
                  <div style={{ fontSize: 12, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{humanSize(doc.size)} · ajouté le {fmtDate(doc.uploadedAt)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <a href={`data:${doc.mime || "application/octet-stream"};base64,${doc.data}`} download={doc.name} style={linkBtn}>Télécharger</a>
                    <button onClick={() => refs.current[slot.id]?.click()} style={textBtn}>Remplacer</button>
                    <button onClick={() => remove(slot.id)} style={{ ...textBtn, color: "#B91C1C" }}>Supprimer</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => refs.current[slot.id]?.click()} style={{ width: "100%", border: `1px dashed ${BORDER}`, background: "#FAFAF8", borderRadius: 8, padding: "10px 0", fontSize: 12, color: MUTED, cursor: "pointer" }}>Téléverser</button>
              )}
              <input ref={el => { refs.current[slot.id] = el; }} type="file" accept=".pdf,image/*" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (e.target) e.target.value = ""; if (f) upload(slot.id, f); }} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ── Kilométrage ────────────────────────────────────────────── */
function KmSection({ vehicle, patch }: { vehicle: Vehicle; patch: (p: Record<string, unknown>) => Promise<boolean> }) {
  const readings = [...(vehicle.kmReadings || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState("");
  const [err, setErr] = useState("");

  async function add() {
    setErr("");
    if (!km) { setErr("Indiquez le kilométrage."); return; }
    const next = [...readings, { date: new Date(date).toISOString(), km: Number(km) }];
    if (await patch({ kmReadings: next })) setKm("");
  }
  async function remove(idx: number) {
    const next = readings.filter((_, i) => i !== idx);
    await patch({ kmReadings: next });
  }

  return (
    <Section title="Suivi kilométrique">
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <Field label="Date du relevé"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Field>
        <Field label="Kilométrage"><input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="ex. 84500" style={inp} /></Field>
        <button onClick={add} style={primaryBtn}>Ajouter le relevé</button>
        {err && <span style={{ fontSize: 12, color: "#B91C1C" }}>{err}</span>}
      </div>
      {readings.length === 0 ? <Empty>Aucun relevé enregistré.</Empty> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ color: MUTED, fontSize: 11, textTransform: "uppercase" }}>
            <th style={thL}>Date</th><th style={thL}>Kilométrage</th><th style={thL}>Évolution</th><th style={{ ...thL, textAlign: "right" }}></th>
          </tr></thead>
          <tbody>
            {readings.map((r, i) => {
              const prev = readings[i + 1];
              const delta = prev ? r.km - prev.km : null;
              return (
                <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={td}>{fmtDate(r.date)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{fmtKm(r.km)}</td>
                  <td style={{ ...td, color: MUTED }}>{delta != null ? `+ ${delta.toLocaleString("fr-FR")} km` : "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}><button onClick={() => remove(i)} style={{ ...textBtn, color: "#B91C1C" }}>Supprimer</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/* ── Sinistres ──────────────────────────────────────────────── */
function SinistresSection({ vehicle, patch }: { vehicle: Vehicle; patch: (p: Record<string, unknown>) => Promise<boolean> }) {
  const sinistres = [...(vehicle.sinistres || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: "accident", declared: false, description: "" });

  async function add() {
    const item: Sinistre = { id: `s_${sinistres.length}_${form.date}`, date: new Date(form.date).toISOString(), type: form.type, declared: form.declared, description: form.description.trim() || undefined };
    if (await patch({ sinistres: [...sinistres, item] })) { setOpen(false); setForm({ date: new Date().toISOString().slice(0, 10), type: "accident", declared: false, description: "" }); }
  }
  async function toggleDeclared(id: string) {
    await patch({ sinistres: sinistres.map(s => s.id === id ? { ...s, declared: !s.declared } : s) });
  }
  async function remove(id: string) {
    await patch({ sinistres: sinistres.filter(s => s.id !== id) });
  }

  return (
    <Section title="Sinistres" action={<button onClick={() => setOpen(o => !o)} style={primaryBtn}>{open ? "Annuler" : "Déclarer un sinistre"}</button>}>
      {open && (
        <div style={{ background: "#FAFAF8", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></Field>
          <Field label="Type"><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>{SINISTRE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          <Field label="Description" full><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Circonstances, tiers, dégâts…" style={{ ...inp, minWidth: 280 }} /></Field>
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
              <span style={{ fontSize: 12, fontWeight: 600, color: DARK, width: 110, flexShrink: 0 }}>{sinistreTypeLabel(s.type)}</span>
              <span style={{ flex: 1, fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description || "—"}</span>
              <button onClick={() => toggleDeclared(s.id)} title="Basculer le statut de déclaration"
                style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, cursor: "pointer", border: `1px solid ${s.declared ? GOLD : "#E2C9C9"}`, background: s.declared ? GOLD_BG : "#FCF2F2", color: s.declared ? GOLD : "#B91C1C" }}>
                {s.declared ? "Déclaré" : "Non déclaré"}
              </button>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
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
const thL: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 8px", color: DARK };
