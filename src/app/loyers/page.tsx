"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";
const GOLD_BG = "#F7F0E6";
const BORDER = "#e5e7eb";

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const MONTHS_FULL = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

interface Tenant { prenom: string; nom: string; email?: string; phone?: string; }
interface BailTenant { tenant: Tenant; }
interface Lot { address: string; label?: string; reference: string; }
interface Bail {
  id: string; reference: string; monthlyRent: number; charges: number;
  startDate: string; endDate?: string; status: string; deposit?: number;
  lot?: Lot; tenants?: BailTenant[];
}

type PayStatus = "paid" | "late" | "partial" | "pending";

const PAY_STYLES: Record<PayStatus, { label: string; bg: string; color: string; icon: string }> = {
  paid:    { label: "Encaissé",  bg: "#d1fae5", color: "#059669", icon: "✓" },
  late:    { label: "Impayé",    bg: "#fee2e2", color: "#dc2626", icon: "⚠" },
  partial: { label: "Partiel",   bg: "#fef3c7", color: "#d97706", icon: "≈" },
  pending: { label: "En attente",bg: "#f3f4f6", color: "#9ca3af", icon: "·" },
};

function storageKey(bailId: string, year: number, month: number) {
  return `loyer_${bailId}_${year}_${month}`;
}
function getPayStatus(bailId: string, year: number, month: number): PayStatus {
  if (typeof window === "undefined") return "pending";
  return (localStorage.getItem(storageKey(bailId, year, month)) as PayStatus) ?? "pending";
}
function setPayStatus(bailId: string, year: number, month: number, status: PayStatus) {
  localStorage.setItem(storageKey(bailId, year, month), status);
}

export default function LoyersPage() {
  const [baux, setBaux] = useState<Bail[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear]   = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [payMap, setPayMap] = useState<Record<string, PayStatus>>({});
  const [view, setView]   = useState<"month" | "year">("month");
  const [quittance, setQuittance] = useState<Bail | null>(null);

  /* Charger les baux actifs */
  useEffect(() => {
    fetch("/api/baux")
      .then(r => r.json())
      .then((data: Bail[]) => {
        setBaux(data.filter(b => b.status === "active" || b.status === "pending"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* Rafraîchir le payMap depuis localStorage */
  const refreshPayMap = useCallback(() => {
    const map: Record<string, PayStatus> = {};
    baux.forEach(b => {
      for (let m = 0; m < 12; m++) {
        map[`${b.id}_${year}_${m}`] = getPayStatus(b.id, year, m);
      }
    });
    setPayMap(map);
  }, [baux, year]);

  useEffect(() => { refreshPayMap(); }, [refreshPayMap]);

  function togglePay(bail: Bail, y: number, m: number) {
    const current = getPayStatus(bail.id, y, m);
    const cycle: PayStatus[] = ["pending", "paid", "late", "partial"];
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    setPayStatus(bail.id, y, m, next);
    setPayMap(prev => ({ ...prev, [`${bail.id}_${y}_${m}`]: next }));
  }

  const getStatus = (bailId: string, y: number, m: number): PayStatus =>
    payMap[`${bailId}_${y}_${m}`] ?? "pending";

  /* Stats du mois affiché */
  const activeBaux = baux.filter(b => b.status === "active");
  const totalDu    = activeBaux.reduce((s, b) => s + b.monthlyRent + b.charges, 0);
  const totalEnc   = activeBaux.filter(b => getStatus(b.id, year, month) === "paid")
                               .reduce((s, b) => s + b.monthlyRent + b.charges, 0);
  const nbImpayes  = activeBaux.filter(b => getStatus(b.id, year, month) === "late").length;
  const nbEnAttente= activeBaux.filter(b => getStatus(b.id, year, month) === "pending").length;

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  function printQuittance(bail: Bail) {
    const tenant = bail.tenants?.[0]?.tenant;
    const periode = `${MONTHS_FULL[month]} ${year}`;
    const total = bail.monthlyRent + bail.charges;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quittance ${periode}</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#111}
h1{font-size:20px;border-bottom:2px solid #B8966A;padding-bottom:8px;color:#B8966A}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0}
.bold{font-weight:bold}.total{font-size:18px;font-weight:bold;color:#059669}
.sig{margin-top:60px;display:flex;justify-content:space-between}
</style></head><body>
<h1>Quittance de loyer</h1>
<p><b>Période :</b> ${periode}</p>
<div class="row"><span>Propriétaire / Gestionnaire</span><span class="bold">Lotier Immobilier</span></div>
<div class="row"><span>Locataire</span><span class="bold">${tenant ? `${tenant.prenom} ${tenant.nom}` : "—"}</span></div>
<div class="row"><span>Bien</span><span class="bold">${bail.lot?.label || bail.lot?.address || "—"}</span></div>
<div class="row"><span>Loyer hors charges</span><span>${bail.monthlyRent.toLocaleString("fr-FR")} €</span></div>
<div class="row"><span>Charges</span><span>${bail.charges.toLocaleString("fr-FR")} €</span></div>
<div class="row"><span class="bold">Total encaissé</span><span class="total">${total.toLocaleString("fr-FR")} €</span></div>
<p style="margin-top:24px;font-size:13px;color:#666">Je soussigné(e), Lotier Immobilier, donne quittance à ${tenant ? `${tenant.prenom} ${tenant.nom}` : "le locataire"} pour le paiement de la somme de <b>${total.toLocaleString("fr-FR")} €</b> correspondant au loyer et aux charges du mois de <b>${periode}</b>.</p>
<div class="sig"><div><p>Le gestionnaire</p><p style="margin-top:40px">___________________</p></div><div><p>Date : ${new Date().toLocaleDateString("fr-FR")}</p></div></div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="loyers" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>💶 Loyers & Quittances</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>{activeBaux.length} baux actifs</p>
          </div>

          {/* Nav mois */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={prevMonth} style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14, color: "#6b7280" }}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", minWidth: 130, textAlign: "center" }}>
              {MONTHS_FULL[month]} {year}
            </span>
            <button onClick={nextMonth} style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14, color: "#6b7280" }}>›</button>
          </div>

          {/* Vue */}
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 3 }}>
            {(["month", "year"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ background: view === v ? "#fff" : "transparent", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: view === v ? 600 : 400, color: view === v ? "#111827" : "#6b7280", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {v === "month" ? "Mensuel" : "Annuel"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {[
                  { label: "Total dû", value: `${totalDu.toLocaleString("fr-FR")} €`, color: "#111827", icon: "📊" },
                  { label: "Encaissé", value: `${totalEnc.toLocaleString("fr-FR")} €`, color: "#059669", icon: "✓" },
                  { label: "Reste à encaisser", value: `${(totalDu - totalEnc).toLocaleString("fr-FR")} €`, color: totalDu - totalEnc > 0 ? "#d97706" : "#059669", icon: "⏳" },
                  { label: "Impayés", value: nbImpayes, color: nbImpayes > 0 ? "#dc2626" : "#9ca3af", icon: "⚠" },
                  { label: "En attente", value: nbEnAttente, color: "#9ca3af", icon: "·" },
                ].map((k, i) => (
                  <div key={i} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Vue mensuelle */}
              {view === "month" && (
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: "#374151" }}>
                    Loyers de {MONTHS_FULL[month]} {year}
                  </div>
                  {baux.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Aucun bail actif</div>
                  ) : (
                    baux.map(bail => {
                      const st = getStatus(bail.id, year, month);
                      const style = PAY_STYLES[st];
                      const total = bail.monthlyRent + bail.charges;
                      const tenant = bail.tenants?.[0]?.tenant;
                      return (
                        <div key={bail.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", borderBottom: `1px solid #f9fafb` }}>
                          {/* Statut cliquable */}
                          <button onClick={() => togglePay(bail, year, month)} title="Cliquer pour changer le statut"
                            style={{ background: style.bg, color: style.color, border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, minWidth: 90 }}>
                            {style.icon} {style.label}
                          </button>
                          {/* Infos */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {bail.lot?.label || bail.lot?.address || bail.reference}
                            </div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              {tenant ? `${tenant.prenom} ${tenant.nom}` : "Locataire non défini"}
                              {tenant?.phone && <span style={{ marginLeft: 8, color: "#9ca3af" }}>{tenant.phone}</span>}
                            </div>
                          </div>
                          {/* Montant */}
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{total.toLocaleString("fr-FR")} €</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{bail.monthlyRent.toLocaleString("fr-FR")} + {bail.charges.toLocaleString("fr-FR")} charges</div>
                          </div>
                          {/* Quittance */}
                          <button onClick={() => printQuittance(bail)} title="Imprimer la quittance"
                            style={{ background: st === "paid" ? GOLD_BG : "#f3f4f6", color: st === "paid" ? GOLD : "#9ca3af", border: `1px solid ${st === "paid" ? GOLD + "40" : BORDER}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
                            🖨 Quittance
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Vue annuelle — grille mois × bail */}
              {view === "year" && (
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "auto" }}>
                  <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: "#374151" }}>
                    Suivi annuel {year}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ padding: "8px 16px", textAlign: "left", borderBottom: `1px solid ${BORDER}`, fontWeight: 600, color: "#374151", minWidth: 180 }}>Bien / Locataire</th>
                        <th style={{ padding: "8px 4px", textAlign: "center", borderBottom: `1px solid ${BORDER}`, fontWeight: 600, color: "#374151", minWidth: 60 }}>Loyer</th>
                        {MONTHS.map((m, i) => (
                          <th key={i} style={{ padding: "8px 4px", textAlign: "center", borderBottom: `1px solid ${BORDER}`, fontWeight: i === month ? 700 : 600, color: i === month ? GOLD : "#374151", background: i === month ? GOLD_BG : "transparent", minWidth: 40 }}>{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {baux.map(bail => {
                        const tenant = bail.tenants?.[0]?.tenant;
                        const totalLoyer = bail.monthlyRent + bail.charges;
                        return (
                          <tr key={bail.id} style={{ borderBottom: `1px solid #f3f4f6` }}>
                            <td style={{ padding: "8px 16px" }}>
                              <div style={{ fontWeight: 600, color: "#111827" }}>{bail.lot?.label || bail.lot?.address || bail.reference}</div>
                              <div style={{ color: "#9ca3af", fontSize: 10 }}>{tenant ? `${tenant.prenom} ${tenant.nom}` : "—"}</div>
                            </td>
                            <td style={{ padding: "8px 4px", textAlign: "center", fontWeight: 700, color: "#111827" }}>{totalLoyer.toLocaleString("fr-FR")} €</td>
                            {MONTHS.map((_, i) => {
                              const st = getStatus(bail.id, year, i);
                              const s = PAY_STYLES[st];
                              return (
                                <td key={i} onClick={() => { togglePay(bail, year, i); }}
                                  style={{ padding: "6px 4px", textAlign: "center", cursor: "pointer", background: i === month ? "#fffbf5" : "transparent" }}
                                  title={`${s.label} — cliquer pour changer`}>
                                  <span style={{ display: "inline-block", width: 28, height: 22, borderRadius: 4, background: s.bg, color: s.color, fontWeight: 700, fontSize: 12, lineHeight: "22px", textAlign: "center" }}>
                                    {s.icon}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Légende */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {(Object.entries(PAY_STYLES) as [PayStatus, typeof PAY_STYLES[PayStatus]][]).map(([k, s]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
                    <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, background: s.bg, color: s.color, fontWeight: 700, fontSize: 11, lineHeight: "18px", textAlign: "center" }}>{s.icon}</span>
                    {s.label}
                  </div>
                ))}
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>· Cliquer sur un statut pour le changer</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
