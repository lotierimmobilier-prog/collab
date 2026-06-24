"use client";
import { useState, useEffect } from "react";
import { Task, COLUMNS, PRIORITY_STYLES, Status } from "@/lib/tasks";

const GOLD = "#B8966A";

interface Supplier { id: string; name: string; type: string; phone?: string; email?: string; }
interface ODS {
  id: string; ref: string; supplierId: string; title: string; description?: string;
  address?: string; deadline?: string; amount?: number; status: string; notes?: string;
  supplier?: { name: string; type: string; phone?: string; email?: string };
}

const ODS_STATUS: Record<string, { label: string; color: string }> = {
  brouillon:  { label: "Brouillon",  color: "#6b7280" },
  "envoyé":   { label: "Envoyé",     color: "#2563EB" },
  "accepté":  { label: "Accepté",    color: "#059669" },
  en_cours:   { label: "En cours",   color: "#d97706" },
  "terminé":  { label: "Terminé",    color: "#10b981" },
  "annulé":   { label: "Annulé",     color: "#dc2626" },
};

export default function TaskDetail({ task, onClose, onStatusChange }: {
  task: Task;
  onClose: () => void;
  onStatusChange: (s: Status) => void;
}) {
  const [comment, setComment] = useState("");
  const [showODS, setShowODS] = useState(false);
  const [odsList, setOdsList] = useState<ODS[]>([]);
  const p = PRIORITY_STYLES[task.priority];

  useEffect(() => {
    fetch(`/api/ods?taskId=${task.id}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setOdsList(d); }).catch(() => {});
  }, [task.id]);

  async function updateOdsStatus(odsId: string, status: string) {
    const r = await fetch(`/api/ods/${odsId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) {
      const updated = await r.json();
      setOdsList(p => p.map(o => o.id === odsId ? { ...o, status: updated.status } : o));
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 500, background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: p.bg, color: p.text, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{p.label}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowODS(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F7F0E6", color: GOLD, border: `1px solid ${GOLD}40`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            📋 Émettre un ODS
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", padding: 4 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 16, lineHeight: 1.4 }}>{task.title}</h1>

          {task.description && (
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 16, background: "#f9fafb", borderRadius: 8, padding: "10px 12px" }}>
              {task.description}
            </div>
          )}

          {/* Meta */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <MetaField label="Statut">
              <select value={task.status} onChange={e => onStatusChange(e.target.value as Status)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 12, background: "#f9fafb", outline: "none" }}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </MetaField>
            <MetaField label="Priorité">
              <span style={{ background: p.bg, color: p.text, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 500 }}>{p.label}</span>
            </MetaField>
            <MetaField label="Assigné à">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {task.assignee ? (
                  <>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: task.assigneeColor || GOLD + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: task.assigneeColor || GOLD }}>
                      {task.assigneeInitials || "?"}
                    </div>
                    <span style={{ fontSize: 12, color: "#374151" }}>{task.assignee}</span>
                  </>
                ) : <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>}
              </div>
            </MetaField>
            <MetaField label="Échéance">
              <span style={{ fontSize: 12, color: task.dueDate ? "#374151" : "#9ca3af" }}>
                {task.dueDate ? `📅 ${task.dueDate}` : "—"}
              </span>
            </MetaField>
            {task.family && (
              <MetaField label="Famille">
                <span style={{ background: task.family.color + "20", color: task.family.color, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}>{task.family.name}</span>
              </MetaField>
            )}
            {task.project && (
              <MetaField label="Projet">
                <span style={{ fontSize: 12, color: "#374151" }}>📁 {task.project}</span>
              </MetaField>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Label>Étiquettes</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {task.tags.map(tag => <span key={tag} style={{ background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "3px 10px", fontSize: 12 }}>{tag}</span>)}
              </div>
            </div>
          )}

          {/* ODS liés */}
          {odsList.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Label>Ordres de service ({odsList.length})</Label>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {odsList.map(o => {
                  const st = ODS_STATUS[o.status] ?? { label: o.status, color: "#6b7280" };
                  return (
                    <div key={o.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "monospace" }}>{o.ref}</span>
                        <span style={{ background: st.color + "20", color: st.color, borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>{st.label}</span>
                        <span style={{ flex: 1 }} />
                        <select value={o.status} onChange={e => updateOdsStatus(o.id, e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "2px 6px", fontSize: 11, background: "#f9fafb", outline: "none", cursor: "pointer" }}>
                          {Object.entries(ODS_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                        </select>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{o.title}</div>
                      {o.supplier && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>🔧 {o.supplier.name}{o.supplier.phone && ` · ${o.supplier.phone}`}</div>}
                      {o.deadline && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>📅 {new Date(o.deadline).toLocaleDateString("fr-FR")}</div>}
                      {o.amount && <div style={{ fontSize: 11, color: "#059669", marginTop: 2 }}>💶 {o.amount.toLocaleString("fr-FR")} €</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Commentaire */}
          <div>
            <Label>Commentaires</Label>
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F7F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: GOLD, flexShrink: 0 }}>JL</div>
              <div style={{ flex: 1 }}>
                <textarea placeholder="Ajouter un commentaire…" value={comment} onChange={e => setComment(e.target.value)} rows={3}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                {comment && (
                  <button onClick={() => setComment("")} style={{ marginTop: 6, background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>Envoyer</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showODS && (
        <ODSModal
          task={task}
          onClose={() => setShowODS(false)}
          onSave={(ods) => { setOdsList(p => [ods, ...p]); setShowODS(false); }}
        />
      )}
    </>
  );
}

function ODSModal({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (o: ODS) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [f, setF] = useState({
    supplierId:  "",
    title:       task.title,
    description: task.description ?? "",
    address:     "",
    deadline:    task.dueDate ?? "",
    amount:      "",
    notes:       "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/fournisseurs").then(r => r.json()).then(d => { if (Array.isArray(d)) setSuppliers(d.filter((s: Supplier & { active: boolean }) => s.active)); }).catch(() => {});
  }, []);

  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  async function submit() {
    if (!f.supplierId || !f.title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/ods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, taskId: task.id }),
      });
      if (r.ok) onSave(await r.json());
    } finally { setSaving(false); }
  }

  const selectedSupplier = suppliers.find(s => s.id === f.supplierId);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 540, background: "#fff", borderRadius: 16, zIndex: 70, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>📋 Émettre un Ordre de Service</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Tâche : {task.title}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Fournisseur */}
          <FLabel label="Fournisseur *">
            {suppliers.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb" }}>
                Aucun fournisseur enregistré —{" "}
                <a href="/fournisseurs" target="_blank" style={{ color: GOLD }}>ajouter des fournisseurs</a>
              </div>
            ) : (
              <select value={f.supplierId} onChange={e => set("supplierId", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="">— Sélectionner un fournisseur —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
              </select>
            )}
          </FLabel>

          {selectedSupplier && (
            <div style={{ background: "#F7F0E6", border: "1px solid #E6E1D9", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>
              {selectedSupplier.phone && <span>📞 {selectedSupplier.phone}</span>}
              {selectedSupplier.phone && selectedSupplier.email && <span style={{ margin: "0 6px" }}>·</span>}
              {selectedSupplier.email && <span>✉️ {selectedSupplier.email}</span>}
            </div>
          )}

          <FLabel label="Objet des travaux *">
            <input value={f.title} onChange={e => set("title", e.target.value)} style={inp} placeholder="Description courte de l'intervention" />
          </FLabel>

          <FLabel label="Détail / instructions">
            <textarea value={f.description} onChange={e => set("description", e.target.value)} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none" }} placeholder="Description détaillée, contraintes d'accès, matériaux…" />
          </FLabel>

          <FLabel label="Adresse d'intervention">
            <input value={f.address} onChange={e => set("address", e.target.value)} style={inp} placeholder="Adresse du bien" />
          </FLabel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FLabel label="Délai souhaité">
              <input type="date" value={f.deadline} onChange={e => set("deadline", e.target.value)} style={inp} />
            </FLabel>
            <FLabel label="Montant estimé (€)">
              <input type="number" value={f.amount} onChange={e => set("amount", e.target.value)} style={inp} placeholder="0.00" min="0" step="0.01" />
            </FLabel>
          </div>

          <FLabel label="Notes internes">
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={2} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none" }} placeholder="Remarques, conditions particulières…" />
          </FLabel>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.supplierId || !f.title.trim() || saving}
            style={{ background: !f.supplierId || !f.title.trim() ? "#e5e7eb" : GOLD, color: !f.supplierId || !f.title.trim() ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {saving ? "Création…" : "Émettre l'ODS"}
          </button>
        </div>
      </div>
    </>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label><div style={{ marginTop: 4 }}>{children}</div></div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</div>;
}

function FLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>{label}</div>{children}</div>;
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
