"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// Palette Lotier Immobilier
const GOLD = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK = "#1C1A17";
const LABEL_COLOR = "#A09880";
const ITEM_COLOR = "#5C5449";
const BORDER = "#E6E1D9";

const nav = [
  { id: "dashboard",  label: "Tableau de bord",    icon: "⊟",  href: "/",                group: "Principal" },
  { id: "tasks",      label: "Tâches",              icon: "✓",  href: "/taches",          group: "Principal" },
  { id: "planning",   label: "Planning",            icon: "▦",  href: "/planning",        group: "Principal" },
  { id: "mail",       label: "Messagerie",          icon: "@",  href: "/messagerie",      group: "Principal", badge: 3 },
  { id: "edl",        label: "États des lieux",     icon: "⌂",  href: "/etats-des-lieux", group: "Gestion locative" },
  { id: "locataires", label: "Dossiers locataires", icon: "◎",  href: "/locataires",      group: "Gestion locative" },
  { id: "compta",     label: "Tableau de bord",     icon: "∑",  href: "/comptabilite",    group: "Comptabilité" },
  { id: "compta-enc", label: "Encaissements",       icon: "↗",  href: "/comptabilite/encaissements", group: "Comptabilité" },
  { id: "compta-dep", label: "Dépenses",            icon: "↙",  href: "/comptabilite/depenses",      group: "Comptabilité" },
  { id: "compta-tva", label: "TVA",                 icon: "%",  href: "/comptabilite/tva",           group: "Comptabilité" },
  { id: "formation",  label: "Formation",           icon: "◈",  href: "/formation",       group: "Agence" },
  { id: "reseaux",    label: "Réseaux sociaux",     icon: "⌘",  href: "/reseaux-sociaux", group: "Agence" },
];

const adminNav = [
  { id: "admin-users", label: "Utilisateurs", icon: "○", href: "/admin/utilisateurs", badge: undefined },
  { id: "admin-roles", label: "Rôles & droits", icon: "◫", href: "/admin/roles", badge: undefined },
];

const groups = ["Principal", "Gestion locative", "Comptabilité", "Agence"];

export default function Sidebar({ active }: { active: string }) {
  const { data: session } = useSession();
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "#FAFAF8",
      borderRight: `1px solid ${BORDER}`,
      display: "flex", flexDirection: "column",
    }}>
      {/* Logo Lotier */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Link href="/" style={{ textDecoration: "none", display: "block" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lotier Immobilier" style={{ width: 140, height: "auto", display: "block" }} />
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", paddingTop: 8, paddingBottom: 8 }}>
        {groups.map(group => {
          const items = nav.filter(n => n.group === group);
          return (
            <div key={group} style={{ marginBottom: 4 }}>
              <NavLabel>{group}</NavLabel>
              {items.map(item => (
                <div key={item.id}>
                  <NavItem item={item} active={active} />
                  {item.id === "locataires" && (
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

        <NavLabel>Administration</NavLabel>
        {adminNav.map(item => <NavItem key={item.id} item={item} active={active} />)}
      </nav>

      {/* Utilisateur en bas */}
      {session?.user && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: GOLD_BG,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: GOLD, flexShrink: 0,
            }}>
              {(session.user.prenom?.[0] ?? session.user.name?.[0] ?? "?").toUpperCase()}
              {(session.user.nom?.[0] ?? "").toUpperCase()}
            </div>
          )}
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

function NavItem({ item, active }: {
  item: { id: string; label: string; icon: string; href: string; badge?: number };
  active: string;
}) {
  const isActive = active === item.id;
  return (
    <Link href={item.href} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 20px", cursor: "pointer", fontSize: 13,
        color: isActive ? GOLD : ITEM_COLOR,
        background: isActive ? GOLD_BG : "transparent",
        borderLeft: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
        fontWeight: isActive ? 600 : 400,
        transition: "background 0.15s, color 0.15s",
      }}>
        <span style={{ fontSize: 13, width: 16, textAlign: "center", color: isActive ? GOLD : "#A09880", fontWeight: 500 }}>{item.icon}</span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge && (
          <span style={{ background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}
