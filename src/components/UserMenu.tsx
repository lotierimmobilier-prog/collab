"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen]   = useState(false);
  const [view, setView]   = useState<"menu" | "phone" | "password">("menu");
  const ref = useRef<HTMLDivElement>(null);

  const u = session?.user as { prenom?: string; nom?: string; email?: string; roleId?: string; name?: string } | undefined;
  const name = u?.prenom && u?.nom ? `${u.prenom} ${u.nom}` : (u?.name ?? "Mon compte");
  const initials = ((u?.prenom?.[0] ?? u?.name?.[0] ?? "?") + (u?.nom?.[0] ?? "")).toUpperCase();

  // Téléphone
  const [phone, setPhone] = useState("");
  const [phoneMsg, setPhoneMsg] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  // Mot de passe
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdMsg, setPwdMsg] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // Vidage du cache (conseillé chaque semaine pour récupérer la dernière version)
  const [clearing, setClearing] = useState(false);
  async function clearCache() {
    if (!confirm("Vider le cache de l'application ?\n\nCela force le chargement de la dernière version (assets, service worker). Vous resterez connecté. Conseillé une fois par semaine.")) return;
    setClearing(true);
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      try { sessionStorage.clear(); } catch { /* ignore */ }
    } catch { /* best-effort */ }
    // Rechargement forcé sur la dernière version.
    window.location.reload();
  }

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setView("menu"); } }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) fetch("/api/profile").then(r => r.json()).then(d => setPhone(d.phone ?? "")).catch(() => {});
  }, [open]);

  async function savePhone() {
    setSavingPhone(true); setPhoneMsg("");
    try {
      const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const d = await r.json();
      setPhoneMsg(r.ok ? "✓ Numéro enregistré" : (d.error || "Erreur"));
    } catch { setPhoneMsg("Erreur réseau"); }
    finally { setSavingPhone(false); }
  }

  async function savePassword() {
    setPwdMsg("");
    if (pwd.next !== pwd.confirm) { setPwdMsg("La confirmation ne correspond pas"); return; }
    setSavingPwd(true);
    try {
      const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }) });
      const d = await r.json();
      if (r.ok) { setPwdMsg("✓ Mot de passe modifié"); setPwd({ current: "", next: "", confirm: "" }); }
      else setPwdMsg(d.error || "Erreur");
    } catch { setPwdMsg("Erreur réseau"); }
    finally { setSavingPwd(false); }
  }

  if (!session?.user) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen(o => !o); setView("menu"); }} title="Mon compte"
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 8px 4px 4px", cursor: "pointer" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{initials}</div>
        <span className="hide-sm" style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{u?.prenom ?? name}</span>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 50, overflow: "hidden" }}>
          {/* En-tête */}
          <div style={{ padding: "14px 16px", background: GOLD_BG, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: GOLD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.email}</div>
              {u?.roleId && <div style={{ fontSize: 10, color: GOLD, textTransform: "capitalize", marginTop: 1 }}>{u.roleId}</div>}
            </div>
          </div>

          {view === "menu" && (
            <div style={{ padding: 8 }}>
              <Row icon="📞" label="Mon numéro de téléphone" onClick={() => { setView("phone"); setPhoneMsg(""); }} />
              <Row icon="🔑" label="Changer mon mot de passe" onClick={() => { setView("password"); setPwdMsg(""); }} />
              <div style={{ height: 1, background: "#f3f4f6", margin: "6px 4px" }} />
              <Row icon="🧹" label={clearing ? "Vidage en cours…" : "Vider le cache"} sub="Conseillé chaque semaine" onClick={() => { if (!clearing) clearCache(); }} />
              <div style={{ height: 1, background: "#f3f4f6", margin: "6px 4px" }} />
              <Row icon="↩" label="Se déconnecter" danger onClick={() => signOut({ callbackUrl: "/login" })} />
            </div>
          )}

          {view === "phone" && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <Back onClick={() => setView("menu")} />
              <label style={lbl}>Numéro de téléphone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" style={inp} />
              {phoneMsg && <span style={{ fontSize: 12, color: phoneMsg.startsWith("✓") ? "#059669" : "#dc2626" }}>{phoneMsg}</span>}
              <button onClick={savePhone} disabled={savingPhone} style={btn}>{savingPhone ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          )}

          {view === "password" && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <Back onClick={() => setView("menu")} />
              <label style={lbl}>Mot de passe actuel</label>
              <input type="password" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} style={inp} />
              <label style={lbl}>Nouveau mot de passe</label>
              <input type="password" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} style={inp} />
              <label style={lbl}>Confirmer</label>
              <input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} style={inp} />
              {pwdMsg && <span style={{ fontSize: 12, color: pwdMsg.startsWith("✓") ? "#059669" : "#dc2626" }}>{pwdMsg}</span>}
              <button onClick={savePassword} disabled={savingPwd || !pwd.current || !pwd.next} style={btn}>{savingPwd ? "Modification…" : "Changer le mot de passe"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, onClick, danger, sub }: { icon: string; label: string; onClick: () => void; danger?: boolean; sub?: string }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", borderRadius: 8, padding: "9px 10px", cursor: "pointer", fontSize: 13, color: danger ? "#dc2626" : "#374151", textAlign: "left" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
        <span>{label}</span>
        {sub && <span style={{ fontSize: 11, color: "#9ca3af" }}>{sub}</span>}
      </span>
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, textAlign: "left", padding: 0, marginBottom: 2 }}>← Retour</button>;
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.03em" };
const inp: React.CSSProperties = { height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", width: "100%", boxSizing: "border-box" };
const btn: React.CSSProperties = { background: GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 };
