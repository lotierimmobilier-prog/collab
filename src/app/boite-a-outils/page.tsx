"use client";
import { useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const GREEN = "#2F855A";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const euro = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function BoiteAOutilsPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="outils" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 980, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>🧰 Ma boîte à outils</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 22 }}>Des petits outils du quotidien : calculatrice et calcul de prorata de loyer.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20, alignItems: "start" }}>
          <ProrataLoyer />
          <Calculatrice />
        </div>
      </main>
    </div>
  );
}

// ── Calculatrice locative : prorata du loyer selon la date d'entrée/sortie ──
function ProrataLoyer() {
  const today = new Date();
  const [loyer, setLoyer] = useState("");
  const [charges, setCharges] = useState("");
  const [dateStr, setDateStr] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  const [sens, setSens] = useState<"entree" | "sortie">("entree");

  const res = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return null;
    const joursMois = new Date(y, m, 0).getDate();
    const joursOccupes = sens === "entree" ? joursMois - d + 1 : d;
    const L = parseFloat(loyer.replace(",", ".")) || 0;
    const C = parseFloat(charges.replace(",", ".")) || 0;
    const r = (x: number) => Math.round((x * joursOccupes / joursMois) * 100) / 100;
    const pl = r(L), pc = r(C);
    return { joursMois, joursOccupes, mois: MOIS[m - 1], annee: y, jour: d, pl, pc, total: Math.round((pl + pc) * 100) / 100, L, C };
  }, [loyer, charges, dateStr, sens]);

  const champ: React.CSSProperties = { width: "100%", padding: "9px 11px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 14, boxSizing: "border-box" };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: DARK, margin: "0 0 14px" }}>🏠 Calculatrice locative — prorata de loyer</h2>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {([["entree", "Entrée dans les lieux"], ["sortie", "Sortie des lieux"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setSens(k)} style={{
            flex: 1, padding: "7px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 9,
            background: sens === k ? GOLD : "#fff", color: sens === k ? "#fff" : "#6b7280", border: `1px solid ${sens === k ? GOLD : BORDER}`,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>{sens === "entree" ? "Date d'entrée dans les lieux" : "Date de sortie des lieux"}</label>
        <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} style={champ} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Loyer hors charges (€)</label>
          <input inputMode="decimal" value={loyer} onChange={e => setLoyer(e.target.value)} placeholder="ex. 650" style={champ} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Charges (€)</label>
          <input inputMode="decimal" value={charges} onChange={e => setCharges(e.target.value)} placeholder="ex. 50" style={champ} />
        </div>
      </div>

      {res && (res.L > 0 || res.C > 0) && (
        <div style={{ marginTop: 16, background: GOLD_BG, borderRadius: 11, padding: 14 }}>
          <div style={{ fontSize: 12.5, color: "#6b5a3f", marginBottom: 10 }}>
            {sens === "entree" ? "Occupation du" : "Occupation jusqu'au"} <b>{res.jour} {res.mois} {res.annee}</b> → <b>{res.joursOccupes}</b> jour{res.joursOccupes > 1 ? "s" : ""} sur {res.joursMois} ({res.mois}).
          </div>
          {res.L > 0 && <Ligne label="Loyer au prorata" value={euro(res.pl)} sub={`${euro(res.L)} × ${res.joursOccupes}/${res.joursMois}`} />}
          {res.C > 0 && <Ligne label="Charges au prorata" value={euro(res.pc)} sub={`${euro(res.C)} × ${res.joursOccupes}/${res.joursMois}`} />}
          <div style={{ borderTop: `1px solid ${GOLD}55`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: DARK }}>Total dû ce mois</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{euro(res.total)}</span>
          </div>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 10, lineHeight: 1.4 }}>
        Calcul au prorata des jours réels du mois (méthode usuelle en location). L'entrée compte le jour d'arrivée jusqu'à la fin du mois ; la sortie compte du 1er jusqu'au jour de départ.
      </div>
    </div>
  );
}

function Ligne({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <div><span style={{ fontSize: 13, color: DARK }}>{label}</span>{sub && <span style={{ fontSize: 10.5, color: "#9ca3af", marginLeft: 6 }}>{sub}</span>}</div>
      <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{value}</span>
    </div>
  );
}

// ── Calculatrice classique ──────────────────────────────────────────────────
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
  const clear = () => setExpr("");
  const back = () => setExpr(e => e.slice(0, -1));
  const equals = () => { if (result !== null) setExpr(String(Math.round(result * 1e6) / 1e6)); };

  const keys: { label: string; on: () => void; kind?: "op" | "eq" | "fn" }[] = [
    { label: "C", on: clear, kind: "fn" }, { label: "(", on: () => push("("), kind: "fn" }, { label: ")", on: () => push(")"), kind: "fn" }, { label: "÷", on: () => push("/"), kind: "op" },
    { label: "7", on: () => push("7") }, { label: "8", on: () => push("8") }, { label: "9", on: () => push("9") }, { label: "×", on: () => push("*"), kind: "op" },
    { label: "4", on: () => push("4") }, { label: "5", on: () => push("5") }, { label: "6", on: () => push("6") }, { label: "−", on: () => push("-"), kind: "op" },
    { label: "1", on: () => push("1") }, { label: "2", on: () => push("2") }, { label: "3", on: () => push("3") }, { label: "+", on: () => push("+"), kind: "op" },
    { label: "0", on: () => push("0") }, { label: ".", on: () => push(".") }, { label: "⌫", on: back, kind: "fn" }, { label: "=", on: equals, kind: "eq" },
  ];

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: DARK, margin: "0 0 14px" }}>🔢 Calculatrice</h2>
      <div style={{ background: "#1C1A17", borderRadius: 11, padding: "12px 14px", marginBottom: 12, minHeight: 56, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
        <div style={{ color: "#9ca3af", fontSize: 13, minHeight: 16, wordBreak: "break-all", textAlign: "right" }}>{display}</div>
        <div style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>{result !== null ? (Math.round(result * 1e6) / 1e6).toLocaleString("fr-FR") : "—"}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {keys.map((k, i) => (
          <button key={i} onClick={k.on} style={{
            padding: "13px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: k.kind === "eq" ? GOLD : k.kind === "op" ? GOLD_BG : k.kind === "fn" ? "#f3f4f6" : "#fff",
            color: k.kind === "eq" ? "#fff" : k.kind === "op" ? GOLD : DARK,
          }}>{k.label}</button>
        ))}
      </div>
    </div>
  );
}
