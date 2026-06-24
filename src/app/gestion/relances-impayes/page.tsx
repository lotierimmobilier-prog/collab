"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
const NIVEAUX = [
  { niveau: 1, label: "Relance amiable", delai: "J+8",  color: "#D97706", bg: "#FFFBEB" },
  { niveau: 2, label: "Mise en demeure", delai: "J+20", color: "#EA580C", bg: "#FFF7ED" },
  { niveau: 3, label: "Procédure",       delai: "J+30", color: "#DC2626", bg: "#FEF2F2" },
];

interface Appel { id: string; reference: string; periode: string; totalCC: number; echeance: string; bail: { reference: string; lot: { label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string; email: string | null } }[] } }

export default function RelancesImpayesPage() {
  const [appels, setAppels] = useState<Appel[]>([]);
  const [loading, setLoading] = useState(true);
  const [relances, setRelances] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/appels-loyer").then(r => r.json()).then((all: (Appel & { status: string })[]) => {
      setAppels(all.filter(a => a.status === "impaye" || (a.status === "emis" && new Date(a.echeance) < new Date())));
    }).finally(() => setLoading(false));
  }, []);

  function setNiveau(id: string, n: number) { setRelances(p => ({ ...p, [id]: n })); }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Relances impayés</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Suivi des relances par niveau</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {NIVEAUX.map(n => (
          <div key={n.niveau} style={{ background: n.bg, border: `1px solid ${n.color}44`, borderRadius: 10, padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: n.color }}>{n.label}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Délai recommandé : {n.delai}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: n.color, marginTop: 6 }}>
              {Object.values(relances).filter(v => v === n.niveau).length}
            </div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        appels.length === 0 ? (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: 40, textAlign: "center", color: "#059669", fontWeight: 600 }}>✓ Aucun impayé à relancer</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {appels.map(a => {
              const retard = Math.floor((Date.now() - new Date(a.echeance).getTime()) / 86400000);
              const tenant = a.bail.tenants[0]?.tenant;
              const niv = relances[a.id] ?? 0;
              return (
                <div key={a.id} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>{a.bail.reference} — {a.periode}</div>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>{a.bail.lot.label || a.bail.lot.address}</div>
                    {tenant && <div style={{ fontSize: 12, color: "#6b7280" }}>{tenant.prenom} {tenant.nom}{tenant.email ? ` · ${tenant.email}` : ""}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626" }}>{a.totalCC.toLocaleString("fr-FR")} €</div>
                    <div style={{ fontSize: 11, color: "#DC2626" }}>+{retard}j de retard</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {NIVEAUX.map(n => (
                      <button key={n.niveau} onClick={() => setNiveau(a.id, n.niveau)}
                        style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${niv === n.niveau ? n.color : "#E6E1D9"}`, background: niv === n.niveau ? n.bg : "#fff", color: niv === n.niveau ? n.color : "#6b7280", fontSize: 11, fontWeight: niv === n.niveau ? 700 : 400, cursor: "pointer" }}>
                        N{n.niveau}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
