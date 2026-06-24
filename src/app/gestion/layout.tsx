"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK    = "#1C1A17";
const BORDER  = "#E6E1D9";

const MENU = [
  { label: "Vue d'ensemble",   href: "/gestion",                icon: "🏠" },
  { label: "Propriétaires",    href: "/gestion/proprietaires",  icon: "👤" },
  { label: "Locataires",       href: "/gestion/locataires",     icon: "🔑" },
  { label: "Lots & Biens",     href: "/gestion/lots",           icon: "🏢" },
  { label: "Baux",             href: "/gestion/baux",           icon: "📄" },
  { label: "Paiements loyers", href: "/gestion/paiements",      icon: "💶" },
  { type: "sep", label: "COMPTABILITÉ" },
  { label: "Appels de loyers", href: "/gestion/appels-loyers",  icon: "📋" },
  { label: "Encaissements",    href: "/gestion/encaissements",  icon: "↗" },
  { label: "Écritures journal",href: "/gestion/journal",        icon: "📖" },
  { label: "Dépôts de garantie",href: "/gestion/depots",       icon: "🛡" },
  { label: "Révision loyers",  href: "/gestion/revision",       icon: "📈" },
  { label: "Plan comptable",   href: "/gestion/plan-comptable", icon: "∑" },
  { type: "sep", label: "TRAITEMENTS" },
  { label: "Prélèvements",     href: "/gestion/prelevements",   icon: "💳" },
  { label: "APL",              href: "/gestion/apl",            icon: "🏠" },
  { label: "Impayés",          href: "/gestion/impayes",        icon: "⚠" },
  { type: "sep", label: "CONTRÔLES" },
  { label: "Balance locataires",href: "/gestion/balance-loc",   icon: "⚖" },
  { label: "Balance comptes",  href: "/gestion/balance-cpt",    icon: "⚖" },
  { label: "Trésorerie",       href: "/gestion/tresorerie",     icon: "💵" },
  { type: "sep", label: "RELANCES" },
  { label: "Impayés",          href: "/gestion/relances-impayes",icon: "💸" },
  { label: "Assurances",       href: "/gestion/relances-assurances",icon: "🛡" },
  { label: "Entretien",        href: "/gestion/relances-entretien",icon: "🔧" },
  { type: "sep", label: "AUTRE" },
  { label: "Fournisseurs",     href: "/gestion/fournisseurs",   icon: "🔧" },
  { label: "Documents",        href: "/gestion/documents",      icon: "📂" },
  { label: "Statistiques",     href: "/gestion/statistiques",   icon: "📊" },
  { label: "Paramètres",       href: "/gestion/parametres",     icon: "⚙" },
];

export default function GestionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Barre retour */}
      <div style={{ height: 44, flexShrink: 0, background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, background: GOLD_BG, border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: GOLD }}>
          ← Retour Collab
        </Link>
        <span style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Gestion locative</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lotier" style={{ height: 24, width: "auto" }} />
        </div>
      </div>

      {/* Corps : sidebar + contenu */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{ width: 210, flexShrink: 0, background: "#FAFAF8", borderRight: `1px solid ${BORDER}`, overflowY: "scroll", display: "flex", flexDirection: "column" }}>
          <nav style={{ padding: "8px 0 20px" }}>
            {MENU.map((item, i) => {
              if ("type" in item && item.type === "sep") return (
                <div key={i} style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#A09880", padding: "10px 16px 3px", fontWeight: 600 }}>
                  {item.label}
                </div>
              );
              const href = (item as { href: string }).href;
              const active = pathname === href;
              return (
                <Link key={i} href={href} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 16px", fontSize: 12, cursor: "pointer", color: active ? GOLD : "#5C5449", background: active ? GOLD_BG : "transparent", borderLeft: active ? `2px solid ${GOLD}` : "2px solid transparent", fontWeight: active ? 600 : 400, transition: "background 0.12s" }}
                    onMouseEnter={e => !active && (e.currentTarget.style.background = "#F7F0E680")}
                    onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{(item as { icon: string }).icon}</span>
                    <span>{(item as { label: string }).label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Contenu */}
        <main style={{ flex: 1, overflowY: "auto", background: "#F3F1EC", minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
