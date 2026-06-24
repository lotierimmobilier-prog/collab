"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const GOLD      = "#B8966A";
const GOLD_BG   = "#F7F0E6";
const DARK      = "#1C1A17";
const LABEL_COLOR = "#A09880";
const ITEM_COLOR  = "#5C5449";
const BORDER    = "#E6E1D9";

const COLLAPSED_W = 52;
const EXPANDED_W  = 220;

const nav = [
  { id: "dashboard",  label: "Tableau de bord",    icon: "⊟",  href: "/",                group: "Principal" },
  { id: "tasks",      label: "Tâches",              icon: "✓",  href: "/taches",          group: "Principal" },
  { id: "planning",   label: "Planning",            icon: "▦",  href: "/planning",        group: "Principal" },
  { id: "mail",       label: "Messagerie email",    icon: "@",  href: "/messagerie",      group: "Principal", badge: 3 },
  { id: "chat",       label: "Messages internes",   icon: "💬", href: "/messagerie-interne", group: "Principal" },
  { id: "gestion-loc",    label: "Tableau de bord",     icon: "🏠", href: "/gestion-locative",    group: "Gestion" },
  { id: "proprietaires", label: "Propriétaires",       icon: "👤", href: "/proprietaires",       group: "Gestion" },
  { id: "biens",         label: "Biens",               icon: "🏡", href: "/biens",               group: "Gestion" },
  { id: "locataires",    label: "Locataires",          icon: "◎",  href: "/locataires",          group: "Gestion" },
  { id: "baux",          label: "Baux",                icon: "📄", href: "/baux",                group: "Gestion" },
  { id: "edl",           label: "États des lieux",     icon: "⌂",  href: "/etats-des-lieux",    group: "Gestion" },
  { id: "fournisseurs",  label: "Fournisseurs",        icon: "🔧", href: "/fournisseurs",        group: "Gestion" },
  { id: "ods",           label: "Ordres de service",   icon: "📋", href: "/ordres-de-service",   group: "Gestion" },
  { id: "syndic",        label: "Tableau de bord",     icon: "🏢", href: "/syndic",              group: "Syndic" },
  { id: "syndic-copro",  label: "Copropriétés",        icon: "◫",  href: "/syndic/coproprietees", group: "Syndic" },
  { id: "syndic-ag",     label: "Assemblées générales",icon: "◉",  href: "/syndic/assemblees",   group: "Syndic" },
  { id: "syndic-charges",label: "Charges",             icon: "∑",  href: "/syndic/charges",      group: "Syndic" },
  { id: "syndic-travaux",label: "Travaux",             icon: "🔧", href: "/syndic/travaux",      group: "Syndic" },
  { id: "compta",     label: "Tableau de bord",     icon: "∑",  href: "/comptabilite",    group: "Comptabilité" },
  { id: "compta-enc", label: "Encaissements",       icon: "↗",  href: "/comptabilite/encaissements", group: "Comptabilité" },
  { id: "compta-dep", label: "Dépenses",            icon: "↙",  href: "/comptabilite/depenses",      group: "Comptabilité" },
  { id: "compta-tva", label: "TVA",                 icon: "%",  href: "/comptabilite/tva",           group: "Comptabilité" },
  { id: "formation",  label: "Formation",           icon: "◈",  href: "/formation",       group: "Agence" },
  { id: "reseaux",    label: "Réseaux sociaux",     icon: "⌘",  href: "/reseaux-sociaux", group: "Agence" },
];

const adminNav = [
  { id: "admin-users",    label: "Utilisateurs",  icon: "○", href: "/admin/utilisateurs" },
  { id: "admin-roles",    label: "Rôles & droits", icon: "◫", href: "/admin/roles" },
  { id: "admin-settings", label: "Paramètres",    icon: "⚙", href: "/admin/parametres" },
];

const groups = ["Principal", "Gestion", "Syndic", "Comptabilité", "Agence"];

export default function Sidebar({ active }: { active: string }) {
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Lire la préférence stockée côté client uniquement
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  }

  const w = mounted && collapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    <aside style={{
      width: w,
      flexShrink: 0,
      background: "#FAFAF8",
      borderRight: `1px solid ${BORDER}`,
      display: "flex",
      flexDirection: "column",
      transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Logo + bouton toggle */}
      <div style={{ padding: collapsed ? "14px 0" : "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 8, minHeight: 64 }}>
        {!collapsed && (
          <Link href="/" style={{ textDecoration: "none", display: "block", flex: 1, minWidth: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Lotier Immobilier" style={{ width: 130, height: "auto", display: "block" }} />
          </Link>
        )}
        {collapsed && (
          <Link href="/" style={{ textDecoration: "none" }} title="Accueil">
            <span style={{ fontSize: 18, color: GOLD }}>⊟</span>
          </Link>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Agrandir le menu" : "Réduire le menu"}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: LABEL_COLOR, fontSize: 14, padding: "4px 6px", lineHeight: 1,
            borderRadius: 6, flexShrink: 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = GOLD_BG)}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 8, paddingBottom: 8 }}>
        {groups.map(group => {
          const items = nav.filter(n => n.group === group);
          return (
            <div key={group} style={{ marginBottom: 4 }}>
              {!collapsed && <NavLabel>{group}</NavLabel>}
              {collapsed && <div style={{ height: 8 }} />}
              {items.map(item => (
                <div key={item.id}>
                  <NavItem item={item} active={active} collapsed={collapsed} />
                  {item.id === "locataires" && !collapsed && (
                    <Link href="/candidature" style={{ textDecoration: "none" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 20px 6px 48px", fontSize: 12,
                        color: active === "candidature" ? GOLD : "#9E9690",
                        background: active === "candidature" ? GOLD_BG : "transparent",
                        borderLeft: active === "candidature" ? `2px solid ${GOLD}` : "2px solid transparent",
                      }}>
                        <span style={{ fontSize: 11 }}>↳</span>
                        <span>Lien candidature</span>
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {!collapsed && <NavLabel>Administration</NavLabel>}
        {collapsed && <div style={{ height: 8 }} />}
        {adminNav.map(item => <NavItem key={item.id} item={item} active={active} collapsed={collapsed} />)}
      </nav>

      {/* Utilisateur en bas */}
      {session?.user && (
        <div style={{
          padding: collapsed ? "12px 0" : "12px 16px",
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
        }}>
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" title={`${session.user.prenom ?? ""} ${session.user.nom ?? ""}`} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          ) : (
            <div
              title={`${session.user.prenom ?? ""} ${session.user.nom ?? ""}`}
              style={{
                width: 32, height: 32, borderRadius: "50%", background: GOLD_BG,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: GOLD, flexShrink: 0, cursor: "default",
              }}>
              {(session.user.prenom?.[0] ?? session.user.name?.[0] ?? "?").toUpperCase()}
              {(session.user.nom?.[0] ?? "").toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {session.user.prenom && session.user.nom
                    ? `${session.user.prenom} ${session.user.nom}`
                    : session.user.name}
                </div>
                <div style={{ fontSize: 10, color: LABEL_COLOR, textTransform: "capitalize" }}>
                  {session.user.roleId ?? "Utilisateur"}
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Se déconnecter"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: LABEL_COLOR, padding: 2, lineHeight: 1 }}
              >→</button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em",
      color: LABEL_COLOR, padding: "8px 20px 3px", fontWeight: 600,
    }}>{children}</div>
  );
}

function NavItem({ item, active, collapsed }: {
  item: { id: string; label: string; icon: string; href: string; badge?: number };
  active: string;
  collapsed: boolean;
}) {
  const isActive = active === item.id;
  return (
    <Link href={item.href} style={{ textDecoration: "none" }} title={collapsed ? item.label : undefined}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          padding: collapsed ? "8px 0" : "7px 20px",
          cursor: "pointer",
          fontSize: 13,
          color: isActive ? GOLD : ITEM_COLOR,
          background: isActive ? GOLD_BG : "transparent",
          borderLeft: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
          fontWeight: isActive ? 600 : 400,
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={e => !isActive && (e.currentTarget.style.background = GOLD_BG + "88")}
        onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
      >
        <span style={{
          fontSize: collapsed ? 15 : 13,
          width: collapsed ? "auto" : 16,
          textAlign: "center",
          color: isActive ? GOLD : "#A09880",
          fontWeight: 500,
        }}>{item.icon}</span>
        {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
        {!collapsed && item.badge && (
          <span style={{ background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
            {item.badge}
          </span>
        )}
        {collapsed && item.badge && (
          <span style={{
            position: "absolute", top: 2, right: 6,
            width: 7, height: 7, borderRadius: "50%",
            background: GOLD, display: "block",
          }} />
        )}
      </div>
    </Link>
  );
}
