"use client";
import { useState } from "react";
import {
  Mandataire, Transaction, Encaissement, Facture,
  formatEur, calcCommission, genNumeroFacture,
  FACTURE_STATUS, TRANSACTION_TYPE, ENCAISSEMENT_LABELS,
} from "@/lib/compta";
import MandatairesPanel from "./MandatairesPanel";
import TransactionsPanel from "./TransactionsPanel";
import EncaissementsPanel from "./EncaissementsPanel";
import FacturesPanel from "./FacturesPanel";

type Tab = "dashboard" | "transactions" | "encaissements" | "factures" | "mandataires";

export default function ComptaBoard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mandataires, setMandataires] = useState<Mandataire[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [encaissements, setEncaissements] = useState<Encaissement[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);

  function addTransaction(t: Transaction) { setTransactions(p => [t, ...p]); }
  function addEncaissement(e: Encaissement) {
    setEncaissements(p => [e, ...p]);
    if (e.transactionId) {
      setTransactions(p => p.map(t => t.id === e.transactionId ? { ...t, encaisse: true, encaissementId: e.id } : t));
    }
  }
  function addMandataire(m: Mandataire) { setMandataires(p => [m, ...p]); }
  function updateMandataire(m: Mandataire) { setMandataires(p => p.map(x => x.id === m.id ? m : x)); }

  function emettreFacture(transactionId: string) {
    const t = transactions.find(x => x.id === transactionId);
    if (!t || !t.mandataireId) return;
    const m = mandataires.find(x => x.id === t.mandataireId);
    if (!m) return;
    const honoraires = t.type === "vente" ? (t.honorairesAgenceHT ?? 0) : (t.honorairesLocationHT ?? 0);
    const { commissionHT, tva, commissionTTC } = calcCommission(honoraires, m.tauxCommission);
    const facture: Facture = {
      id: Date.now().toString(),
      numero: genNumeroFacture(factures),
      transactionId,
      mandataireId: t.mandataireId,
      honorairesAgenceHT: honoraires,
      tauxCommission: m.tauxCommission,
      commissionHT,
      tva,
      commissionTTC,
      status: "emise",
      dateEmission: new Date().toLocaleDateString("fr-FR"),
    };
    setFactures(p => [facture, ...p]);
    setTransactions(p => p.map(x => x.id === transactionId ? { ...x, factureId: facture.id } : x));
  }

  function payerFacture(id: string) {
    setFactures(p => p.map(f => f.id === id ? { ...f, status: "payee", datePaiement: new Date().toLocaleDateString("fr-FR") } : f));
  }

  // KPIs
  const totalEnc = encaissements.reduce((s, e) => s + e.montantHT, 0);
  const totalComm = factures.filter(f => f.status !== "annulee").reduce((s, f) => s + f.commissionHT, 0);
  const netAgence = totalEnc - totalComm;
  const facturesEnAttente = factures.filter(f => f.status === "emise").length;
  const transVente = transactions.filter(t => t.type === "vente").length;
  const transLoc = transactions.filter(t => t.type === "location").length;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard",      label: "Vue globale",      icon: "📊" },
    { id: "transactions",   label: "Transactions",     icon: "🏡" },
    { id: "encaissements",  label: "Encaissements",    icon: "💰" },
    { id: "factures",       label: "Factures mandataires", icon: "📄" },
    { id: "mandataires",    label: "Mandataires",      icon: "👤" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Sub-tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "12px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
            color: tab === t.id ? "#7c3aed" : "#6b7280",
            fontWeight: tab === t.id ? 600 : 400,
            borderBottom: tab === t.id ? "2px solid #7c3aed" : "2px solid transparent",
          }}>
            <span>{t.icon}</span> {t.label}
            {t.id === "factures" && facturesEnAttente > 0 && (
              <span style={{ background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>{facturesEnAttente}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label="Honoraires HT encaissés" value={formatEur(totalEnc)} icon="💰" color="#059669" />
              <KPI label="Commissions mandataires HT" value={formatEur(totalComm)} icon="👤" color="#7c3aed" />
              <KPI label="Net agence HT" value={formatEur(netAgence)} icon="🏦" color="#0891b2" />
              <KPI label="Factures en attente" value={String(facturesEnAttente)} icon="📄" color="#f59e0b" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Répartition transactions */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 14 }}>Transactions</div>
                {transactions.length === 0 ? (
                  <Empty msg="Aucune transaction enregistrée" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <TypeRow icon="🏡" label="Ventes" count={transVente} color="#7c3aed"
                      montant={transactions.filter(t => t.type === "vente").reduce((s, t) => s + (t.honorairesAgenceHT ?? 0), 0)} />
                    <TypeRow icon="🔑" label="Mises en location" count={transLoc} color="#0891b2"
                      montant={transactions.filter(t => t.type === "location").reduce((s, t) => s + (t.honorairesLocationHT ?? 0), 0)} />
                  </div>
                )}
              </div>

              {/* Mandataires top */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 14 }}>Commissions par mandataire</div>
                {mandataires.length === 0 ? (
                  <Empty msg="Aucun mandataire enregistré" />
                ) : mandataires.map(m => {
                  const comm = factures.filter(f => f.mandataireId === m.id && f.status !== "annulee").reduce((s, f) => s + f.commissionHT, 0);
                  const nb = factures.filter(f => f.mandataireId === m.id).length;
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Avatar prenom={m.prenom} nom={m.nom} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{m.prenom} {m.nom}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{nb} facture(s) · {m.tauxCommission}%</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>{formatEur(comm)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Derniers encaissements */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 14 }}>Derniers encaissements</div>
              {encaissements.length === 0 ? <Empty msg="Aucun encaissement enregistré" /> : (
                encaissements.slice(0, 5).map((e, i) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 4 ? "1px solid #f3f4f6" : "none" }}>
                    <span style={{ fontSize: 16 }}>💰</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.libelle}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{ENCAISSEMENT_LABELS[e.type]} · {e.date}</div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#059669" }}>+{formatEur(e.montantTTC)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "transactions" && (
          <TransactionsPanel
            transactions={transactions}
            mandataires={mandataires}
            onAdd={addTransaction}
            onEmettreFacture={emettreFacture}
          />
        )}

        {tab === "encaissements" && (
          <EncaissementsPanel
            encaissements={encaissements}
            transactions={transactions}
            onAdd={addEncaissement}
          />
        )}

        {tab === "factures" && (
          <FacturesPanel
            factures={factures}
            transactions={transactions}
            mandataires={mandataires}
            onPayer={payerFacture}
          />
        )}

        {tab === "mandataires" && (
          <MandatairesPanel
            mandataires={mandataires}
            factures={factures}
            onAdd={addMandataire}
            onUpdate={updateMandataire}
          />
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function TypeRow({ icon, label, count, montant, color }: { icon: string; label: string; count: number; montant: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f9fafb", borderRadius: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>{count} dossier(s)</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{formatEur(montant)}</span>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "#d1d5db" }}>{msg}</div>;
}

function Avatar({ prenom, nom }: { prenom: string; nom: string }) {
  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#7c3aed", flexShrink: 0 }}>
      {initials}
    </div>
  );
}
