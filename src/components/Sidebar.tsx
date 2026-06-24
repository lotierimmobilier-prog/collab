"use client";
import Link from "next/link";

const nav = [
  { id: "dashboard",  label: "Tableau de bord",    icon: "⊞", href: "/",              group: "Principal" },
  { id: "tasks",      label: "Tâches",              icon: "☑", href: "/taches",        group: "Principal" },
  { id: "planning",   label: "Planning",            icon: "📅", href: "/planning",      group: "Principal" },
  { id: "mail",       label: "Messagerie",          icon: "✉", href: "/messagerie",    group: "Principal", badge: 3 },
  { id: "edl",        label: "États des lieux",     icon: "🏠", href: "/etats-des-lieux", group: "Gestion locative" },
  { id: "locataires", label: "Dossiers locataires", icon: "👥", href: "/locataires",   group: "Gestion locative" },
  { id: "compta",     label: "Tableau de bord",     icon: "📊", href: "/comptabilite", group: "Comptabilité" },
  { id: "compta-enc", label: "Encaissements",       icon: "💰", href: "/comptabilite/encaissements", group: "Comptabilité" },
  { id: "compta-dep", label: "Dépenses",            icon: "📤", href: "/comptabilite/depenses",      group: "Comptabilité" },
  { id: "compta-tva", label: "TVA",                 icon: "🧾", href: "/comptabilite/tva",           group: "Comptabilité" },
  { id: "formation",  label: "Formation",           icon: "🎓", href: "/formation",    group: "Agence" },
  { id: "reseaux",    label: "Réseaux sociaux",     icon: "📱", href: "/reseaux-sociaux", group: "Agence" },
];

const adminNav = [
  { id: "admin-users", label: "Utilisateurs", icon: "👤", href: "/admin/utilisateurs" },
  { id: "admin-roles", label: "Rôles & droits", icon: "🔐", href: "/admin/roles" },
];

const groups = ["Principal", "Gestion locative", "Comptabilité", "Agence"];

export default function Sidebar({ active }: { active: string }) {
  return (
    <aside style={{
      width: 216, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e7eb",
      display: "flex", flexDirection: "column", padding: "0 0 12px",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #e5e7eb" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>
            Collab<span style={{ color: "#7c3aed" }}>.</span>
          </span>
        </Link>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", paddingTop: 6 }}>
        {groups.map(group => {
          const items = nav.filter(n => n.group === group);
          return (
            <div key={group}>
              <NavLabel>{group}</NavLabel>
              {items.map(item => (
                <div key={item.id}>
                  <NavItem item={item} active={active} />
                  {/* Lien candidature sous "Dossiers locataires" */}
                  {item.id === "locataires" && (
                    <Link href="/candidature" style={{ textDecoration: "none" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 20px 7px 46px", fontSize: 12,
                        color: active === "candidature" ? "#7c3aed" : "#9ca3af",
                        background: active === "candidature" ? "#f5f3ff" : "transparent",
                        borderLeft: active === "candidature" ? "2px solid #7c3aed" : "2px solid transparent",
                      }}>
                        <span>🔗</span>
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
    </aside>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em",
      color: "#9ca3af", padding: "10px 20px 4px", fontWeight: 600,
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
        padding: "8px 20px", cursor: "pointer", fontSize: 13,
        color: isActive ? "#7c3aed" : "#6b7280",
        background: isActive ? "#f5f3ff" : "transparent",
        borderLeft: isActive ? "2px solid #7c3aed" : "2px solid transparent",
        fontWeight: isActive ? 500 : 400,
      }}>
        <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>{item.icon}</span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge && (
          <span style={{ background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}
