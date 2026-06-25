"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { SERVICES, serviceMeta, ACCOUNT_KINDS, accountKindMeta, fmtEuro } from "@/lib/comptabilite";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";

interface Account { id: string; name: string; kind: string; openingBalance: number; threshold: number | null }
interface Txn { id: string; accountId: string; date: string; label: string; amount: number; service: string | null; recurring: boolean; source: string }
interface Treasury { id: string; name: string; kind: string; balance: number; threshold: number | null; belowThreshold: boolean }
interface Summary {
  treasury: Treasury[]; byKind: Record<string, number>;
  alerts: { accountId: string; name: string; balance: number; threshold: number }[];
  byService: { service: string; depenses: number; recettes: number; count: number }[];
  nonVentile: number;
}

export default function ComptaBanquePage() {
  const { data: session } = useSession();
  const role = session?.user?.roleId;
  const allowed = role === "admin" || role === "direction" || role === "dirigeant";
  const [tab, setTab] = useState<"tresorerie" | "operations" | "import">("tresorerie");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const loadAccounts = useCallback(async () => {
    const r = await fetch("/api/comptabilite/accounts"); const d = await r.json();
    setAccounts(d.accounts ?? []);
  }, []);
  useEffect(() => { if (allowed) loadAccounts(); }, [allowed, loadAccounts]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="comptabilite" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Comptabilité — Banque & trésorerie" />
        {!allowed ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>Réservé aux utilisateurs de la direction.</div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ maxWidth: 1040, margin: "0 auto" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                {([["tresorerie", "Trésorerie"], ["operations", "Opérations"], ["import", "Importer un relevé"]] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)}
                    style={{ border: `1px solid ${tab === id ? GOLD : BORDER}`, background: tab === id ? "#F7F0E6" : "#fff", color: tab === id ? GOLD : "#6b7280", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
                ))}
              </div>
              {tab === "tresorerie" && <TresorerieTab accounts={accounts} reloadAccounts={loadAccounts} />}
              {tab === "operations" && <OperationsTab accounts={accounts} />}
              {tab === "import"     && <ImportTab accounts={accounts} onDone={() => setTab("operations")} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Trésorerie ─────────────────────────────────────────────── */
function TresorerieTab({ accounts, reloadAccounts }: { accounts: Account[]; reloadAccounts: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/comptabilite/summary"); setSummary(await r.json());
  }, []);
  useEffect(() => { load(); }, [load, accounts]);

  return (
    <div>
      {summary?.alerts && summary.alerts.length > 0 && (
        <div style={{ background: "#FBF7F0", border: `1px solid ${GOLD}`, borderLeft: `4px solid ${GOLD}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>Alertes de seuil</div>
          {summary.alerts.map(a => (
            <div key={a.accountId} style={{ fontSize: 12, color: "#6b7280" }}>{a.name} : solde <strong style={{ color: DARK }}>{fmtEuro(a.balance)}</strong> — sous le seuil de {fmtEuro(a.threshold)}</div>
          ))}
        </div>
      )}

      {/* Séparation gestion / syndic / agence */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {ACCOUNT_KINDS.map(k => (
          <div key={k.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${k.color}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: DARK, marginTop: 4 }}>{fmtEuro(summary?.byKind?.[k.id] ?? 0)}</div>
            {(k.id === "gestion" || k.id === "syndic") && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>Fonds mandants — cloisonnés</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>Comptes</span>
        <button onClick={() => setShowAdd(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Compte</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(summary?.treasury ?? []).map(t => {
          const km = accountKindMeta(t.kind);
          return (
            <div key={t.id} style={{ background: "#fff", border: `1px solid ${t.belowThreshold ? "#FECACA" : BORDER}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: km?.color ?? "#999", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{km?.label}{t.threshold != null ? ` · seuil ${fmtEuro(t.threshold)}` : ""}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: (t.belowThreshold || t.balance < 0) ? "#9B2C2C" : DARK }}>{fmtEuro(t.balance)}</div>
            </div>
          );
        })}
        {(summary?.treasury ?? []).length === 0 && <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 30, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}` }}>Aucun compte. Créez un compte (gestion, syndic ou agence) pour démarrer.</div>}
      </div>

      {/* Frais par service */}
      <div style={{ fontSize: 14, fontWeight: 700, color: DARK, margin: "20px 0 10px" }}>Frais par service {summary && summary.nonVentile > 0 && <span style={{ fontSize: 11, color: "#D97706", fontWeight: 500 }}>· {summary.nonVentile} opération(s) à ventiler</span>}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {SERVICES.map(s => {
          const row = summary?.byService.find(x => x.service === s.id);
          return (
            <div key={s.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Dépenses</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{fmtEuro(row?.depenses ?? 0)}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Recettes : {fmtEuro(row?.recettes ?? 0)}</div>
            </div>
          );
        })}
      </div>

      {showAdd && <AccountModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); reloadAccounts(); load(); }} />}
    </div>
  );
}

function AccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", kind: "gestion", openingBalance: "", threshold: "" });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  async function save() {
    if (!form.name.trim()) { setErr("Nom requis"); return; }
    setSaving(true); setErr("");
    const r = await fetch("/api/comptabilite/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (r.ok) onSaved(); else { const d = await r.json().catch(() => ({})); setErr(d.error || "Erreur"); }
  }
  return (
    <Modal title="Nouveau compte" onClose={onClose}>
      <L label="Nom du compte"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Compte gestion BNP" style={inp} /></L>
      <L label="Type (séparation des fonds)">
        <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} style={inp}>
          {ACCOUNT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </L>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <L label="Solde initial (€)"><input type="number" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} style={inp} /></L>
        <L label="Seuil d'alerte (€)"><input type="number" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} placeholder="ex. 5000" style={inp} /></L>
      </div>
      {err && <span style={{ color: "#dc2626", fontSize: 12 }}>{err}</span>}
      <button onClick={save} disabled={saving} style={saveBtn}>{saving ? "…" : "Créer le compte"}</button>
    </Modal>
  );
}

/* ── Opérations ─────────────────────────────────────────────── */
function OperationsTab({ accounts }: { accounts: Account[] }) {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [filterAccount, setFilterAccount] = useState("");
  const [filterService, setFilterService] = useState("");
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filterAccount) p.set("accountId", filterAccount);
    if (filterService) p.set("service", filterService);
    const r = await fetch(`/api/comptabilite/transactions?${p}`); const d = await r.json();
    setTxns(d.transactions ?? []); setLoading(false);
  }, [filterAccount, filterService]);
  useEffect(() => { load(); }, [load]);

  async function classifyAll() {
    setClassifying(true);
    await fetch("/api/comptabilite/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: filterAccount || undefined }) });
    setClassifying(false); load();
  }
  async function setService(id: string, service: string) {
    setTxns(p => p.map(t => t.id === id ? { ...t, service: service || null } : t));
    await fetch("/api/comptabilite/transactions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, service }) });
  }
  const accName = (id: string) => accounts.find(a => a.id === id)?.name ?? "—";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="">Tous les comptes</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterService} onChange={e => setFilterService(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="">Tous services</option>
          <option value="none">Non ventilé</option>
          {SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button onClick={classifyAll} disabled={classifying} style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{classifying ? "Ventilation en cours…" : "Ventiler avec Auguste"}</button>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: "auto", background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Opération</button>
      </div>

      {loading ? <div style={{ color: "#9ca3af", textAlign: "center", padding: 30 }}>Chargement…</div>
      : txns.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 30, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}` }}>Aucune opération. Importez un relevé ou ajoutez une opération.</div>
      : (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          {txns.map((t, i) => {
            const sm = serviceMeta(t.service);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: i ? "1px solid #f3f4f6" : "none" }}>
                <span style={{ fontSize: 11, color: "#9ca3af", width: 64, flexShrink: 0 }}>{new Date(t.date).toLocaleDateString("fr-FR")}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.label}{t.recurring && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: 4, padding: "1px 5px", textTransform: "uppercase" }}>Récurrent</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? "#9B2C2C" : DARK, width: 100, textAlign: "right", flexShrink: 0 }}>{fmtEuro(t.amount)}</span>
                <select value={t.service ?? ""} onChange={e => setService(t.id, e.target.value)}
                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, border: `1px solid ${sm ? sm.color + "66" : BORDER}`, color: sm?.color ?? "#9ca3af", background: sm ? sm.color + "12" : "#fff", borderRadius: 6, padding: "4px 6px", cursor: "pointer" }}>
                  <option value="">— ventiler —</option>
                  {SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <span style={{ fontSize: 10, color: "#cbd5e1", width: 70, flexShrink: 0, textAlign: "right" }} title="Compte">{accName(t.accountId).slice(0, 12)}</span>
              </div>
            );
          })}
        </div>
      )}
      {showAdd && <TxnModal accounts={accounts} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function TxnModal({ accounts, onClose, onSaved }: { accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ accountId: accounts[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), label: "", amount: "", service: "" });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  async function save() {
    setSaving(true); setErr("");
    const r = await fetch("/api/comptabilite/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (r.ok) onSaved(); else { const d = await r.json().catch(() => ({})); setErr(d.error || "Erreur"); }
  }
  return (
    <Modal title="Nouvelle opération" onClose={onClose}>
      <L label="Compte"><select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))} style={inp}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></L>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <L label="Date"><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></L>
        <L label="Montant (€, négatif = débit)"><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inp} /></L>
      </div>
      <L label="Libellé"><input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inp} /></L>
      <L label="Service"><select value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} style={inp}><option value="">— à ventiler —</option>{SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></L>
      {err && <span style={{ color: "#dc2626", fontSize: 12 }}>{err}</span>}
      <button onClick={save} disabled={saving || !form.accountId} style={saveBtn}>{saving ? "…" : "Enregistrer"}</button>
    </Modal>
  );
}

/* ── Import ─────────────────────────────────────────────────── */
function ImportTab({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!accountId && accounts[0]) setAccountId(accounts[0].id); }, [accounts, accountId]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file || !accountId) { if (!accountId) setMsg("Choisissez d'abord un compte."); return; }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const format = ext === "pdf" ? "pdf" : ext === "ofx" ? "ofx" : (ext === "qif" ? "qif" : "");
    if (!format) { setMsg("Format non reconnu (PDF, OFX ou QIF)."); return; }
    setBusy(true); setMsg(format === "pdf" ? "Lecture du PDF par Auguste…" : "Import en cours…");
    try {
      const content = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onerror = rej;
        r.onload = () => res(format === "pdf" ? String(r.result).split(",")[1] ?? "" : String(r.result));
        if (format === "pdf") r.readAsDataURL(file); else r.readAsText(file);
      });
      const resp = await fetch("/api/comptabilite/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, format, content }) });
      const d = await resp.json();
      if (!resp.ok) { setMsg(d.error || "Échec de l'import"); return; }
      setMsg(`✓ ${d.imported} opération(s) importée(s)${d.classified ? `, ${d.classified} ventilée(s) automatiquement` : ""}. ${d.total - d.imported > 0 ? `(${d.total - d.imported} doublon(s) ignoré(s))` : ""}`);
      setTimeout(onDone, 1600);
    } catch { setMsg("Erreur réseau"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
        <L label="Compte de destination">
          <select value={accountId} onChange={e => setAccountId(e.target.value)} style={inp}>
            <option value="">— choisir —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </L>
        <div style={{ marginTop: 14 }}>
          <input ref={fileRef} type="file" accept=".pdf,.ofx,.qif" onChange={onFile} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy || !accountId}
            style={{ width: "100%", background: accountId ? GOLD : "#e5e7eb", color: accountId ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 14, fontWeight: 600, cursor: accountId ? "pointer" : "default" }}>
            {busy ? "Traitement en cours…" : "Choisir un relevé (PDF, OFX ou QIF)"}
          </button>
        </div>
        {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: msg.startsWith("✓") ? GOLD : "#374151" }}>{msg}</div>}
        <div style={{ marginTop: 14, fontSize: 11.5, color: "#9ca3af", lineHeight: 1.6 }}>
          • <strong>PDF</strong> : Auguste lit le relevé et extrait les opérations.<br />
          • <strong>OFX / QIF</strong> : import direct depuis l&apos;export de votre banque.<br />
          • Les opérations connues sont ventilées automatiquement ; les autres via « Ventiler avec Auguste ».<br />
          • La connexion bancaire automatique pourra être ajoutée ultérieurement.
        </div>
      </div>
    </div>
  );
}

/* ── UI helpers ─────────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 480, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ background: DARK, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" };
const saveBtn: React.CSSProperties = { background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 };
