"use client";
import { useState } from "react";

type Role = "admin" | "dirigeant" | "agent" | "comptable" | "gestionnaire" | "syndic";

const ROLES: { id: Role; label: string; icon: string }[] = [
  { id: "admin",        label: "Administrateur",  icon: "⚙️" },
  { id: "dirigeant",   label: "Dirigeant",        icon: "🏢" },
  { id: "agent",       label: "Agent commercial", icon: "🤝" },
  { id: "comptable",   label: "Comptable",        icon: "📊" },
  { id: "gestionnaire",label: "Gestionnaire",     icon: "🏠" },
  { id: "syndic",      label: "Syndic",           icon: "◫" },
];

const DAYS   = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function today() {
  const d = new Date();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function greet(name: string) {
  const h = new Date().getHours();
  if (h < 12) return `Bonjour ${name}`;
  if (h < 18) return `Bon après-midi ${name}`;
  return `Bonsoir ${name}`;
}

/* ── Composants ─────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>{children}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, color = "#B8966A", icon, href }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string; href?: string;
}) {
  const inner = (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px 18px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f3f4f6",
      display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden",
      cursor: href ? "pointer" : "default", height: "100%", boxSizing: "border-box",
    }}
      onMouseEnter={e => href && (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
      onMouseLeave={e => href && (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{label}</div>
        {icon && <div style={{ fontSize: 20 }}>{icon}</div>}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>{sub}</div>}
      </div>
    </div>
  );
  return href ? <a href={href} style={{ textDecoration: "none" }}>{inner}</a> : inner;
}

function RingCard({ label, value, max, color = "#B8966A", sub }: {
  label: string; value: number; max: number; color?: string; sub?: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const r = 36; const circ = 2 * Math.PI * r;
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f3f4f6", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke="#f3f4f6" strokeWidth={7} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round" transform="rotate(-90 45 45)" />
        <text x={45} y={45} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="#111827">{value}</text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ActionCard({ icon, label, desc, color, href }: { icon: string; label: string; desc: string; color: string; href: string }) {
  return (
    <a href={href} style={{ textDecoration: "none" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}
      >
        <div style={{ width: 42, height: 42, borderRadius: 12, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{desc}</div>
        </div>
        <div style={{ color: "#d1d5db", fontSize: 18, flexShrink: 0 }}>›</div>
      </div>
    </a>
  );
}

function Alert({ type, text }: { type: "warning" | "info" | "success" | "error"; text: string }) {
  const s = { warning:{bg:"#fffbeb",border:"#fde68a",icon:"⚠️",c:"#92400e"}, info:{bg:"#eff6ff",border:"#bfdbfe",icon:"ℹ️",c:"#1e40af"}, success:{bg:"#f0fdf4",border:"#bbf7d0",icon:"✓",c:"#166534"}, error:{bg:"#fef2f2",border:"#fecaca",icon:"✕",c:"#991b1b"} }[type];
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 14 }}>{s.icon}</span>
      <span style={{ fontSize: 12, color: s.c }}>{text}</span>
    </div>
  );
}

/* ── Vues par rôle ─────────────────────────────────────────── */

function AdminView() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <Alert type="info" text="3 utilisateurs en attente d'activation" />
        <Alert type="warning" text="Webhook GitHub — vérifier le statut de déploiement" />
      </div>
      <Section title="Activité plateforme">
        <KpiCard label="Utilisateurs actifs" value={8} sub="sur 12 inscrits" icon="👥" color="#B8966A" href="/admin/utilisateurs" />
        <KpiCard label="Connexions aujourd'hui" value={23} sub="+4 vs hier" icon="📡" color="#2563eb" />
        <KpiCard label="Modules actifs" value={7} sub="sur 10 disponibles" icon="🧩" color="#059669" />
        <KpiCard label="Espace serveur" value="2.4 Go" sub="sur 96 Go disponibles" icon="💾" color="#d97706" />
      </Section>
      <Section title="Vue d'ensemble modules">
        <RingCard label="Dossiers locataires" value={12} max={50} color="#B8966A" sub="en cours" />
        <RingCard label="Tâches ouvertes" value={34} max={100} color="#2563eb" sub="toutes équipes" />
        <RingCard label="Messages non lus" value={7} max={50} color="#dc2626" sub="toutes boîtes" />
        <RingCard label="Encaissements" value={3} max={20} color="#059669" sub="à valider" />
      </Section>
      <Section title="Actions rapides">
        <ActionCard icon="👤" label="Gérer les utilisateurs" desc="Créer, modifier, désactiver" color="#B8966A" href="/admin/utilisateurs" />
        <ActionCard icon="🔐" label="Rôles & permissions" desc="Droits par module" color="#2563eb" href="/admin/roles" />
        <ActionCard icon="👥" label="Équipes" desc="Gestion, Transaction, Syndic…" color="#7C3AED" href="/admin/equipes" />
        <ActionCard icon="📊" label="Comptabilité" desc="Encaissements & factures" color="#059669" href="/comptabilite" />
        <ActionCard icon="✉️" label="Messagerie" desc="Comptes mail configurés" color="#d97706" href="/messagerie" />
        <ActionCard icon="📅" label="Planning" desc="Agendas équipe" color="#0891b2" href="/planning" />
        <ActionCard icon="📁" label="Dossiers locataires" desc="Toutes candidatures" color="#dc2626" href="/locataires" />
      </Section>
    </>
  );
}

function DirigeantView() {
  return (
    <>
      <Section title="Performance agence">
        <KpiCard label="CA du mois" value="42 800 €" sub="+12% vs mois dernier" icon="💰" color="#059669" href="/comptabilite" />
        <KpiCard label="Commissions agents" value="6 420 €" sub="4 agents actifs" icon="🤝" color="#B8966A" href="/comptabilite" />
        <KpiCard label="Dossiers en cours" value={12} sub="3 en attente GLI" icon="📁" color="#2563eb" href="/locataires" />
        <KpiCard label="Locations signées" value={5} sub="ce mois" icon="🔑" color="#d97706" />
      </Section>
      <Section title="Suivi équipe">
        <RingCard label="Tâches équipe" value={34} max={60} color="#B8966A" sub="34 ouvertes" />
        <RingCard label="Dossiers complets" value={8} max={12} color="#059669" sub="prêts à signer" />
        <RingCard label="Rdv cette semaine" value={11} max={20} color="#2563eb" sub="planifiés" />
        <RingCard label="Msgs non lus" value={4} max={30} color="#dc2626" sub="toutes boîtes" />
      </Section>
      <Section title="Accès rapides">
        <ActionCard icon="📁" label="Dossiers locataires" desc="Suivi candidatures & GLI" color="#B8966A" href="/locataires" />
        <ActionCard icon="📊" label="Comptabilité" desc="CA, commissions, TVA" color="#059669" href="/comptabilite" />
        <ActionCard icon="📅" label="Planning" desc="Agenda équipe" color="#2563eb" href="/planning" />
        <ActionCard icon="✔️" label="Tâches équipe" desc="Kanban global" color="#d97706" href="/taches" />
        <ActionCard icon="✉️" label="Messagerie" desc="Communications" color="#dc2626" href="/messagerie" />
      </Section>
    </>
  );
}

function AgentView() {
  return (
    <>
      <Section title="Mes indicateurs">
        <KpiCard label="Mes dossiers" value={4} sub="2 en attente validation" icon="📁" color="#B8966A" href="/locataires" />
        <KpiCard label="Mes commissions" value="1 840 €" sub="ce mois" icon="💰" color="#059669" href="/comptabilite" />
        <KpiCard label="Mes tâches" value={7} sub="3 urgentes" icon="✔️" color="#dc2626" href="/taches" />
        <KpiCard label="Messages non lus" value={2} sub="boîte principale" icon="✉️" color="#d97706" href="/messagerie" />
      </Section>
      <Section title="Mes dossiers">
        <RingCard label="Dossiers actifs" value={4} max={10} color="#B8966A" sub="sur objectif 10" />
        <RingCard label="Docs reçus" value={28} max={40} color="#059669" sub="pièces complètes" />
        <RingCard label="GLI validés" value={2} max={4} color="#2563eb" sub="éligibles" />
        <RingCard label="Tâches faites" value={14} max={21} color="#d97706" sub="cette semaine" />
      </Section>
      <Section title="Accès rapides">
        <ActionCard icon="📁" label="Mes dossiers" desc="Candidatures locataires" color="#B8966A" href="/locataires" />
        <ActionCard icon="📊" label="Mes commissions" desc="Auto-facturation" color="#059669" href="/comptabilite" />
        <ActionCard icon="📅" label="Mon planning" desc="Mes rendez-vous" color="#2563eb" href="/planning" />
        <ActionCard icon="✔️" label="Mes tâches" desc="Kanban personnel" color="#d97706" href="/taches" />
        <ActionCard icon="✉️" label="Messagerie" desc="Mes boîtes mail" color="#dc2626" href="/messagerie" />
        <ActionCard icon="🔗" label="Lien candidature" desc="À partager aux locataires" color="#0891b2" href="/candidature" />
      </Section>
    </>
  );
}

function ComptableView() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <Alert type="warning" text="3 encaissements en attente de validation" />
        <Alert type="info" text="Déclaration TVA T2 — échéance dans 8 jours" />
      </div>
      <Section title="Tableau financier">
        <KpiCard label="Encaissements du mois" value="42 800 €" sub="dont 3 à valider" icon="💳" color="#059669" href="/comptabilite" />
        <KpiCard label="Commissions dues" value="6 420 €" sub="4 mandataires" icon="🤝" color="#B8966A" href="/comptabilite" />
        <KpiCard label="TVA collectée" value="4 280 €" sub="T2 2026" icon="📋" color="#2563eb" href="/comptabilite" />
        <KpiCard label="Dépenses du mois" value="8 340 €" sub="-3% vs mois dernier" icon="📤" color="#dc2626" href="/comptabilite" />
      </Section>
      <Section title="À traiter">
        <RingCard label="Factures à émettre" value={4} max={10} color="#B8966A" sub="mandataires" />
        <RingCard label="Encaissements" value={3} max={10} color="#059669" sub="à confirmer" />
        <RingCard label="Dépenses" value={6} max={20} color="#dc2626" sub="à catégoriser" />
        <RingCard label="TVA T2 saisie" value={78} max={100} color="#2563eb" sub="avancement %" />
      </Section>
      <Section title="Accès rapides">
        <ActionCard icon="💳" label="Encaissements" desc="Saisir & valider" color="#059669" href="/comptabilite" />
        <ActionCard icon="🧾" label="Factures mandataires" desc="Générer & envoyer" color="#B8966A" href="/comptabilite" />
        <ActionCard icon="📋" label="Déclaration TVA" desc="T2 2026 en cours" color="#2563eb" href="/comptabilite" />
        <ActionCard icon="📤" label="Dépenses" desc="Saisir les dépenses" color="#dc2626" href="/comptabilite" />
      </Section>
    </>
  );
}

function GestionnaireView() {
  return (
    <>
      <Section title="Gestion locative">
        <KpiCard label="Biens gérés" value={24} sub="18 occupés" icon="🏡" color="#059669" href="/biens" />
        <KpiCard label="Baux actifs" value={18} sub="2 à renouveler" icon="📄" color="#2563eb" href="/baux" />
        <KpiCard label="Loyers en attente" value={3} sub="ce mois" icon="€" color="#dc2626" href="/baux" />
        <KpiCard label="Propriétaires" value={11} sub="portefeuille" icon="👤" color="#B8966A" href="/proprietaires" />
      </Section>
      <Section title="Accès rapides">
        <ActionCard icon="🏡" label="Biens" desc="Gérer les lots" color="#059669" href="/biens" />
        <ActionCard icon="📄" label="Baux" desc="Contrats & locataires" color="#2563eb" href="/baux" />
        <ActionCard icon="📋" label="ODS" desc="Ordres de service" color="#B8966A" href="/ordres-de-service" />
        <ActionCard icon="⌂"  label="États des lieux" desc="Entrée / sortie" color="#d97706" href="/etats-des-lieux" />
      </Section>
    </>
  );
}

function SyndicView() {
  return (
    <>
      <Section title="Syndic de copropriété">
        <KpiCard label="Copropriétés" value={5} sub="gérées" icon="🏢" color="#2563eb" href="/syndic/coproprietés" />
        <KpiCard label="Assemblées" value={2} sub="à planifier" icon="◉" color="#d97706" href="/syndic/assemblees" />
        <KpiCard label="Charges à valider" value={7} sub="ce trimestre" icon="∑" color="#dc2626" href="/syndic/charges" />
        <KpiCard label="Travaux en cours" value={3} sub="chantiers" icon="🔧" color="#059669" href="/syndic/travaux" />
      </Section>
      <Section title="Accès rapides">
        <ActionCard icon="🏢" label="Copropriétés" desc="Gérer les immeubles" color="#2563eb" href="/syndic/coproprietés" />
        <ActionCard icon="◉" label="Assemblées" desc="AG & convocations" color="#d97706" href="/syndic/assemblees" />
        <ActionCard icon="∑" label="Charges" desc="Répartition & appels" color="#dc2626" href="/syndic/charges" />
        <ActionCard icon="🔧" label="Travaux" desc="Suivi chantiers" color="#059669" href="/syndic/travaux" />
      </Section>
    </>
  );
}

/* ── Composant principal ───────────────────────────────────── */
export default function Dashboard() {
  const [role, setRole] = useState<Role>("dirigeant");
  const currentRole = ROLES.find(r => r.id === role)!;

  const views: Record<Role, React.ReactNode> = {
    admin:          <AdminView />,
    dirigeant:      <DirigeantView />,
    agent:          <AgentView />,
    comptable:      <ComptableView />,
    gestionnaire:   <GestionnaireView />,
    syndic:         <SyndicView />,
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#f9fafb" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Tableau de bord</h1>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Vue d'ensemble · {today()}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ROLES.map(r => (
            <button key={r.id} onClick={() => setRole(r.id)} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: role === r.id ? "#B8966A" : "#f9fafb",
              color: role === r.id ? "#fff" : "#6b7280",
              border: `1px solid ${role === r.id ? "#B8966A" : "#e5e7eb"}`,
              borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer",
              fontWeight: role === r.id ? 600 : 400,
            }}>
              <span>{r.icon}</span> {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bannière */}
      <div style={{ margin: "20px 28px 4px", background: "linear-gradient(135deg, #B8966A 0%, #8A6A42 100%)", borderRadius: 14, padding: "18px 24px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{greet("Jérôme")} {currentRole.icon}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {{ admin:"Accès complet à la plateforme.", dirigeant:"Vue d'ensemble de votre agence.", agent:"Vos dossiers, commissions et tâches.", comptable:"Gestion financière et TVA.", gestionnaire:"Propriétaires, biens, baux et locataires.", syndic:"Copropriétés, assemblées et charges." }[role]}
          </div>
        </div>
        <div style={{ fontSize: 44, opacity: 0.25 }}>{currentRole.icon}</div>
      </div>

      <div style={{ padding: "20px 28px" }}>{views[role]}</div>
    </div>
  );
}
