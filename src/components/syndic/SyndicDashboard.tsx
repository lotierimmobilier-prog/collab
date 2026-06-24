"use client";

const GOLD = "#B8966A";
const BLUE = "#2563eb";

const MODULES = [
  { icon: "🏢", label: "Copropriétés",        desc: "Immeubles gérés",           href: "/syndic/coproprietees", color: BLUE,     count: 0, sub: "immeubles" },
  { icon: "◉",  label: "Assemblées générales", desc: "Convocations & PV",          href: "/syndic/assemblees",    color: "#d97706", count: 0, sub: "à planifier" },
  { icon: "∑",  label: "Charges",              desc: "Appels de fonds & répart.", href: "/syndic/charges",       color: "#dc2626", count: 0, sub: "en attente" },
  { icon: "🔧", label: "Travaux",              desc: "Chantiers & ODS",            href: "/syndic/travaux",       color: "#059669", count: 0, sub: "en cours" },
];

export default function SyndicDashboard() {
  return (
    <div style={{ padding: 28 }}>
      {/* Banner */}
      <div style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1d4ed8 100%)`, borderRadius: 16, padding: "24px 28px", color: "#fff", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Syndic de copropriété</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Gestion des immeubles, assemblées générales, charges et travaux</div>
        </div>
        <div style={{ fontSize: 52, opacity: 0.2 }}>🏢</div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Copropriétés", value: "—", icon: "🏢", color: BLUE, href: "/syndic/coproprietees" },
          { label: "Assemblées", value: "—", icon: "◉", color: "#d97706", href: "/syndic/assemblees" },
          { label: "Appels de charges", value: "—", icon: "∑", color: "#dc2626", href: "/syndic/charges" },
          { label: "Travaux en cours", value: "—", icon: "🔧", color: "#059669", href: "/syndic/travaux" },
        ].map(k => (
          <a key={k.label} href={k.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: k.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{k.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{k.value}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>{k.label}</div>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Modules */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {MODULES.map(m => (
          <a key={m.label} href={m.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 22px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14, transition: "box-shadow 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: m.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#111827", marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{m.desc}</div>
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, background: m.color + "12", color: m.color, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                  Accéder →
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Message module en construction */}
      <div style={{ marginTop: 24, background: "#f9fafb", border: "1px dashed #e5e7eb", borderRadius: 12, padding: "18px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
        Module Syndic en cours de construction · Les fonctionnalités complètes seront disponibles prochainement
      </div>
    </div>
  );
}
