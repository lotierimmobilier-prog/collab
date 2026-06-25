"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const GOLD        = "#B8966A";
const GOLD_BG     = "#F7F0E6";
const DARK        = "#1C1A17";
const LABEL_COLOR = "#A09880";
const ITEM_COLOR  = "#5C5449";
const BORDER      = "#E6E1D9";

const COLLAPSED_W = 52;
const EXPANDED_W  = 230;

interface NavItem {
  id: string; label: string; icon: string; href: string;
  group: string; subGroup?: string; indent?: boolean; badge?: number;
}

const nav: NavItem[] = [
  { id: "dashboard", label: "Tableau de bord",     icon: "⊟",  href: "/",                   group: "Principal" },
  { id: "tasks",     label: "Tâches",               icon: "✓",  href: "/taches",             group: "Principal" },
  { id: "planning",  label: "Planning",             icon: "▦",  href: "/planning",           group: "Principal" },
  { id: "mail",      label: "Messagerie email",     icon: "@",  href: "/messagerie",         group: "Principal", badge: 3 },
  { id: "chat",      label: "Messages internes",    icon: "💬", href: "/messagerie-interne", group: "Principal" },
  { id: "appels",    label: "Appels téléphoniques", icon: "📞", href: "/appels",             group: "Principal" },
  { id: "annuaire",  label: "Annuaire",             icon: "▤",  href: "/annuaire",           group: "Principal" },
  { id: "gestion",   label: "Gestion locative",     icon: "🏠", href: "/gestion",            group: "Gestion" },
  { id: "formation", label: "Formation",            icon: "◈",  href: "/formation",          group: "Agence" },
  { id: "reseaux",   label: "Réseaux sociaux",      icon: "⌘",  href: "/reseaux-sociaux",   group: "Agence" },
];

const directionNav = [
  { id: "direction", label: "Gestion d'entreprise", icon: "🏛", href: "/direction" },
  { id: "comptabilite", label: "Comptabilité", icon: "💶", href: "/comptabilite/banque" },
  { id: "ics", label: "Connecteur ICS", icon: "⇄", href: "/ics" },
];

const adminNav = [
  { id: "admin-users",     label: "Utilisateurs",   icon: "○", href: "/admin/utilisateurs" },
  { id: "admin-roles",     label: "Rôles & droits", icon: "◫", href: "/admin/roles" },
  { id: "admin-perf",      label: "Performances",   icon: "🏆", href: "/admin/performance" },
  { id: "admin-settings",  label: "Paramètres",     icon: "⚙", href: "/admin/parametres" },
  { id: "admin-knowledge", label: "Base Auguste",   icon: "✦", href: "/admin/knowledge" },
  { id: "admin-auguste-logs", label: "Historique Auguste", icon: "🕘", href: "/admin/auguste-historique" },
];

const groups = ["Principal", "Gestion", "Agence"];

/* 6 raccourcis bottom nav mobile */
const MOBILE_NAV = [
  { id: "dashboard", label: "Accueil",    icon: "⊟",  href: "/" },
  { id: "tasks",     label: "Tâches",     icon: "✓",  href: "/taches" },
  { id: "mail",      label: "Mails",      icon: "@",  href: "/messagerie" },
  { id: "planning",  label: "Planning",   icon: "▦",  href: "/planning" },
  { id: "gestion",   label: "Gestion",    icon: "🏠", href: "/gestion" },
];

export default function Sidebar({ active }: { active: string }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";
  const isDirection = ["admin", "direction", "dirigeant"].includes(session?.user?.roleId ?? "");
  const bp = useBreakpoint();
  const [collapsed, setCollapsed]   = useState(false);
  const [mounted, setMounted]       = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (bp === "tablet") { setCollapsed(true); return; }
    const stored = localStorage.getItem("sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, [bp]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  }

  /* ── MOBILE : bottom nav ───────────────────────────────────── */
  if (bp === "mobile") {
    return (
      <>
        {/* Overlay menu mobile */}
        {mobileOpen && (
          <>
            <div onClick={() => setMobileOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }} />
            <div style={{
              position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 201,
              background: "#fff", borderRadius: "20px 20px 0 0",
              borderTop: `1px solid ${BORDER}`, boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
              maxHeight: "70vh", overflowY: "auto", paddingBottom: 8,
            }}>
              {/* Header overlay */}
              <div style={{ padding: "14px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${BORDER}` }}>
                <img src="/logo.png" alt="Lotier" style={{ height: 28, width: "auto" }} />
                <button onClick={() => setMobileOpen(false)}
                  style={{ background: "none", border: "none", fontSize: 22, color: LABEL_COLOR, cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>

              {/* Nav items */}
              {groups.map(group => (
                <div key={group}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: LABEL_COLOR, padding: "10px 20px 4px", fontWeight: 600 }}>{group}</div>
                  {nav.filter(n => n.group === group).map(item => (
                    <MobileMenuItem key={item.id} item={item} active={active} onClose={() => setMobileOpen(false)} />
                  ))}
                </div>
              ))}

              {isDirection && (
                <>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: LABEL_COLOR, padding: "10px 20px 4px", fontWeight: 600 }}>Direction</div>
                  {directionNav.map(item => (
                    <MobileMenuItem key={item.id} item={item as NavItem} active={active} onClose={() => setMobileOpen(false)} />
                  ))}
                </>
              )}

              {isAdmin && (
                <>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: LABEL_COLOR, padding: "10px 20px 4px", fontWeight: 600 }}>Administration</div>
                  {adminNav.map(item => (
                    <MobileMenuItem key={item.id} item={item as NavItem} active={active} onClose={() => setMobileOpen(false)} />
                  ))}
                </>
              )}

              {/* Déconnexion */}
              {session?.user && (
                <div style={{ borderTop: `1px solid ${BORDER}`, margin: "8px 0 0", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: GOLD_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: GOLD }}>
                    {(session.user.prenom?.[0] ?? "?").toUpperCase()}{(session.user.nom?.[0] ?? "").toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{session.user.prenom} {session.user.nom}</div>
                    <div style={{ fontSize: 11, color: LABEL_COLOR }}>{session.user.roleId ?? "Utilisateur"}</div>
                  </div>
                  <button onClick={() => signOut({ callbackUrl: "/login" })}
                    style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>
                    Déco
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Bottom navigation bar */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: "#fff", borderTop: `1px solid ${BORDER}`,
          display: "flex", alignItems: "stretch",
          height: 64, boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        }}>
          {MOBILE_NAV.map(item => {
            const isActive = active === item.id;
            return (
              <Link key={item.id} href={item.href} style={{ flex: 1, textDecoration: "none" }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  height: "100%", gap: 3,
                  color: isActive ? GOLD : LABEL_COLOR,
                  borderTop: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                  background: isActive ? GOLD_BG : "transparent",
                  transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, letterSpacing: "0.02em" }}>{item.label}</span>
                </div>
              </Link>
            );
          })}
          {/* Bouton "Plus" */}
          <button onClick={() => setMobileOpen(true)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 3, color: LABEL_COLOR, borderTop: "2px solid transparent",
          }}>
            <span style={{ fontSize: 18 }}>☰</span>
            <span style={{ fontSize: 9, fontWeight: 500 }}>Plus</span>
          </button>
        </nav>
      </>
    );
  }

  /* ── TABLET / DESKTOP : sidebar classique ──────────────────── */
  const forceCollapsed = bp === "tablet";
  const isCollapsed    = forceCollapsed || (mounted && collapsed);
  const w              = isCollapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    <aside style={{
      width: w, flexShrink: 0,
      background: "#fff", borderRight: `1px solid ${BORDER}`,
      display: "flex", flexDirection: "column",
      transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden", position: "relative",
    }}>
      {/* Logo + toggle */}
      <div style={{ padding: isCollapsed ? "14px 0" : "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", gap: 8, minHeight: 64 }}>
        {!isCollapsed && (
          <Link href="/" style={{ textDecoration: "none", display: "block", flex: 1, minWidth: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Lotier Immobilier" style={{ width: 130, height: "auto", display: "block" }} />
          </Link>
        )}
        {isCollapsed && (
          <Link href="/" style={{ textDecoration: "none" }} title="Accueil">
            <span style={{ fontSize: 18, color: GOLD }}>⊟</span>
          </Link>
        )}
        {!forceCollapsed && (
          <button onClick={toggle} title={isCollapsed ? "Agrandir" : "Réduire"}
            style={{ background: "none", border: "none", cursor: "pointer", color: LABEL_COLOR, fontSize: 14, padding: "4px 6px", lineHeight: 1, borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = GOLD_BG)}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >{isCollapsed ? "›" : "‹"}</button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 8, paddingBottom: 8 }}>
        {groups.map(group => {
          const items = nav.filter(n => n.group === group);
          return (
            <div key={group} style={{ marginBottom: 4 }}>
              {!isCollapsed && <NavLabel>{group}</NavLabel>}
              {isCollapsed && <div style={{ height: 8 }} />}
              {items.map(item => (
                <NavItemRow key={item.id} item={item} active={active} collapsed={isCollapsed} />
              ))}
            </div>
          );
        })}

        {isDirection && (
          <>
            {!isCollapsed && <NavLabel>Direction</NavLabel>}
            {isCollapsed && <div style={{ height: 8 }} />}
            {directionNav.map(item => <NavItemRow key={item.id} item={item as NavItem} active={active} collapsed={isCollapsed} />)}
          </>
        )}

        {isAdmin && (
          <>
            {!isCollapsed && <NavLabel>Administration</NavLabel>}
            {isCollapsed && <div style={{ height: 8 }} />}
            {adminNav.map(item => <NavItemRow key={item.id} item={item as NavItem} active={active} collapsed={isCollapsed} />)}
          </>
        )}
      </nav>

      {/* Utilisateur */}
      {session?.user && (
        <div style={{ padding: isCollapsed ? "12px 0" : "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: 10 }}>
          <div title={`${session.user.prenom ?? ""} ${session.user.nom ?? ""}`}
            style={{ width: 32, height: 32, borderRadius: "50%", background: GOLD_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: GOLD, flexShrink: 0 }}>
            {(session.user.prenom?.[0] ?? session.user.name?.[0] ?? "?").toUpperCase()}
            {(session.user.nom?.[0] ?? "").toUpperCase()}
          </div>
          {!isCollapsed && (
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

function MobileMenuItem({ item, active, onClose }: { item: NavItem; active: string; onClose: () => void }) {
  const isActive = active === item.id;
  return (
    <Link href={item.href} style={{ textDecoration: "none" }} onClick={onClose}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "11px 20px",
        color: isActive ? GOLD : ITEM_COLOR,
        background: isActive ? GOLD_BG : "transparent",
        borderLeft: isActive ? `3px solid ${GOLD}` : "3px solid transparent",
        fontWeight: isActive ? 600 : 400,
      }}>
        <span style={{ fontSize: 17, width: 22, textAlign: "center" }}>{item.icon}</span>
        <span style={{ fontSize: 14 }}>{item.label}</span>
        {item.badge && (
          <span style={{ marginLeft: "auto", background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{item.badge}</span>
        )}
      </div>
    </Link>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: LABEL_COLOR, padding: "8px 20px 3px", fontWeight: 600 }}>
      {children}
    </div>
  );
}

function NavItemRow({ item, active, collapsed, indent }: { item: NavItem; active: string; collapsed: boolean; indent?: boolean }) {
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
        <span style={{ fontSize: collapsed ? 15 : indent ? 12 : 13, width: collapsed ? "auto" : 16, textAlign: "center", color: isActive ? GOLD : "#A09880" }}>
          {item.icon}
        </span>
        {!collapsed && <span style={{ flex: 1, fontSize: indent ? 12 : 13 }}>{item.label}</span>}
        {!collapsed && item.badge && (
          <span style={{ background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{item.badge}</span>
        )}
        {collapsed && item.badge && (
          <span style={{ position: "absolute", top: 2, right: 6, width: 7, height: 7, borderRadius: "50%", background: GOLD }} />
        )}
      </div>
    </Link>
  );
}
