"use client";
import { useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const GREEN = "#2F855A"; const RED = "#DC2626";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const euro = (n: number) => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const num = (s: string) => parseFloat((s || "").replace(",", ".")) || 0;

const champ: React.CSSProperties = { width: "100%", padding: "9px 11px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 14, boxSizing: "border-box" };
const labelSt: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: DARK, margin: "0 0 14px" }}>{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: 1, minWidth: 0 }}><label style={labelSt}>{label}</label>{children}</div>;
}
function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: DARK }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color ?? DARK }}>{value}</span>
    </div>
  );
}
function Highlight({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ marginTop: 12, background: GOLD_BG, borderRadius: 11, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: DARK }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: color ?? GREEN }}>{value}</span>
    </div>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 10, lineHeight: 1.4 }}>{children}</div>;
}

export default function BoiteAOutilsPage() {
  const [tab, setTab] = useState<"loc" | "tx" | "admin" | "calc">("loc");
  const tabs: [typeof tab, string][] = [["loc", "📋 Gestion locative"], ["tx", "🏷️ Transaction"], ["admin", "🧮 Administration"], ["calc", "🔢 Calculatrice"]];
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="outils" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>🧰 Ma boîte à outils</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 18 }}>Calculatrices du quotidien. Aucune donnée n'est enregistrée — tout est calculé localement.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {tabs.map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "7px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 9,
              background: tab === k ? GOLD : "#fff", color: tab === k ? "#fff" : "#6b7280", border: `1px solid ${tab === k ? GOLD : BORDER}`,
            }}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20, alignItems: "start" }}>
          {tab === "loc" && <><ProrataLoyer /><RevisionIRL /><HonorairesLocation /><DepotGarantie /><RegulCharges /><Preavis /></>}
          {tab === "tx" && <><HonorairesVente /><Rendement /><Credit /><PrixM2 /></>}
          {tab === "admin" && <><TVA /><Carrez /><CalculDates /></>}
          {tab === "calc" && <Calculatrice />}
        </div>
      </main>
    </div>
  );
}

// ════════════ GESTION LOCATIVE ════════════

function ProrataLoyer() {
  const t = new Date();
  const [loyer, setLoyer] = useState(""); const [charges, setCharges] = useState("");
  const [dateStr, setDateStr] = useState(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
  const [sens, setSens] = useState<"entree" | "sortie">("entree");
  const res = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return null;
    const joursMois = new Date(y, m, 0).getDate();
    const occ = sens === "entree" ? joursMois - d + 1 : d;
    const L = num(loyer), C = num(charges);
    const pr = (x: number) => Math.round((x * occ / joursMois) * 100) / 100;
    return { joursMois, occ, mois: MOIS[m - 1], y, d, pl: pr(L), pc: pr(C), L, C, total: pr(L) + pr(C) };
  }, [loyer, charges, dateStr, sens]);
  return (
    <Card title="🏠 Prorata de loyer">
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {([["entree", "Entrée"], ["sortie", "Sortie"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSens(k)} style={{ flex: 1, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: sens === k ? GOLD : "#fff", color: sens === k ? "#fff" : "#6b7280", border: `1px solid ${sens === k ? GOLD : BORDER}` }}>{l} des lieux</button>
        ))}
      </div>
      <Field label={sens === "entree" ? "Date d'entrée" : "Date de sortie"}><input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} style={champ} /></Field>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Field label="Loyer HC (€)"><input inputMode="decimal" value={loyer} onChange={e => setLoyer(e.target.value)} placeholder="650" style={champ} /></Field>
        <Field label="Charges (€)"><input inputMode="decimal" value={charges} onChange={e => setCharges(e.target.value)} placeholder="50" style={champ} /></Field>
      </div>
      {res && (res.L > 0 || res.C > 0) && (
        <div style={{ marginTop: 14 }}>
          <Note>{res.occ} jour{res.occ > 1 ? "s" : ""} sur {res.joursMois} ({res.mois} {res.y}).</Note>
          {res.L > 0 && <Row label="Loyer au prorata" value={euro(res.pl)} />}
          {res.C > 0 && <Row label="Charges au prorata" value={euro(res.pc)} />}
          <Highlight label="Total dû ce mois" value={euro(res.total)} />
        </div>
      )}
      <Note>Prorata des jours réels du mois.</Note>
    </Card>
  );
}

function RevisionIRL() {
  const [loyer, setLoyer] = useState(""); const [irlA, setIrlA] = useState(""); const [irlN, setIrlN] = useState("");
  const r = useMemo(() => {
    const L = num(loyer), a = num(irlA), n = num(irlN);
    if (!L || !a || !n) return null;
    const nv = Math.round(L * n / a * 100) / 100;
    return { nv, diff: nv - L, pct: (n / a - 1) * 100 };
  }, [loyer, irlA, irlN]);
  return (
    <Card title="📈 Révision de loyer (IRL)">
      <Field label="Loyer actuel HC (€)"><input inputMode="decimal" value={loyer} onChange={e => setLoyer(e.target.value)} placeholder="650" style={champ} /></Field>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Field label="IRL ancien (référence)"><input inputMode="decimal" value={irlA} onChange={e => setIrlA(e.target.value)} placeholder="142,06" style={champ} /></Field>
        <Field label="IRL nouveau"><input inputMode="decimal" value={irlN} onChange={e => setIrlN(e.target.value)} placeholder="145,17" style={champ} /></Field>
      </div>
      {r && <div style={{ marginTop: 14 }}>
        <Row label="Variation IRL" value={`${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)} %`} color={r.pct >= 0 ? GREEN : RED} />
        <Row label="Augmentation" value={`${r.diff >= 0 ? "+" : ""}${euro(r.diff)}`} />
        <Highlight label="Nouveau loyer HC" value={euro(r.nv)} />
      </div>}
      <Note>Nouveau loyer = loyer × (IRL nouveau ÷ IRL de référence). Indices INSEE du même trimestre.</Note>
    </Card>
  );
}

function HonorairesLocation() {
  const [surface, setSurface] = useState("");
  const [zone, setZone] = useState(12);
  const r = useMemo(() => {
    const s = num(surface); if (!s) return null;
    const bail = Math.round(zone * s * 100) / 100;     // visite + dossier + rédaction bail
    const edl = Math.round(3 * s * 100) / 100;         // état des lieux
    return { bail, edl, total: bail + edl };
  }, [surface, zone]);
  return (
    <Card title="🧾 Honoraires de location (loi ALUR)">
      <Field label="Surface habitable (m²)"><input inputMode="decimal" value={surface} onChange={e => setSurface(e.target.value)} placeholder="45" style={champ} /></Field>
      <div style={{ marginTop: 12 }}>
        <label style={labelSt}>Zone</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[[12, "Très tendue"], [10, "Tendue"], [8, "Autres"]].map(([v, l]) => (
            <button key={v} onClick={() => setZone(v as number)} style={{ flex: 1, padding: "7px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: zone === v ? GOLD : "#fff", color: zone === v ? "#fff" : "#6b7280", border: `1px solid ${zone === v ? GOLD : BORDER}` }}>{l}<br />{v} €/m²</button>
          ))}
        </div>
      </div>
      {r && <div style={{ marginTop: 14 }}>
        <Row label={`Honoraires bail (${zone} €/m²)`} value={euro(r.bail)} />
        <Row label="État des lieux (3 €/m²)" value={euro(r.edl)} />
        <Highlight label="Plafond part locataire" value={euro(r.total)} />
      </div>}
      <Note>Plafond légal à la charge du locataire. Sa part d'état des lieux ne peut dépasser celle du bailleur.</Note>
    </Card>
  );
}

function DepotGarantie() {
  const [loyer, setLoyer] = useState(""); const [type, setType] = useState<"nu" | "meuble">("nu");
  const r = useMemo(() => { const L = num(loyer); return L ? L * (type === "nu" ? 1 : 2) : null; }, [loyer, type]);
  return (
    <Card title="🔐 Dépôt de garantie">
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {([["nu", "Logement nu"], ["meuble", "Logement meublé"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setType(k)} style={{ flex: 1, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: type === k ? GOLD : "#fff", color: type === k ? "#fff" : "#6b7280", border: `1px solid ${type === k ? GOLD : BORDER}` }}>{l}</button>
        ))}
      </div>
      <Field label="Loyer mensuel HC (€)"><input inputMode="decimal" value={loyer} onChange={e => setLoyer(e.target.value)} placeholder="650" style={champ} /></Field>
      {r !== null && <Highlight label={`Dépôt (${type === "nu" ? "1 mois" : "2 mois"})`} value={euro(r)} />}
      <Note>Logement nu : 1 mois de loyer hors charges. Meublé : 2 mois.</Note>
    </Card>
  );
}

function RegulCharges() {
  const [prov, setProv] = useState(""); const [reel, setReel] = useState("");
  const r = useMemo(() => { const p = num(prov), x = num(reel); if (!p && !x) return null; return p - x; }, [prov, reel]);
  return (
    <Card title="♻️ Régularisation de charges">
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Provisions encaissées (€)"><input inputMode="decimal" value={prov} onChange={e => setProv(e.target.value)} placeholder="600" style={champ} /></Field>
        <Field label="Charges réelles (€)"><input inputMode="decimal" value={reel} onChange={e => setReel(e.target.value)} placeholder="540" style={champ} /></Field>
      </div>
      {r !== null && (r >= 0
        ? <Highlight label="À rembourser au locataire" value={euro(r)} color={GREEN} />
        : <Highlight label="Complément à demander au locataire" value={euro(-r)} color={RED} />)}
      <Note>Solde = provisions − charges réelles justifiées.</Note>
    </Card>
  );
}

function Preavis() {
  const t = new Date();
  const [dateStr, setDateStr] = useState(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
  const [mois, setMois] = useState(1);
  const r = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number); if (!y) return null;
    const fin = new Date(y, m - 1 + mois, d);
    return fin.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  }, [dateStr, mois]);
  return (
    <Card title="📅 Fin de préavis">
      <Field label="Date de réception du congé"><input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} style={champ} /></Field>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {[[1, "1 mois (zone tendue / meublé)"], [3, "3 mois (nu)"]].map(([v, l]) => (
          <button key={v} onClick={() => setMois(v as number)} style={{ flex: 1, padding: "7px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: mois === v ? GOLD : "#fff", color: mois === v ? "#fff" : "#6b7280", border: `1px solid ${mois === v ? GOLD : BORDER}` }}>{l}</button>
        ))}
      </div>
      {r && <Highlight label="Fin du préavis" value={r} color={DARK} />}
      <Note>Préavis décompté de date à date à partir de la réception de la lettre.</Note>
    </Card>
  );
}

// ════════════ TRANSACTION ════════════

function HonorairesVente() {
  const [prix, setPrix] = useState(""); const [taux, setTaux] = useState("5"); const [charge, setCharge] = useState<"vendeur" | "acq">("vendeur");
  const r = useMemo(() => {
    const P = num(prix), tx = num(taux); if (!P) return null;
    const hono = Math.round(P * tx / 100 * 100) / 100;
    return charge === "vendeur"
      ? { hono, net: P - hono, fai: P, lblNet: "Net vendeur", lblFai: "Prix FAI (affiché)" }
      : { hono, net: P, fai: P + hono, lblNet: "Net vendeur", lblFai: "Prix FAI (affiché)" };
  }, [prix, taux, charge]);
  return (
    <Card title="💼 Honoraires de vente">
      <Field label={charge === "vendeur" ? "Prix de vente FAI (€)" : "Prix net vendeur (€)"}>
        <input inputMode="decimal" value={prix} onChange={e => setPrix(e.target.value)} placeholder="200000" style={champ} />
      </Field>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Field label="Taux d'honoraires (%)"><input inputMode="decimal" value={taux} onChange={e => setTaux(e.target.value)} placeholder="5" style={champ} /></Field>
        <Field label="À la charge de">
          <div style={{ display: "flex", gap: 6 }}>
            {([["vendeur", "Vendeur"], ["acq", "Acquéreur"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setCharge(k)} style={{ flex: 1, padding: "9px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: charge === k ? GOLD : "#fff", color: charge === k ? "#fff" : "#6b7280", border: `1px solid ${charge === k ? GOLD : BORDER}` }}>{l}</button>
            ))}
          </div>
        </Field>
      </div>
      {r && <div style={{ marginTop: 14 }}>
        <Row label="Honoraires" value={euro(r.hono)} color={GOLD} />
        <Row label={r.lblNet} value={euro(r.net)} />
        <Highlight label={r.lblFai} value={euro(r.fai)} color={DARK} />
      </div>}
      <Note>Le champ « prix » correspond au prix de vente. Selon qui paie les honoraires, le net vendeur / prix affiché s'ajustent.</Note>
    </Card>
  );
}

function Rendement() {
  const [prix, setPrix] = useState(""); const [frais, setFrais] = useState(""); const [loyer, setLoyer] = useState(""); const [chAn, setChAn] = useState("");
  const r = useMemo(() => {
    const cout = num(prix) + num(frais); const annuel = num(loyer) * 12; if (!cout || !annuel) return null;
    return { brut: annuel / cout * 100, net: (annuel - num(chAn)) / cout * 100 };
  }, [prix, frais, loyer, chAn]);
  return (
    <Card title="📊 Rendement locatif">
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Prix d'achat (€)"><input inputMode="decimal" value={prix} onChange={e => setPrix(e.target.value)} placeholder="150000" style={champ} /></Field>
        <Field label="Frais (notaire, travaux) (€)"><input inputMode="decimal" value={frais} onChange={e => setFrais(e.target.value)} placeholder="15000" style={champ} /></Field>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Field label="Loyer mensuel (€)"><input inputMode="decimal" value={loyer} onChange={e => setLoyer(e.target.value)} placeholder="700" style={champ} /></Field>
        <Field label="Charges annuelles (€)"><input inputMode="decimal" value={chAn} onChange={e => setChAn(e.target.value)} placeholder="1500" style={champ} /></Field>
      </div>
      {r && <div style={{ marginTop: 14 }}>
        <Row label="Rendement brut" value={`${r.brut.toFixed(2)} %`} color={GOLD} />
        <Highlight label="Rendement net (avant impôts)" value={`${r.net.toFixed(2)} %`} color={GREEN} />
      </div>}
      <Note>Brut = (loyer × 12) ÷ coût total. Net = (loyers − charges annuelles) ÷ coût total.</Note>
    </Card>
  );
}

function Credit() {
  const [montant, setMontant] = useState(""); const [taux, setTaux] = useState(""); const [duree, setDuree] = useState("");
  const r = useMemo(() => {
    const C = num(montant), ta = num(taux) / 100 / 12, n = num(duree) * 12;
    if (!C || !n) return null;
    const M = ta === 0 ? C / n : C * ta / (1 - Math.pow(1 + ta, -n));
    return { M, total: M * n, interets: M * n - C };
  }, [montant, taux, duree]);
  return (
    <Card title="🏦 Mensualité de crédit">
      <Field label="Montant emprunté (€)"><input inputMode="decimal" value={montant} onChange={e => setMontant(e.target.value)} placeholder="180000" style={champ} /></Field>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Field label="Taux annuel (%)"><input inputMode="decimal" value={taux} onChange={e => setTaux(e.target.value)} placeholder="3,5" style={champ} /></Field>
        <Field label="Durée (années)"><input inputMode="decimal" value={duree} onChange={e => setDuree(e.target.value)} placeholder="20" style={champ} /></Field>
      </div>
      {r && <div style={{ marginTop: 14 }}>
        <Row label="Coût total du crédit" value={euro(r.total)} />
        <Row label="dont intérêts" value={euro(r.interets)} color={RED} />
        <Highlight label="Mensualité (hors assurance)" value={euro(r.M)} color={DARK} />
      </div>}
      <Note>Mensualité d'un prêt amortissable. Hors assurance emprunteur. Pour info : mensualité conseillée ≤ 35 % des revenus.</Note>
    </Card>
  );
}

function PrixM2() {
  const [prix, setPrix] = useState(""); const [surface, setSurface] = useState("");
  const r = useMemo(() => { const P = num(prix), S = num(surface); return S ? P / S : null; }, [prix, surface]);
  return (
    <Card title="📐 Prix au m²">
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Prix (€)"><input inputMode="decimal" value={prix} onChange={e => setPrix(e.target.value)} placeholder="180000" style={champ} /></Field>
        <Field label="Surface (m²)"><input inputMode="decimal" value={surface} onChange={e => setSurface(e.target.value)} placeholder="65" style={champ} /></Field>
      </div>
      {r !== null && <Highlight label="Prix au m²" value={euro(r)} color={DARK} />}
    </Card>
  );
}

// ════════════ ADMINISTRATION ════════════

function TVA() {
  const [montant, setMontant] = useState(""); const [taux, setTaux] = useState(20); const [mode, setMode] = useState<"ht" | "ttc">("ht");
  const r = useMemo(() => {
    const x = num(montant); if (!x) return null; const c = 1 + taux / 100;
    return mode === "ht" ? { ht: x, tva: x * (c - 1), ttc: x * c } : { ht: x / c, tva: x - x / c, ttc: x };
  }, [montant, taux, mode]);
  return (
    <Card title="🧮 TVA (HT ⇄ TTC)">
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {([["ht", "Je saisis du HT"], ["ttc", "Je saisis du TTC"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: mode === k ? GOLD : "#fff", color: mode === k ? "#fff" : "#6b7280", border: `1px solid ${mode === k ? GOLD : BORDER}` }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Montant (€)"><input inputMode="decimal" value={montant} onChange={e => setMontant(e.target.value)} placeholder="1000" style={champ} /></Field>
        <Field label="Taux TVA">
          <select value={taux} onChange={e => setTaux(Number(e.target.value))} style={champ}>{[20, 10, 5.5, 2.1].map(t => <option key={t} value={t}>{t} %</option>)}</select>
        </Field>
      </div>
      {r && <div style={{ marginTop: 14 }}>
        <Row label="Montant HT" value={euro(r.ht)} />
        <Row label={`TVA (${taux} %)`} value={euro(r.tva)} color={GOLD} />
        <Highlight label="Montant TTC" value={euro(r.ttc)} color={DARK} />
      </div>}
    </Card>
  );
}

function Carrez() {
  const [pieces, setPieces] = useState<{ nom: string; s: string }[]>([{ nom: "Séjour", s: "" }, { nom: "Chambre", s: "" }]);
  const total = pieces.reduce((a, p) => a + num(p.s), 0);
  const upd = (i: number, k: "nom" | "s", v: string) => setPieces(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  return (
    <Card title="📏 Surface (Carrez / habitable)">
      {pieces.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <input value={p.nom} onChange={e => upd(i, "nom", e.target.value)} placeholder="Pièce" style={{ ...champ, flex: 2 }} />
          <input inputMode="decimal" value={p.s} onChange={e => upd(i, "s", e.target.value)} placeholder="m²" style={{ ...champ, flex: 1 }} />
          <button onClick={() => setPieces(p => p.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: RED, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      ))}
      <button onClick={() => setPieces(p => [...p, { nom: "", s: "" }])} style={{ fontSize: 12, fontWeight: 700, color: GOLD, background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>+ Ajouter une pièce</button>
      <Highlight label="Surface totale" value={`${(Math.round(total * 100) / 100).toLocaleString("fr-FR")} m²`} color={DARK} />
      <Note>N'inclure que les surfaces dont la hauteur sous plafond est ≥ 1,80 m (loi Carrez).</Note>
    </Card>
  );
}

function CalculDates() {
  const t = new Date(); const iso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const [d1, setD1] = useState(iso(t)); const [d2, setD2] = useState(iso(t)); const [add, setAdd] = useState("10"); const [base, setBase] = useState(iso(t));
  const between = useMemo(() => {
    const a = new Date(d1), b = new Date(d2); if (isNaN(+a) || isNaN(+b)) return null;
    const cal = Math.round((+b - +a) / 86400000);
    let ouvres = 0; const s = new Date(Math.min(+a, +b)), e = new Date(Math.max(+a, +b));
    for (const dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) { const w = dt.getDay(); if (w !== 0 && w !== 6) ouvres++; }
    return { cal, ouvres };
  }, [d1, d2]);
  const future = useMemo(() => {
    const b = new Date(base); if (isNaN(+b)) return null; b.setDate(b.getDate() + num(add));
    return b.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }, [base, add]);
  return (
    <Card title="🗓️ Calcul de dates">
      <label style={labelSt}>Nombre de jours entre deux dates</label>
      <div style={{ display: "flex", gap: 10 }}>
        <input type="date" value={d1} onChange={e => setD1(e.target.value)} style={champ} />
        <input type="date" value={d2} onChange={e => setD2(e.target.value)} style={champ} />
      </div>
      {between && <div style={{ marginTop: 10 }}>
        <Row label="Jours calendaires" value={`${Math.abs(between.cal)} j`} />
        <Row label="Jours ouvrés (lun.–ven.)" value={`${between.ouvres} j`} />
      </div>}
      <div style={{ borderTop: `1px solid ${BORDER}`, margin: "14px 0" }} />
      <label style={labelSt}>Ajouter des jours à une date (ex. rétractation SRU : 10 j)</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="date" value={base} onChange={e => setBase(e.target.value)} style={champ} />
        <span style={{ color: "#6b7280", fontWeight: 700 }}>+</span>
        <input inputMode="numeric" value={add} onChange={e => setAdd(e.target.value)} style={{ ...champ, width: 70, flex: "none" }} />
        <span style={{ color: "#6b7280", fontSize: 13 }}>j</span>
      </div>
      {future && <Highlight label="Date d'échéance" value={future} color={DARK} />}
      <Note>Jours ouvrés sans tenir compte des jours fériés.</Note>
    </Card>
  );
}

// ════════════ CALCULATRICE ════════════

function evaluate(expr: string): number {
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/()])/g);
  if (!tokens) return 0;
  const out: (number | string)[] = [], ops: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  for (const t of tokens) {
    if (/\d/.test(t)) out.push(parseFloat(t));
    else if (t === "(") ops.push(t);
    else if (t === ")") { while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!); ops.pop(); }
    else { while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop()!); ops.push(t); }
  }
  while (ops.length) out.push(ops.pop()!);
  const st: number[] = [];
  for (const t of out) {
    if (typeof t === "number") st.push(t);
    else { const b = st.pop() ?? 0, a = st.pop() ?? 0; st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : a / b); }
  }
  return st[0] ?? 0;
}

function Calculatrice() {
  const [expr, setExpr] = useState("");
  const display = expr.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/([+\-])/g, " $1 ") || "0";
  const result = useMemo(() => { try { const r = evaluate(expr); return Number.isFinite(r) ? r : null; } catch { return null; } }, [expr]);
  const push = (s: string) => setExpr(e => e + s);
  const equals = () => { if (result !== null) setExpr(String(Math.round(result * 1e6) / 1e6)); };
  const keys: { label: string; on: () => void; kind?: "op" | "eq" | "fn" }[] = [
    { label: "C", on: () => setExpr(""), kind: "fn" }, { label: "(", on: () => push("("), kind: "fn" }, { label: ")", on: () => push(")"), kind: "fn" }, { label: "÷", on: () => push("/"), kind: "op" },
    { label: "7", on: () => push("7") }, { label: "8", on: () => push("8") }, { label: "9", on: () => push("9") }, { label: "×", on: () => push("*"), kind: "op" },
    { label: "4", on: () => push("4") }, { label: "5", on: () => push("5") }, { label: "6", on: () => push("6") }, { label: "−", on: () => push("-"), kind: "op" },
    { label: "1", on: () => push("1") }, { label: "2", on: () => push("2") }, { label: "3", on: () => push("3") }, { label: "+", on: () => push("+"), kind: "op" },
    { label: "0", on: () => push("0") }, { label: ".", on: () => push(".") }, { label: "⌫", on: () => setExpr(e => e.slice(0, -1)), kind: "fn" }, { label: "=", on: equals, kind: "eq" },
  ];
  return (
    <Card title="🔢 Calculatrice">
      <div style={{ background: "#1C1A17", borderRadius: 11, padding: "12px 14px", marginBottom: 12, minHeight: 56, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
        <div style={{ color: "#9ca3af", fontSize: 13, minHeight: 16, wordBreak: "break-all", textAlign: "right" }}>{display}</div>
        <div style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>{result !== null ? (Math.round(result * 1e6) / 1e6).toLocaleString("fr-FR") : "—"}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {keys.map((k, i) => (
          <button key={i} onClick={k.on} style={{
            padding: "13px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", borderRadius: 10, border: `1px solid ${BORDER}`,
            background: k.kind === "eq" ? GOLD : k.kind === "op" ? GOLD_BG : k.kind === "fn" ? "#f3f4f6" : "#fff",
            color: k.kind === "eq" ? "#fff" : k.kind === "op" ? GOLD : DARK,
          }}>{k.label}</button>
        ))}
      </div>
    </Card>
  );
}
