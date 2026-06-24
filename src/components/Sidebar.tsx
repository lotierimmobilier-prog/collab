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
const EXPANDED_W  = 230;

/* ─── Structure de navigation ───────────────────────────────────
   subGroup → nom du groupe collapsible (null = niveau racine)
   indent   → afficher avec indentation (sous-item)
──────────────────────────────────────────────────────────────── */
interface NavItem {
  id: string; label: string; icon: string; href: string;
  group: string; subGroup?: string; indent?: boolean; badge?: number;
}

const nav: NavItem[] = [
  /* ── Principal ──────────────────────────────────────────────── */
  { id: "dashboard", label: "Tableau de bord",   icon: "⊟",  href: "/",                 group: "Principal" },
  { id: "tasks",     label: "Tâches",             icon: "✓",  href: "/taches",           group: "Principal" },
  { id: "planning",  label: "Planning",           icon: "▦",  href: "/planning",         group: "Principal" },
  { id: "mail",      label: "Messagerie email",   icon: "@",  href: "/messagerie",       group: "Principal", badge: 3 },
  { id: "chat",      label: "Messages internes",  icon: "💬", href: "/messagerie-interne", group: "Principal" },
  { id: "appels",    label: "Appels téléphoniques", icon: "📞", href: "/appels",           group: "Principal" },

  /* ── Gestion · Tableau de bord (pas de sous-groupe) ─────────── */
  { id: "gestion-loc", label: "Vue d'ensemble",   icon: "🏠", href: "/gestion-locative", group: "Gestion" },

  /* ── Gestion · Patrimoine ────────────────────────────────────── */
  { id: "proprietaires", label: "Propriétaires",  icon: "👤", href: "/proprietaires",    group: "Gestion", subGroup: "Patrimoine", indent: true },
  { id: "biens",         label: "Biens & lots",   icon: "🏡", href: "/biens",            group: "Gestion", subGroup: "Patrimoine", indent: true },

  /* ── Gestion · Locataires & Baux ─────────────────────────────── */
  { id: "locataires",  label: "Locataires",       icon: "◎",  href: "/locataires",       group: "Gestion", subGroup: "Locataires & Baux", indent: true },
  { id: "baux",        label: "Baux",             icon: "📄", href: "/baux",             group: "Gestion", subGroup: "Locataires & Baux", indent: true },
  { id: "edl",         label: "États des lieux",  icon: "⌂",  href: "/etats-des-lieux",  group: "Gestion", subGroup: "Locataires & Baux", indent: true },
  { id: "candidature", label: "Candidatures",     icon: "📥", href: "/candidature",      group: "Gestion", subGroup: "Locataires & Baux", indent: true },

  /* ── Gestion · Suivi ─────────────────────────────────────────── */
  { id: "loyers",      label: "Loyers & quittances", icon: "💶", href: "/loyers",        group: "Gestion", subGroup: "Suivi", indent: true },
  { id: "ods",         label: "Ordres de service", icon: "📋", href: "/ordres-de-service", group: "Gestion", subGroup: "Suivi", indent: true },
  { id: "fournisseurs",label: "Fournisseurs",      icon: "🔧", href: "/fournisseurs",    group: "Gestion", subGroup: "Suivi", indent: true },

  /* ── Comptabilité ────────────────────────────────────────────── */
  { id: "compta",     label: "Tableau de bord",   icon: "∑",  href: "/comptabilite",                  group: "Comptabilité" },
  { id: "compta-enc", label: "Encaissements",     icon: "↗",  href: "/comptabilite/encaissements",    group: "Comptabilité", subGroup: "Compta·Détail", indent: true },
  { id: "compta-dep", label: "Dépenses",          icon: "↙",  href: "/comptabilite/depenses",         group: "Comptabilité", subGroup: "Compta·Détail", indent: true },
  { id: "compta-tva", label: "TVA",               icon: "%",  href: "/comptabilite/tva",              group: "Comptabilité", subGroup: "Compta·Détail", indent: true },

  /* ── Agence ──────────────────────────────────────────────────── */
  { id: "formation", label: "Formation",          icon: "◈",  href: "/formation",        group: "Agence" },
  { id: "reseaux",   label: "Réseaux sociaux",    icon: "⌘",  href: "/reseaux-sociaux",  group: "Agence" },
];

const adminNav = [
  { id: "admin-users",    label: "Utilisateurs",   icon: "○", href: "/admin/utilisateurs" },
  { id: "admin-roles",    label: "Rôles & droits", icon: "◫", href: "/admin/roles" },
  { id: "admin-settings", label: "Paramètres",     icon: "⚙", href: "/admin/parametres" },
];

const groups = ["Principal", "Gestion", "Comptabilité", "Agence"];

/* Sous-groupes ouverts par défaut */
const DEFAULT_OPEN: Record<string, boolean> = {
  "Patrimoine": true,
  "Locataires & Baux": true,
  "Suivi": true,
  "Syndic·Parc": false,
  "Compta·Détail": false,
};

export default function Sidebar({ active }: { active: string }) {
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [openSubs, setOpenSubs]   = useState<Record<string, boolean>>(DEFAULT_OPEN);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
    const subs = localStorage.getItem("sidebar_subs");
    if (subs) { try { setOpenSubs(JSON.parse(subs)); } catch { /* ignore */ } }
  }, []);

  /* Auto-ouvrir le sous-groupe contenant l'item actif */
  useEffect(() => {
    const activeItem = nav.find(n => n.id === active);
    if (activeItem?.subGroup) {
      setOpenSubs(prev => {
        if (prev[activeItem.subGroup!]) return prev;
        const next = { ...prev, [activeItem.subGroup!]: true };
        localStorage.setItem("sidebar_subs", JSON.stringify(next));
        return next;
      });
    }
  }, [active]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  }

  function toggleSub(sg: string) {
    setOpenSubs(prev => {
      const next = { ...prev, [sg]: !prev[sg] };
      localStorage.setItem("sidebar_subs", JSON.stringify(next));
      return next;
    });
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
      {/* Logo + toggle */}
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
        <button onClick={toggle} title={collapsed ? "Agrandir" : "Réduire"}
          style={{ background: "none", border: "none", cursor: "pointer", color: LABEL_COLOR, fontSize: 14, padding: "4px 6px", lineHeight: 1, borderRadius: 6, flexShrink: 0, transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = GOLD_BG)}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >{collapsed ? "›" : "‹"}</button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 8, paddingBottom: 8 }}>
        {groups.map(group => {
          const items = nav.filter(n => n.group === group);

          /* Collecter les sous-groupes uniques dans l'ordre */
          const subGroupsInOrder: string[] = [];
          items.forEach(item => {
            if (item.subGroup && !subGroupsInOrder.includes(item.subGroup))
              subGroupsInOrder.push(item.subGroup);
          });

          /* Items sans sous-groupe (niveau racine du groupe) */
          const rootItems = items.filter(n => !n.subGroup);

          return (
            <div key={group} style={{ marginBottom: 4 }}>
              {!collapsed && <NavLabel>{group}</NavLabel>}
              {collapsed && <div style={{ height: 8 }} />}

              {/* Items racine */}
              {rootItems.map(item => (
                <NavItemRow key={item.id} item={item} active={active} collapsed={collapsed} />
              ))}

              {/* Sous-groupes collapsibles */}
              {!collapsed && subGroupsInOrder.map(sg => {
                const sgItems = items.filter(n => n.subGroup === sg);
                const isOpen  = openSubs[sg] ?? false;
                /* Libellé affiché (retire le préfixe "Syndic·" / "Compta·") */
                const sgLabel = sg.includes("·") ? sg.split("·")[1] : sg;

                return (
                  <div key={sg}>
                    {/* En-tête sous-groupe */}
                    <div
                      onClick={() => toggleSub(sg)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 20px 5px 28px", cursor: "pointer", userSelect: "none" }}
                      onMouseEnter={e => (e.currentTarget.style.background = GOLD_BG + "60")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 9, color: LABEL_COLOR, flex: 1, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{sgLabel}</span>
                      <span style={{ fontSize: 10, color: LABEL_COLOR, transition: "transform 0.15s", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                    </div>
                    {/* Items du sous-groupe */}
                    {isOpen && sgItems.map(item => (
                      <NavItemRow key={item.id} item={item} active={active} collapsed={collapsed} indent />
                    ))}
                  </div>
                );
              })}

              {/* En mode réduit : afficher tous les items (icône seule) */}
              {collapsed && subGroupsInOrder.map(sg =>
                items.filter(n => n.subGroup === sg).map(item => (
                  <NavItemRow key={item.id} item={item} active={active} collapsed={collapsed} />
                ))
              )}
            </div>
          );
        })}

        {/* Admin */}
        {!collapsed && <NavLabel>Administration</NavLabel>}
        {collapsed && <div style={{ height: 8 }} />}
        {adminNav.map(item => <NavItemRow key={item.id} item={item as NavItem} active={active} collapsed={collapsed} />)}
      </nav>

      {/* Utilisateur */}
      {session?.user && (
        <div style={{ padding: collapsed ? "12px 0" : "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10 }}>
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" title={`${session.user.prenom ?? ""} ${session.user.nom ?? ""}`} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          ) : (
            <div title={`${session.user.prenom ?? ""} ${session.user.nom ?? ""}`}
              style={{ width: 32, height: 32, borderRadius: "50%", background: GOLD_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: GOLD, flexShrink: 0, cursor: "default" }}>
              {(session.user.prenom?.[0] ?? session.user.name?.[0] ?? "?").toUpperCase()}
              {(session.user.nom?.[0] ?? "").toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {session.user.prenom && session.user.nom ? `${session.user.prenom} ${session.user.nom}` : session.user.name}
                </div>
                <div style={{ fontSize: 10, color: LABEL_COLOR, textTransform: "capitalize" }}>{session.user.roleId ?? "Utilisateur"}</div>
              </div>
              <button onClick={() => signOut({ callbackUrl: "/login" })} title="Se déconnecter"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: LABEL_COLOR, padding: 2, lineHeight: 1 }}>→</button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: LABEL_COLOR, padding: "8px 20px 3px", fontWeight: 600 }}>
      {children}
    </div>
  );
}

function NavItemRow({ item, active, collapsed, indent }: {
  item: NavItem & { href: string };
  active: string;
  collapsed: boolean;
  indent?: boolean;
}) {
  const isActive = active === item.id;
  const pl = !collapsed && indent ? 40 : collapsed ? 0 : 20;

  return (
    <Link href={item.href} style={{ textDecoration: "none" }} title={collapsed ? item.label : undefined}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10,
          padding: collapsed ? "8px 0" : `6px 20px 6px ${pl}px`,
          cursor: "pointer", fontSize: 13,
          color: isActive ? GOLD : ITEM_COLOR,
          background: isActive ? GOLD_BG : "transparent",
          borderLeft: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
          fontWeight: isActive ? 600 : 400,
          transition: "background 0.15s, color 0.15s",
          position: "relative",
        }}
        onMouseEnter={e => !isActive && (e.currentTarget.style.background = GOLD_BG + "88")}
        onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ fontSize: collapsed ? 15 : indent ? 12 : 13, width: collapsed ? "auto" : 16, textAlign: "center", color: isActive ? GOLD : "#A09880", fontWeight: 500 }}>
          {item.icon}
        </span>
        {!collapsed && <span style={{ flex: 1, fontSize: indent ? 12 : 13 }}>{item.label}</span>}
        {!collapsed && item.badge && (
          <span style={{ background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{item.badge}</span>
        )}
        {collapsed && item.badge && (
          <span style={{ position: "absolute", top: 2, right: 6, width: 7, height: 7, borderRadius: "50%", background: GOLD, display: "block" }} />
        )}
      </div>
    </Link>
  );
}
