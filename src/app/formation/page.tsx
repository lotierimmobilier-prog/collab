"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { validationStatus, V_STATUS_LABEL, type ValidationLike } from "@/lib/formation";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";
const GOLD_BG = "#F7F0E6"; const RED = "#9B2C2C"; const GREEN = "#2F855A";

interface Question { id: string; competenceId: string; prompt: string; choices: string[]; correctIndex: number; explanation: string | null; order: number; }
interface Competence { id: string; moduleId: string; title: string; description: string | null; order: number; questions: Question[]; }
interface Module { id: string; title: string; description: string | null; order: number; active: boolean; competences: Competence[]; }
interface Validation extends ValidationLike {
  id: string; competenceId: string; filleulId: string; dates: string[] | null;
  parrainValidated: boolean; parrainValidatedAt: string | null; parrainComment: string | null;
  filleulValidated: boolean; filleulValidatedAt: string | null; filleulComment: string | null;
  quiz: Record<string, number> | null;
}
interface Person { id: string; prenom: string; nom: string; email?: string; active?: boolean; }
interface MeInfo extends Person { roleId: string; parrainId: string | null; parrain: Person | null; }
interface AdminUser extends Person { roleId: string; parrainId: string | null; parrain: Person | null; }

type Tab = "parcours" | "filleuls" | "suivi" | "modules" | "affectation";

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

  // Tous les filleuls de l'agence (admin) = utilisateurs ayant un parrain.
  const allFilleuls: Person[] = users
    .filter(u => u.parrainId)
    .map(u => ({ id: u.id, prenom: u.prenom, nom: u.nom, email: u.email }));

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "parcours", label: "Mon parcours", show: !!me?.parrainId },
    { id: "filleuls", label: `Mes filleuls${filleuls.length ? ` (${filleuls.length})` : ""}`, show: filleuls.length > 0 },
    { id: "suivi", label: `Suivi des filleuls${allFilleuls.length ? ` (${allFilleuls.length})` : ""}`, show: !!isAdmin },
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
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

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

            {tab === "suivi" && isAdmin && (
              allFilleuls.length === 0
                ? <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 26, textAlign: "center", color: "#6b7280", fontSize: 13.5 }}>
                    Aucun filleul pour le moment. Attribuez un parrain à un utilisateur dans l’onglet <strong>Parrains</strong>.
                  </div>
                : <FilleulsView filleuls={allFilleuls} modules={modules} isAdmin={true} />
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
                onSetQuiz={(quiz) => act(c.id, { action: "setQuiz", quiz })}
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

function CompetenceRow({ comp, val, busy, allowFilleul, allowParrain, onSetDates, onSetQuiz, onValidateFilleul, onValidateParrain }: {
  comp: Competence; val?: Validation; busy: boolean;
  allowFilleul: boolean; allowParrain: boolean;
  onSetDates: (dates: string[]) => void;
  onSetQuiz: (quiz: Record<string, number>) => void;
  onValidateFilleul: (value: boolean, comment?: string) => void;
  onValidateParrain: (value: boolean, comment?: string) => void;
}) {
  const status = validationStatus(val);
  const sl = V_STATUS_LABEL[status];
  const dates: string[] = Array.isArray(val?.dates) ? (val!.dates as string[]) : [];
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const quiz: Record<string, number> = (val?.quiz as Record<string, number>) || {};
  const nQ = comp.questions?.length ?? 0;
  const answered = comp.questions?.filter(q => quiz[q.id] !== undefined).length ?? 0;
  const correct = comp.questions?.filter(q => quiz[q.id] === q.correctIndex).length ?? 0;

  function addDate() {
    if (!newDate) return;
    if (dates.includes(newDate)) { setNewDate(""); return; }
    onSetDates([...dates, newDate].sort());
    setNewDate("");
  }
  function removeDate(d: string) { onSetDates(dates.filter(x => x !== d)); }
  function answerQuestion(qId: string, idx: number) {
    onSetQuiz({ ...quiz, [qId]: idx });
  }

  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{comp.title}</div>
          {comp.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{comp.description}</div>}
        </div>
        {nQ > 0 && (
          <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
            QCM {correct}/{nQ}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: sl.color, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{sl.label}</span>
        <button onClick={() => setOpen(o => !o)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 12 }}>{open ? "Fermer" : "Détails"}</button>
      </div>

      {open && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 14, opacity: busy ? 0.6 : 1 }}>
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

          {/* Questions de contrôle (QCM) */}
          {nQ > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 8 }}>
                Questions de contrôle {answered > 0 && <span style={{ color: "#6b7280", fontWeight: 400 }}>— {correct}/{nQ} bonne(s) réponse(s)</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {comp.questions.map((q, qi) => (
                  <QuizQuestion
                    key={q.id} q={q} index={qi} chosen={quiz[q.id]}
                    canAnswer={allowFilleul} busy={busy}
                    onAnswer={(idx) => answerQuestion(q.id, idx)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizQuestion({ q, index, chosen, canAnswer, busy, onAnswer }: {
  q: Question; index: number; chosen: number | undefined; canAnswer: boolean; busy: boolean; onAnswer: (idx: number) => void;
}) {
  const answered = chosen !== undefined;
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", background: "#FAF8F4" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 8 }}>{index + 1}. {q.prompt}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {q.choices.map((ch, i) => {
          const isChosen = chosen === i;
          const isCorrect = i === q.correctIndex;
          let bg = "#fff", bd = BORDER, col = DARK;
          if (answered) {
            if (isCorrect) { bg = "#EAF4EE"; bd = GREEN; col = DARK; }
            else if (isChosen) { bg = "#FBEAEA"; bd = RED; col = DARK; }
          } else if (isChosen) { bg = GOLD_BG; bd = GOLD; }
          return (
            <button key={i} disabled={!canAnswer || busy}
              onClick={() => onAnswer(i)}
              style={{
                textAlign: "left", padding: "7px 10px", borderRadius: 8, border: `1px solid ${bd}`,
                background: bg, color: col, fontSize: 12.5, cursor: canAnswer ? "pointer" : "default",
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <span style={{ width: 16, color: answered && isCorrect ? GREEN : answered && isChosen ? RED : "#9ca3af" }}>
                {answered && isCorrect ? "✓" : answered && isChosen ? "✗" : "○"}
              </span>
              {ch}
            </button>
          );
        })}
      </div>
      {answered && q.explanation && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, fontStyle: "italic" }}>{q.explanation}</div>
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

// ─── Admin : gérer modules, compétences & questions ──────────────────
function ModulesAdmin({ modules, reload }: { modules: Module[]; reload: () => void }) {
  const [mTitle, setMTitle] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

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
  async function loadSeed() {
    setBusy(true); setSeedMsg("");
    try {
      const r = await fetch("/api/formation/seed", { method: "POST" });
      const d = await r.json();
      setSeedMsg(r.ok ? (d.message || "Programme chargé.") : (d.error || "Échec du chargement."));
      reload();
    } catch { setSeedMsg("Erreur réseau."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {modules.length === 0 && (
        <div style={{ background: GOLD_BG, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>Démarrer rapidement</div>
          <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
            Chargez le <strong>programme type</strong> de formation des agents commerciaux (cadre juridique,
            prospection, estimation, transaction, gestion locative, logiciels, posture, marketing).
            Vous pourrez ensuite tout modifier, compléter ou supprimer.
          </div>
          <button onClick={loadSeed} disabled={busy} style={btnGold}>Charger le programme type</button>
          {seedMsg && <div style={{ fontSize: 12, color: GREEN, marginTop: 8 }}>{seedMsg}</div>}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 12 }}>Nouveau module</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={mTitle} onChange={e => setMTitle(e.target.value)} placeholder="Titre du module (ex. Prospection & développement commercial)" style={inp} />
          <input value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Description (facultatif)" style={inp} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={addModule} disabled={busy || !mTitle.trim()} style={{ ...btnGold, opacity: !mTitle.trim() ? 0.5 : 1 }}>Ajouter le module</button>
            {modules.length > 0 && (
              <button onClick={loadSeed} disabled={busy} style={btnGhost} title="Ajoute les modules du programme type qui ne sont pas déjà présents">
                Compléter avec le programme type
              </button>
            )}
            {seedMsg && modules.length > 0 && <span style={{ fontSize: 12, color: GREEN }}>{seedMsg}</span>}
          </div>
        </div>
      </div>

      {modules.map(m => (
        <ModuleEditor key={m.id} module={m} reload={reload} />
      ))}
    </div>
  );
}

function ModuleEditor({ module: m, reload }: { module: Module; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [desc, setDesc] = useState(m.description ?? "");

  async function saveModule() {
    await fetch(`/api/formation/modules/${m.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: desc }),
    });
    setEditing(false); reload();
  }
  async function delModule() {
    if (!confirm("Supprimer ce module et toutes ses compétences ?")) return;
    await fetch(`/api/formation/modules/${m.id}`, { method: "DELETE" }); reload();
  }
  async function addCompetence(t: string, d: string) {
    await fetch("/api/formation/modules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "competence", moduleId: m.id, title: t, description: d, order: m.competences.length }),
    });
    reload();
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: GOLD_BG, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
        {editing ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inp} />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" style={inp} />
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{m.title}</div>
            {m.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.description}</div>}
          </div>
        )}
        {editing ? (
          <>
            <button onClick={saveModule} style={{ ...btnGold, padding: "6px 12px", fontSize: 12 }}>Enregistrer</button>
            <button onClick={() => { setEditing(false); setTitle(m.title); setDesc(m.description ?? ""); }} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }}>Annuler</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 12 }}>Modifier</button>
            <button onClick={delModule} style={{ ...btnGhost, color: RED, padding: "5px 10px", fontSize: 12 }}>Supprimer</button>
          </>
        )}
      </div>
      <div>
        {m.competences.map(c => (
          <CompetenceEditor key={c.id} comp={c} reload={reload} />
        ))}
        <AddRow placeholder1="Nouvelle compétence" placeholder2="Description" onAdd={addCompetence} />
      </div>
    </div>
  );
}

function CompetenceEditor({ comp: c, reload }: { comp: Competence; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(c.title);
  const [desc, setDesc] = useState(c.description ?? "");
  const [showQ, setShowQ] = useState(false);

  async function save() {
    await fetch(`/api/formation/competences/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: desc }),
    });
    setEditing(false); reload();
  }
  async function del() {
    if (!confirm("Supprimer cette compétence ?")) return;
    await fetch(`/api/formation/competences/${c.id}`, { method: "DELETE" }); reload();
  }

  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        {editing ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inp} />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" style={inp} />
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: DARK, fontWeight: 600 }}>{c.title}</div>
            {c.description && <div style={{ fontSize: 12, color: "#6b7280" }}>{c.description}</div>}
          </div>
        )}
        {editing ? (
          <>
            <button onClick={save} style={{ ...btnGold, padding: "5px 11px", fontSize: 12 }}>OK</button>
            <button onClick={() => { setEditing(false); setTitle(c.title); setDesc(c.description ?? ""); }} style={{ ...btnGhost, padding: "5px 9px", fontSize: 12 }}>Annuler</button>
          </>
        ) : (
          <>
            <button onClick={() => setShowQ(s => !s)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 12 }}>
              Questions ({c.questions?.length ?? 0})
            </button>
            <button onClick={() => setEditing(true)} style={{ ...btnGhost, padding: "5px 9px", fontSize: 12 }}>Modifier</button>
            <button onClick={del} style={{ ...btnGhost, color: RED, padding: "4px 9px", fontSize: 12 }}>×</button>
          </>
        )}
      </div>
      {showQ && !editing && (
        <div style={{ padding: "0 16px 12px" }}>
          <QuestionsAdmin comp={c} reload={reload} />
        </div>
      )}
    </div>
  );
}

// ─── Admin : gérer les questions QCM d'une compétence ────────────────
function QuestionsAdmin({ comp, reload }: { comp: Competence; reload: () => void }) {
  return (
    <div style={{ background: "#FAF8F4", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {(comp.questions ?? []).map((q, i) => (
        <QuestionEditor key={q.id} q={q} index={i} reload={reload} />
      ))}
      <NewQuestion competenceId={comp.id} order={comp.questions?.length ?? 0} reload={reload} />
    </div>
  );
}

function QuestionEditor({ q, index, reload }: { q: Question; index: number; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [choices, setChoices] = useState<string[]>(q.choices.length ? q.choices : ["", ""]);
  const [correct, setCorrect] = useState(q.correctIndex);
  const [expl, setExpl] = useState(q.explanation ?? "");

  async function save() {
    const cl = choices.map(c => c.trim()).filter(Boolean);
    if (!prompt.trim() || cl.length < 2) return;
    await fetch(`/api/formation/questions/${q.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, choices: cl, correctIndex: Math.min(correct, cl.length - 1), explanation: expl }),
    });
    setEditing(false); reload();
  }
  async function del() {
    if (!confirm("Supprimer cette question ?")) return;
    await fetch(`/api/formation/questions/${q.id}`, { method: "DELETE" }); reload();
  }

  if (!editing) {
    return (
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", background: "#fff", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: DARK }}>{index + 1}. {q.prompt}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
            {q.choices.map((c, i) => (
              <span key={i} style={{ color: i === q.correctIndex ? GREEN : "#6b7280", fontWeight: i === q.correctIndex ? 700 : 400, marginRight: 10 }}>
                {i === q.correctIndex ? "✓ " : ""}{c}
              </span>
            ))}
          </div>
        </div>
        <button onClick={() => setEditing(true)} style={{ ...btnGhost, padding: "4px 9px", fontSize: 12 }}>Modifier</button>
        <button onClick={del} style={{ ...btnGhost, color: RED, padding: "4px 8px", fontSize: 12 }}>×</button>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${GOLD}`, borderRadius: 8, padding: 10, background: "#fff", display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Énoncé de la question" style={inp} />
      {choices.map((ch, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="radio" name={`correct-${q.id}`} checked={correct === i} onChange={() => setCorrect(i)} title="Bonne réponse" />
          <input value={ch} onChange={e => setChoices(cs => cs.map((x, j) => j === i ? e.target.value : x))} placeholder={`Réponse ${i + 1}`} style={{ ...inp, flex: 1 }} />
          {choices.length > 2 && (
            <button onClick={() => { setChoices(cs => cs.filter((_, j) => j !== i)); if (correct >= i && correct > 0) setCorrect(c => c - 1); }} style={{ ...btnGhost, color: RED, padding: "4px 8px", fontSize: 12 }}>×</button>
          )}
        </div>
      ))}
      <div>
        <button onClick={() => setChoices(cs => [...cs, ""])} style={{ ...btnGhost, padding: "4px 10px", fontSize: 12 }}>+ Réponse</button>
      </div>
      <input value={expl} onChange={e => setExpl(e.target.value)} placeholder="Explication (affichée après réponse, facultatif)" style={inp} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={{ ...btnGold, padding: "6px 12px", fontSize: 12 }}>Enregistrer</button>
        <button onClick={() => setEditing(false)} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }}>Annuler</button>
      </div>
    </div>
  );
}

function NewQuestion({ competenceId, order, reload }: { competenceId: string; order: number; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState<string[]>(["", ""]);
  const [correct, setCorrect] = useState(0);
  const [expl, setExpl] = useState("");

  async function save() {
    const cl = choices.map(c => c.trim()).filter(Boolean);
    if (!prompt.trim() || cl.length < 2) return;
    await fetch("/api/formation/questions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competenceId, prompt, choices: cl, correctIndex: Math.min(correct, cl.length - 1), explanation: expl, order }),
    });
    setPrompt(""); setChoices(["", ""]); setCorrect(0); setExpl(""); setOpen(false); reload();
  }

  if (!open) {
    return <div><button onClick={() => setOpen(true)} style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}>+ Ajouter une question</button></div>;
  }
  return (
    <div style={{ border: `1px solid ${GOLD}`, borderRadius: 8, padding: 10, background: "#fff", display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Énoncé de la question" style={inp} />
      {choices.map((ch, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="radio" name="new-correct" checked={correct === i} onChange={() => setCorrect(i)} title="Bonne réponse" />
          <input value={ch} onChange={e => setChoices(cs => cs.map((x, j) => j === i ? e.target.value : x))} placeholder={`Réponse ${i + 1}`} style={{ ...inp, flex: 1 }} />
          {choices.length > 2 && (
            <button onClick={() => { setChoices(cs => cs.filter((_, j) => j !== i)); if (correct >= i && correct > 0) setCorrect(c => c - 1); }} style={{ ...btnGhost, color: RED, padding: "4px 8px", fontSize: 12 }}>×</button>
          )}
        </div>
      ))}
      <div><button onClick={() => setChoices(cs => [...cs, ""])} style={{ ...btnGhost, padding: "4px 10px", fontSize: 12 }}>+ Réponse</button></div>
      <input value={expl} onChange={e => setExpl(e.target.value)} placeholder="Explication (facultatif)" style={inp} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={{ ...btnGold, padding: "6px 12px", fontSize: 12 }}>Ajouter</button>
        <button onClick={() => setOpen(false)} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }}>Annuler</button>
      </div>
    </div>
  );
}

function AddRow({ placeholder1, placeholder2, onAdd }: { placeholder1: string; placeholder2: string; onAdd: (t: string, d: string) => void }) {
  const [t, setT] = useState(""); const [d, setD] = useState("");
  return (
    <div style={{ padding: "10px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
      <input value={t} onChange={e => setT(e.target.value)} placeholder={placeholder1} style={{ ...inp, flex: 1 }} />
      <input value={d} onChange={e => setD(e.target.value)} placeholder={placeholder2} style={{ ...inp, flex: 1 }} />
      <button onClick={() => { if (t.trim()) { onAdd(t, d); setT(""); setD(""); } }} disabled={!t.trim()} style={{ ...btnGhost, opacity: !t.trim() ? 0.5 : 1 }}>Ajouter</button>
    </div>
  );
}

// ─── Admin : affecter les parrains ───────────────────────────────────
function Affectation({ users, reload }: { users: AdminUser[]; reload: () => void }) {
  const { update } = useSession();
  const router = useRouter();
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

  async function impersonate(u: AdminUser) {
    if (!confirm(`Prendre la main sur le compte de ${u.prenom} ${u.nom} ?\nVous verrez le logiciel comme cet utilisateur ; un bandeau rouge permettra de revenir.`)) return;
    await update({ impersonate: u.id });
    router.push("/formation");
    router.refresh();
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
            <button onClick={() => impersonate(u)} title="Prendre la main (voir en tant que cet utilisateur)"
              style={{ ...btnGhost, padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}>
              👤→ Prendre la main
            </button>
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
