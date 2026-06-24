"use client";
import { Facture, Transaction, Mandataire, FACTURE_STATUS, TRANSACTION_TYPE, formatEur } from "@/lib/compta";

export default function FacturesPanel({ factures, transactions, mandataires, onPayer }: {
  factures: Facture[];
  transactions: Transaction[];
  mandataires: Mandataire[];
  onPayer: (id: string) => void;
}) {
  const totalEmis = factures.filter(f => f.status !== "annulee").reduce((s, f) => s + f.commissionTTC, 0);
  const totalPaye = factures.filter(f => f.status === "payee").reduce((s, f) => s + f.commissionTTC, 0);
  const totalAttente = factures.filter(f => f.status === "emise").reduce((s, f) => s + f.commissionTTC, 0);

  const mandataireOf = (id: string) => mandataires.find(m => m.id === id);
  const transactionOf = (id: string) => transactions.find(t => t.id === id);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <KPI label="Total commissions émises TTC" value={formatEur(totalEmis)} color="#7c3aed" />
        <KPI label="Commissions payées TTC" value={formatEur(totalPaye)} color="#059669" />
        <KPI label="En attente de paiement TTC" value={formatEur(totalAttente)} color="#f59e0b" />
      </div>

      {factures.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "50px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Aucune facture</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Les factures mandataires sont générées depuis l'onglet Transactions</div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1.5fr 1.2fr 80px 100px 100px 90px 90px 100px", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", gap: 10, borderBottom: "1px solid #f3f4f6" }}>
            <span>N° Facture</span><span>Mandataire</span><span>Transaction</span><span>Taux</span>
            <span>Hon. HT</span><span>Commission HT</span><span>TVA</span><span>TTC</span><span>Statut</span>
          </div>
          {factures.map((f, i) => {
            const m = mandataireOf(f.mandataireId);
            const t = transactionOf(f.transactionId);
            const s = FACTURE_STATUS[f.status];
            return (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "110px 1.5fr 1.2fr 80px 100px 100px 90px 90px 100px", padding: "11px 16px", gap: 10, alignItems: "center", borderBottom: i < factures.length - 1 ? "1px solid #f9fafb" : "none" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", fontFamily: "monospace" }}>{f.numero}</span>
                <div>
                  {m ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{m.prenom} {m.nom}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{m.siret ? `SIRET ${m.siret}` : "SIRET non renseigné"}</div>
                    </>
                  ) : <span style={{ color: "#9ca3af" }}>—</span>}
                </div>
                <div>
                  {t ? (
                    <>
                      <div style={{ fontSize: 12, color: "#374151" }}>{t.bien}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{t ? TRANSACTION_TYPE[t.type].label : ""}</div>
                    </>
                  ) : <span style={{ color: "#9ca3af" }}>—</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>{f.tauxCommission}%</span>
                <span style={{ fontSize: 12, color: "#374151" }}>{formatEur(f.honorairesAgenceHT)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>{formatEur(f.commissionHT)}</span>
                <span style={{ fontSize: 12, color: "#f59e0b" }}>{formatEur(f.tva)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{formatEur(f.commissionTTC)}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ background: s.bg, color: s.text, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, textAlign: "center" }}>{s.label}</span>
                  {f.status === "emise" && (
                    <button onClick={() => onPayer(f.id)} style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                      ✓ Marquer payée
                    </button>
                  )}
                  {f.datePaiement && <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center" }}>Payée le {f.datePaiement}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
