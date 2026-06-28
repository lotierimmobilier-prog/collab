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

type Tab = "controle" | "parcours" | "filleuls" | "suivi" | "modules" | "affectation";

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
    if (isAdmin) setTab("controle");
    else if (filleuls.length > 0) setTab("controle");
    else setTab("parcours");
  }, [me, isAdmin, filleuls.length]);

  // Tous les filleuls de l'agence (admin) = utilisateurs ayant un parrain.
  const allFilleuls: Person[] = users
    .filter(u => u.parrainId)
    .map(u => ({ id: u.id, prenom: u.prenom, nom: u.nom, email: u.email }));

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "controle", label: "Contrôle", show: !!isAdmin || filleuls.length > 0 },
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

            {tab === "controle" && (!!isAdmin || filleuls.length > 0) && (
              <ControleView modules={modules} isAdmin={!!isAdmin} />
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

// ─── Espace de contrôle : tableau de bord de la formation ─────────────
interface OvFilleul {
  id: string; prenom: string; nom: string; active: boolean;
  parrain: { id: string; prenom: string; nom: string } | null;
  total: number; done: number; progress: number;
  quiz: { answered: number; correct: number; rate: number | null };
  lastActivity: string | null;
  status: "termine" | "en_cours" | "en_retard" | "jamais";
  perModule: { moduleId: string; done: number; total: number }[];
}
interface OvParrain { id: string; prenom: string; nom: string; filleulsCount: number; avgProgress: number; enRetard: number }
interface Overview {
  isAdmin: boolean;
  filleuls: OvFilleul[]; parrains: OvParrain[];
  kpi: { filleuls: number; avgProgress: number; doneCompetences: number; termine: number; enRetard: number; jamais: number; avgQuiz: number | null };
  retardDays: number; generatedAt: string;
}

const ST_META: Record<OvFilleul["status"], { label: string; color: string; bg: string }> = {
  termine: { label: "Terminé", color: "#2F855A", bg: "#E6F4EA" },
  en_cours: { label: "En cours", color: "#2563eb", bg: "#E8EEFB" },
  en_retard: { label: "En retard", color: "#B91C1C", bg: "#FCE9E9" },
  jamais: { label: "Jamais commencé", color: "#8a8275", bg: "#F0EDE7" },
};
const pctTxt = (n: number) => `${Math.round(n * 100)}%`;

function ProgressBar({ p, w = 120 }: { p: number; w?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <div style={{ background: "#eee", borderRadius: 6, height: 8, width: w, overflow: "hidden" }}>
        <div style={{ background: GOLD, height: 8, width: `${Math.round(p * 100)}%` }} />
      </div>
      <span style={{ fontSize: 12, color: DARK, fontWeight: 600, minWidth: 34 }}>{pctTxt(p)}</span>
    </div>
  );
}

function ControleView({ modules, isAdmin }: { modules: Module[]; isAdmin: boolean }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "alert">("all");
  const [sel, setSel] = useState<OvFilleul | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/formation/overview");
      if (r.ok) setOv(await r.json());
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: "#9ca3af", fontSize: 13, padding: 24, textAlign: "center" }}>Chargement du tableau de bord…</div>;
  if (!ov || ov.filleuls.length === 0) return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 26, textAlign: "center", color: "#6b7280", fontSize: 13.5 }}>
      Aucun filleul à suivre pour le moment.
    </div>
  );

  // Vue détaillée d'un filleul (drill-in vers son parcours).
  if (sel) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setSel(null)} style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: DARK }}>← Retour au tableau de bord</button>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{sel.prenom} {sel.nom}</div>
          {sel.parrain && <span style={{ fontSize: 12.5, color: "#6b7280" }}>Parrain : {sel.parrain.prenom} {sel.parrain.nom}</span>}
          <a href={`/api/formation/report?filleulId=${sel.id}`} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", textDecoration: "none", background: GOLD, color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}>⤓ Bilan PDF</a>
        </div>
        <Parcours filleulId={sel.id} modules={modules} side="parrain" canParrain={true} canFilleul={isAdmin} />
      </div>
    );
  }

  const k = ov.kpi;
  const rows = filter === "alert" ? ov.filleuls.filter(f => f.status === "en_retard" || f.status === "jamais") : ov.filleuls;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Bandeau fun : météo + blague + conseil du jour */}
      <FunBand kpi={k} />

      {/* KPI */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Kpi label="Filleuls suivis" value={String(k.filleuls)} />
        <Kpi label="Avancement moyen" value={pctTxt(k.avgProgress)} color={GOLD} />
        <Kpi label="Terminés" value={String(k.termine)} color={GREEN} />
        <Kpi label="En retard" value={String(k.enRetard)} color={k.enRetard ? RED : DARK} />
        <Kpi label="Jamais commencé" value={String(k.jamais)} color={k.jamais ? "#8a8275" : DARK} />
        <Kpi label="Réussite QCM" value={k.avgQuiz === null ? "—" : pctTxt(k.avgQuiz)} />
      </div>

      {/* Filtres + export */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {([["all", "Tous"], ["alert", `À relancer${k.enRetard + k.jamais ? ` (${k.enRetard + k.jamais})` : ""}`]] as const).map(([id, lbl]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: "6px 13px", borderRadius: 999, cursor: "pointer", fontSize: 12.5,
            border: `1px solid ${filter === id ? GOLD : BORDER}`, background: filter === id ? GOLD_BG : "#fff",
            fontWeight: filter === id ? 700 : 500, color: DARK,
          }}>{lbl}</button>
        ))}
        <a href="/api/formation/report" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", textDecoration: "none", background: "#fff", border: `1px solid ${BORDER}`, color: DARK, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}>⤓ Exporter le bilan global</a>
      </div>

      {/* Tableau des filleuls */}
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
            <thead>
              <tr style={{ background: GOLD_BG, color: DARK }}>
                {["Filleul", "Parrain", "Avancement", "QCM", "Dernière activité", "Statut"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 && i <= 3 ? "center" : "left", padding: "9px 12px", fontSize: 11.5, fontWeight: 700, borderBottom: `2px solid ${GOLD}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(f => {
                const st = ST_META[f.status];
                return (
                  <tr key={f.id} onClick={() => setSel(f)} style={{ cursor: "pointer", borderBottom: `1px solid #f4f1ec` }}>
                    <td style={{ padding: "9px 12px", fontWeight: 600, color: DARK, whiteSpace: "nowrap" }}>{f.prenom} {f.nom}</td>
                    <td style={{ padding: "9px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>{f.parrain ? `${f.parrain.prenom} ${f.parrain.nom}` : "—"}</td>
                    <td style={{ padding: "9px 12px", textAlign: "center" }}><ProgressBar p={f.progress} w={90} /></td>
                    <td style={{ padding: "9px 12px", textAlign: "center", color: f.quiz.rate !== null && f.quiz.rate < 0.5 ? RED : DARK }}>{f.quiz.rate === null ? "—" : pctTxt(f.quiz.rate)}</td>
                    <td style={{ padding: "9px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>{f.lastActivity ? new Date(f.lastActivity).toLocaleDateString("fr-FR") : "—"}</td>
                    <td style={{ padding: "9px 12px" }}><span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" }}>{st.label}</span></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 22, textAlign: "center", color: "#9ca3af" }}>Aucun filleul dans ce filtre.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af" }}>Cliquez sur un filleul pour ouvrir son parcours détaillé. « En retard » = aucune activité depuis plus de {ov.retardDays} jours.</div>

      {/* Charge des parrains */}
      {ov.parrains.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK, margin: "4px 0 8px" }}>Charge des parrains</div>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 460 }}>
                <thead>
                  <tr style={{ background: GOLD_BG, color: DARK }}>
                    {["Parrain", "Filleuls", "Avancement moyen", "À relancer"].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 0 ? "left" : "center", padding: "9px 12px", fontSize: 11.5, fontWeight: 700, borderBottom: `2px solid ${GOLD}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ov.parrains.map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid #f4f1ec` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600, color: DARK, whiteSpace: "nowrap" }}>{p.prenom} {p.nom}</td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}>{p.filleulsCount}</td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}><ProgressBar p={p.avgProgress} w={80} /></td>
                      <td style={{ padding: "9px 12px", textAlign: "center", color: p.enRetard ? RED : "#6b7280", fontWeight: p.enRetard ? 700 : 500 }}>{p.enRetard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Bandeau « fun » : météo locale + blague + conseil de coaching pour égayer
// le pilotage de la formation.
const FORMATION_JOKES: string[] = [
  "Pourquoi le filleul a apporté une échelle en formation ? Pour viser plus haut. 🪜",
  "Un bon parrain, c'est comme un GPS : il recalcule sans jamais s'énerver. 🧭",
  "Le filleul demande : « C'est quoi un mandat exclusif ? » Le parrain : « Une promesse qu'on tient à deux. » 🤝",
  "La compétence, c'est 10 % de talent et 90 % de « on recommence ». 🔁",
  "Conseil d'agent : ne jamais dire « facile » avant d'avoir signé. 😅",
  "Un compromis bien expliqué vaut mieux qu'un grand discours. 📄",
  "Le secret d'une visite réussie ? Arriver avant le client… et après le ménage. 🧹",
  "En immobilier, le « non » d'aujourd'hui est juste un « pas encore » mal rangé. 🗂️",
];
const FORMATION_TIPS: string[] = [
  "Validez une compétence dès qu'elle est acquise : un filleul voit sa progression et garde la motivation.",
  "Un point de 10 min par semaine avec chaque filleul vaut mieux qu'une longue réunion par mois.",
  "Faites refaire le QCM après une mise en situation réelle : la théorie s'ancre par la pratique.",
  "Relancez en priorité les filleuls « en retard » : un blocage repéré tôt se débloque vite.",
  "Confiez une vraie tâche terrain après chaque module : rien ne remplace le concret.",
  "Célébrez les compétences terminées : un filleul reconnu devient un parrain motivé.",
  "Demandez au filleul d'expliquer ce qu'il a appris : enseigner, c'est maîtriser deux fois.",
];
function wmoIcon(code: number): string {
  if (code <= 1) return "☀️";
  if (code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function FunBand({ kpi }: { kpi: { filleuls: number; termine: number; enRetard: number } }) {
  const [joke, setJoke] = useState("");
  const [tip, setTip] = useState("");
  const [wx, setWx] = useState<{ temp: number; code: number; city: string } | null>(null);
  useEffect(() => {
    setJoke(FORMATION_JOKES[Math.floor(Math.random() * FORMATION_JOKES.length)]);
    setTip(FORMATION_TIPS[Math.floor(Math.random() * FORMATION_TIPS.length)]);
    fetch("/api/weather").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.current && d?.city) setWx({ temp: d.current.temp, code: d.current.code, city: d.city });
    }).catch(() => {});
  }, []);

  const h = new Date().getHours();
  const hello = h < 12 ? "Bonne matinée" : h < 18 ? "Bel après-midi" : "Bonne soirée";
  const mood = kpi.enRetard === 0
    ? "Toute l'équipe est sur les rails, bravo ! 🚀"
    : `${kpi.enRetard} filleul${kpi.enRetard > 1 ? "s" : ""} à relancer — un petit coup de pouce et c'est reparti. 💪`;

  return (
    <div style={{ borderRadius: 16, padding: "16px 20px", background: "linear-gradient(135deg, #FCFAF6 0%, #F7F0E6 100%)", border: `1px solid ${BORDER}`, boxShadow: "0 4px 16px rgba(28,26,23,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>{hello} 👋 <span style={{ color: "#6b6357", fontWeight: 500, fontSize: 14 }}>{mood}</span></div>
        {wx && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600, color: DARK, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 16 }}>{wmoIcon(wx.code)}</span> {wx.temp}° · {wx.city}
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 13px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>😄 Blague du jour</div>
          <div style={{ fontSize: 12.5, color: "#3f3a33", lineHeight: 1.5 }}>{joke}</div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 13px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>💡 Conseil du jour</div>
          <div style={{ fontSize: 12.5, color: "#3f3a33", lineHeight: 1.5 }}>{tip}</div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 16px", minWidth: 118, flex: "1 1 118px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? DARK }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{label}</div>
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
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function setParrain(userId: string, parrainId: string) {
    setBusy(userId); setErr(null); setSaved(null);
    try {
      const r = await fetch(`/api/users/${userId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parrainId: parrainId || null }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Échec de l'enregistrement."); return; }
      // Recharge et vérifie que le parrain est bien persisté en base.
      await reload();
      setSaved(userId);
      setTimeout(() => setSaved(s => s === userId ? null : s), 2500);
    } catch { setErr("Erreur réseau."); }
    finally { setBusy(null); }
  }

  async function impersonate(u: AdminUser) {
    if (!confirm(`Prendre la main sur le compte de ${u.prenom} ${u.nom} ?\nVous verrez le logiciel comme cet utilisateur ; un bandeau rouge permettra de revenir.`)) return;
    await update({ impersonate: u.id });
    router.push("/formation");
    router.refresh();
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: GOLD_BG, borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: DARK, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Affectation des parrains</span>
        {err && <span style={{ fontSize: 12, fontWeight: 500, color: RED }}>{err}</span>}
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
            <span style={{ fontSize: 12, color: GREEN, width: 70, fontWeight: 600 }}>{saved === u.id ? "✓ Enregistré" : busy === u.id ? "…" : ""}</span>
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
