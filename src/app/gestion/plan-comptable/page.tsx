"use client";
const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
const PLAN = [
  { compte: "411", libelle: "Locataires", classe: "4 — Tiers" },
  { compte: "412", libelle: "Dépôts de garantie", classe: "4 — Tiers" },
  { compte: "421", libelle: "Fournisseurs", classe: "4 — Tiers" },
  { compte: "512", libelle: "Banque", classe: "5 — Financiers" },
  { compte: "608", libelle: "Charges locatives", classe: "6 — Charges" },
  { compte: "614", libelle: "Charges de copropriété", classe: "6 — Charges" },
  { compte: "615", libelle: "Entretien & réparations", classe: "6 — Charges" },
  { compte: "616", libelle: "Assurances", classe: "6 — Charges" },
  { compte: "627", libelle: "Honoraires gestion", classe: "6 — Charges" },
  { compte: "706", libelle: "Loyers", classe: "7 — Produits" },
  { compte: "708", libelle: "Remboursements charges", classe: "7 — Produits" },
  { compte: "760", libelle: "Produits financiers", classe: "7 — Produits" },
];
const classes = [...new Set(PLAN.map(p => p.classe))];
export default function PlanComptablePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Plan comptable</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Comptes utilisés en gestion locative</p>
      {classes.map(classe => (
        <div key={classe} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A09880", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{classe}</div>
          <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
            {PLAN.filter(p => p.classe === classe).map((p, i, arr) => (
              <div key={p.compte} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: GOLD, width: 50, flexShrink: 0 }}>{p.compte}</span>
                <span style={{ fontSize: 13, color: "#374151" }}>{p.libelle}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
