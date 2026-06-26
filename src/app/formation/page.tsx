"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { validationStatus, V_STATUS_LABEL, type ValidationLike } from "@/lib/formation";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";
const GOLD_BG = "#F7F0E6"; const RED = "#9B2C2C"; const GREEN = "#2F855A";

interface Competence { id: string; moduleId: string; title: string; description: string | null; order: number; }
interface Module { id: string; title: string; description: string | null; order: number; active: boolean; competences: Competence[]; }
interface Validation extends ValidationLike {
  id: string; competenceId: string; filleulId: string; dates: string[] | null;
  parrainValidated: boolean; parrainValidatedAt: string | null; parrainComment: string | null;
  filleulValidated: boolean; filleulValidatedAt: string | null; filleulComment: string | null;
}
interface Person { id: string; prenom: string; nom: string; email?: string; active?: boolean; }
interface MeInfo extends Person { roleId: string; parrainId: string | null; parrain: Person | null; }
interface AdminUser extends Person { roleId: string; parrainId: string | null; parrain: Person | null; }

type Tab = "parcours" | "filleuls" | "modules" | "affectation";

export default function FormationPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";

  const [me, setMe] = useState<MeInfo | null>(null);
  const [filleuls, setFilleuls] = useState<Person[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [tab, setTab] = useState<Tab>("parcours");

  const loadPeople = useCallback(async () => {
    try {
      const r = await fetch("/api/formation/people");
      if (!r.ok) return;
      const d = await r.json();
      setMe(d.me); setFilleuls(d.filleuls ?? []); setUsers(d.users ?? []);
    } catch { /* silencieux */ }
  }, []);
  const loadModules = useCallback(async () => {
    try {
      const r = await fetch("/api/formation/modules");
      if (!r.ok) return;
      const d = await r.json();
      setModules(d.modules ?? []);
    } catch { /* silencieux */ }
  }, []);
  useEffect(() => { loadPeople(); loadModules(); }, [loadPeople, loadModules]);

  // Choix d'onglet par défaut selon le rôle / la situation.
  useEffect(() => {
    if (!me) return;
    if (isAdmin) setTab("modules");
    else if (filleuls.length > 0) setTab("filleuls");
    else setTab("parcours");
  }, [me, isAdmin, filleuls.length]);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "parcours", label: "Mon parcours", show: !!me?.parrainId },
    { id: "filleuls", label: `Mes filleuls${filleuls.length ? ` (${filleuls.length})` : ""}`, show: filleuls.length > 0 },
    { id: "modules", label: "Modules & compétences", show: !!isAdmin },
    { id: "affectation", label: "Parrains", show: !!isAdmin },
  ];
  const visibleTabs = tabs.filter(t => t.show);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="formation" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Formation" />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

            <div>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: DARK, margin: 0 }}>Formation par parrainage</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 0", lineHeight: 1.5 }}>
                Suivi des compétences des agents commerciaux en formation. Une compétence est
                <strong> validée</strong> uniquement lorsque le <strong>parrain</strong> et le
                <strong> filleul</strong> l’ont tous deux confirmée.
              </p>
            </div>

            {visibleTabs.length > 1 && (
              <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${BORDER}` }}>
                {visibleTabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    border: "none", background: "none", padding: "8px 14px", cursor: "pointer",
                    fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                    color: tab === t.id ? DARK : "#8a8275",
                    borderBottom: tab === t.id ? `2px solid ${GOLD}` : "2px solid transparent",
                  }}>{t.label}</button>
                ))}
              </div>
            )}

            {!me?.parrainId && filleuls.length === 0 && !isAdmin && (
              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 28, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
                Aucun parrainage ne vous est associé pour le moment.<br />
                Votre administrateur doit vous attribuer un parrain pour débloquer votre espace formation.
              </div>
            )}

            {tab === "parcours" && me?.parrainId && (
              <Parcours
                filleulId={me.id}
                modules={modules}
                side="filleul"
                heading={me.parrain ? `Parrain : ${me.parrain.prenom} ${me.parrain.nom}` : undefined}
              />
            )}

            {tab === "filleuls" && (
              <FilleulsView filleuls={filleuls} modules={modules} isAdmin={!!isAdmin} />
            )}

            {tab === "modules" && isAdmin && (
              <ModulesAdmin modules={modules} reload={loadModules} />
            )}

            {tab === "affectation" && isAdmin && (
              <Affectation users={users} reload={loadPeople} />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vue parrain : choisir un filleul puis voir son parcours ──────────
function FilleulsView({ filleuls, modules, isAdmin }: { filleuls: Person[]; modules: Module[]; isAdmin: boolean }) {
  const [sel, setSel] = useState<string>(filleuls[0]?.id ?? "");
  useEffect(() => { if (!sel && filleuls[0]) setSel(filleuls[0].id); }, [filleuls, sel]);
  if (filleuls.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {filleuls.map(f => (
          <button key={f.id} onClick={() => setSel(f.id)} style={{
            padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13,
            border: `1px solid ${sel === f.id ? GOLD : BORDER}`,
            background: sel === f.id ? GOLD_BG : "#fff",
            fontWeight: sel === f.id ? 700 : 500, color: DARK,
          }}>{f.prenom} {f.nom}</button>
        ))}
      </div>
      {sel && <Parcours filleulId={sel} modules={modules} side="parrain" canParrain={true} canFilleul={isAdmin} />}
    </div>
  );
}

// ─── Parcours d'un filleul (modules → compétences + validations) ──────
function Parcours({ filleulId, modules, side, heading, canParrain, canFilleul }: {
  filleulId: string; modules: Module[]; side: "filleul" | "parrain";
  heading?: string; canParrain?: boolean; canFilleul?: boolean;
}) {
  const [vals, setVals] = useState<Record<string, Validation>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Droits effectifs : si non précisé, on déduit du "côté".
  const allowFilleul = canFilleul ?? (side === "filleul");
  const allowParrain = canParrain ?? (side === "parrain");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/formation/validations?filleulId=${encodeURIComponent(filleulId)}`);
      if (!r.ok) return;
      const d = await r.json();
      const map: Record<string, Validation> = {};
      for (const v of (d.validations ?? []) as Validation[]) map[v.competenceId] = v;
      setVals(map);
    } catch { /* silencieux */ }
  }, [filleulId]);
  useEffect(() => { load(); }, [load]);

  async function act(competenceId: string, body: Record<string, unknown>) {
    setBusy(competenceId);
    try {
      const r = await fetch("/api/formation/validations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competenceId, filleulId, ...body }),
      });
      if (r.ok) { const v = await r.json(); setVals(prev => ({ ...prev, [competenceId]: v })); }
    } catch { /* silencieux */ }
    finally { setBusy(null); }
  }

  // Progression globale.
  const allComps = modules.flatMap(m => m.competences);
  const done = allComps.filter(c => validationStatus(vals[c.id]) === "termine").length;
  const pct = allComps.length ? Math.round((done / allComps.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {heading && <div style={{ fontSize: 13, color: "#6b7280" }}>{heading}</div>}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
          <span>Progression</span><span>{done} / {allComps.length} compétence(s) validée(s)</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "#EEE9E0", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: GOLD, transition: "width .3s" }} />
        </div>
      </div>

      {modules.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: 22, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Aucun module de formation n’a encore été créé.
        </div>
      )}

      {modules.map(m => (
        <div key={m.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: GOLD_BG, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{m.title}</div>
            {m.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.description}</div>}
          </div>
          <div>
            {m.competences.length === 0 && (
              <div style={{ padding: "12px 16px", fontSize: 12, color: "#9ca3af" }}>Aucune compétence.</div>
            )}
            {m.competences.map(c => (
              <CompetenceRow
                key={c.id} comp={c} val={vals[c.id]} busy={busy === c.id}
                allowFilleul={allowFilleul} allowParrain={allowParrain}
                onSetDates={(dates) => act(c.id, { action: "setDates", dates })}
                onValidateFilleul={(value, comment) => act(c.id, { action: "validateFilleul", value, comment })}
                onValidateParrain={(value, comment) => act(c.id, { action: "validateParrain", value, comment })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompetenceRow({ comp, val, busy, allowFilleul, allowParrain, onSetDates, onValidateFilleul, onValidateParrain }: {
  comp: Competence; val?: Validation; busy: boolean;
  allowFilleul: boolean; allowParrain: boolean;
  onSetDates: (dates: string[]) => void;
  onValidateFilleul: (value: boolean, comment?: string) => void;
  onValidateParrain: (value: boolean, comment?: string) => void;
}) {
  const status = validationStatus(val);
  const sl = V_STATUS_LABEL[status];
  const dates: string[] = Array.isArray(val?.dates) ? (val!.dates as string[]) : [];
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState("");

  function addDate() {
    if (!newDate) return;
    if (dates.includes(newDate)) { setNewDate(""); return; }
    onSetDates([...dates, newDate].sort());
    setNewDate("");
  }
  function removeDate(d: string) { onSetDates(dates.filter(x => x !== d)); }

  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{comp.title}</div>
          {comp.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{comp.description}</div>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: sl.color, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{sl.label}</span>
        <button onClick={() => setOpen(o => !o)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 12 }}>{open ? "Fermer" : "Détails"}</button>
      </div>

      {open && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 12, opacity: busy ? 0.6 : 1 }}>
          {/* Validations croisées */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ValidBadge
              label="Filleul" on={!!val?.filleulValidated} at={val?.filleulValidatedAt}
              canToggle={allowFilleul} busy={busy}
              onToggle={() => onValidateFilleul(!val?.filleulValidated)}
            />
            <ValidBadge
              label="Parrain" on={!!val?.parrainValidated} at={val?.parrainValidatedAt}
              canToggle={allowParrain} busy={busy}
              onToggle={() => onValidateParrain(!val?.parrainValidated)}
            />
          </div>

          {/* Jours réalisés */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Jours réalisés</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: (allowFilleul || allowParrain) ? 8 : 0 }}>
              {dates.length === 0 && <span style={{ fontSize: 12, color: "#9ca3af" }}>Aucune date enregistrée.</span>}
              {dates.map(d => (
                <span key={d} style={{ fontSize: 12, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {fmtDate(d)}
                  {(allowFilleul || allowParrain) && (
                    <button onClick={() => removeDate(d)} title="Retirer" style={{ border: "none", background: "none", cursor: "pointer", color: RED, fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                  )}
                </span>
              ))}
            </div>
            {(allowFilleul || allowParrain) && (
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inp, maxWidth: 180 }} />
                <button onClick={addDate} disabled={!newDate || busy} style={{ ...btnGold, opacity: !newDate ? 0.5 : 1 }}>Ajouter</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ValidBadge({ label, on, at, canToggle, busy, onToggle }: {
  label: string; on: boolean; at?: string | null; canToggle: boolean; busy: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={canToggle ? onToggle : undefined} disabled={!canToggle || busy} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10,
      border: `1px solid ${on ? GREEN : BORDER}`, background: on ? "#EAF4EE" : "#fff",
      cursor: canToggle ? "pointer" : "default", textAlign: "left",
    }}>
      <span style={{ fontSize: 16, color: on ? GREEN : "#cbd5e1" }}>{on ? "✓" : "○"}</span>
      <span>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: DARK }}>{label} {on ? "a validé" : "non validé"}</span>
        <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>
          {on && at ? fmtDate(at) : canToggle ? "Cliquer pour valider" : "En attente"}
        </span>
      </span>
    </button>
  );
}

// ─── Admin : gérer modules & compétences ─────────────────────────────
function ModulesAdmin({ modules, reload }: { modules: Module[]; reload: () => void }) {
  const [mTitle, setMTitle] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function addModule() {
    if (!mTitle.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/formation/modules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "module", title: mTitle, description: mDesc, order: modules.length }),
      });
      setMTitle(""); setMDesc(""); reload();
    } finally { setBusy(false); }
  }
  async function delModule(id: string) {
    if (!confirm("Supprimer ce module et toutes ses compétences ?")) return;
    await fetch(`/api/formation/modules/${id}`, { method: "DELETE" }); reload();
  }
  async function addCompetence(moduleId: string, title: string, description: string, order: number) {
    await fetch("/api/formation/modules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "competence", moduleId, title, description, order }),
    });
    reload();
  }
  async function delCompetence(id: string) {
    if (!confirm("Supprimer cette compétence ?")) return;
    await fetch(`/api/formation/competences/${id}`, { method: "DELETE" }); reload();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 12 }}>Nouveau module</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={mTitle} onChange={e => setMTitle(e.target.value)} placeholder="Titre du module (ex. Prospection)" style={inp} />
          <input value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Description (facultatif)" style={inp} />
          <div><button onClick={addModule} disabled={busy || !mTitle.trim()} style={{ ...btnGold, opacity: !mTitle.trim() ? 0.5 : 1 }}>Ajouter le module</button></div>
        </div>
      </div>

      {modules.map(m => (
        <div key={m.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: GOLD_BG, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{m.title}</div>
              {m.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.description}</div>}
            </div>
            <button onClick={() => delModule(m.id)} style={{ ...btnGhost, color: RED, padding: "5px 10px", fontSize: 12 }}>Supprimer</button>
          </div>
          <div>
            {m.competences.map(c => (
              <div key={c.id} style={{ padding: "10px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: DARK }}>{c.title}</div>
                  {c.description && <div style={{ fontSize: 12, color: "#6b7280" }}>{c.description}</div>}
                </div>
                <button onClick={() => delCompetence(c.id)} style={{ ...btnGhost, color: RED, padding: "4px 9px", fontSize: 12 }}>×</button>
              </div>
            ))}
            <AddCompetence onAdd={(t, d) => addCompetence(m.id, t, d, m.competences.length)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AddCompetence({ onAdd }: { onAdd: (title: string, description: string) => void }) {
  const [t, setT] = useState(""); const [d, setD] = useState("");
  return (
    <div style={{ padding: "10px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
      <input value={t} onChange={e => setT(e.target.value)} placeholder="Nouvelle compétence" style={{ ...inp, flex: 1 }} />
      <input value={d} onChange={e => setD(e.target.value)} placeholder="Description" style={{ ...inp, flex: 1 }} />
      <button onClick={() => { if (t.trim()) { onAdd(t, d); setT(""); setD(""); } }} disabled={!t.trim()} style={{ ...btnGhost, opacity: !t.trim() ? 0.5 : 1 }}>Ajouter</button>
    </div>
  );
}

// ─── Admin : affecter les parrains ───────────────────────────────────
function Affectation({ users, reload }: { users: AdminUser[]; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function setParrain(userId: string, parrainId: string) {
    setBusy(userId);
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parrainId: parrainId || null }),
      });
      reload();
    } finally { setBusy(null); }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: GOLD_BG, borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: DARK }}>
        Affectation des parrains
      </div>
      <div style={{ padding: "8px 0" }}>
        {users.map(u => (
          <div key={u.id} style={{ padding: "9px 16px", display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: DARK, fontWeight: 600 }}>{u.prenom} {u.nom}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{u.email} · {u.roleId}</div>
            </div>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Parrain :</span>
            <select
              value={u.parrainId ?? ""} disabled={busy === u.id}
              onChange={e => setParrain(u.id, e.target.value)}
              style={{ ...inp, maxWidth: 220 }}
            >
              <option value="">— Aucun —</option>
              {users.filter(p => p.id !== u.id).map(p => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers d'affichage ─────────────────────────────────────────────
function fmtDate(s: string) {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return s; }
}

const inp: React.CSSProperties = {
  width: "100%", padding: "8px 11px", borderRadius: 9, border: `1px solid ${BORDER}`,
  fontSize: 13, color: DARK, outline: "none", background: "#fff", boxSizing: "border-box",
};
const btnGold: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 9, border: "none", background: GOLD, color: "#fff",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 9, border: `1px solid ${BORDER}`, background: "#fff",
  fontSize: 13, fontWeight: 500, color: DARK, cursor: "pointer",
};
