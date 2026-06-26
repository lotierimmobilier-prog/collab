"use client";
import { useState, useEffect, use } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";

interface Photo { id: string; name: string; mime: string; size: number; data: string }

export default function DeclarationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<{ role?: string; contactName?: string; address?: string; alreadySubmitted?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/assistance/${token}`).then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return; }
      setInfo(d);
      if (d.contactName) setName(d.contactName);
    }).catch(() => setError("Lien indisponible."));
  }, [token]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Photo[] = [];
    for (const file of Array.from(files).slice(0, 12)) {
      if (file.size > 8 * 1024 * 1024) continue;
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.onerror = rej; r.readAsDataURL(file);
      });
      next.push({ id: Math.random().toString(36).slice(2), name: file.name, mime: file.type || "image/jpeg", size: file.size, data });
    }
    setPhotos(p => [...p, ...next].slice(0, 12));
  }

  async function submit() {
    if (!description.trim() && photos.length === 0) { setError("Décrivez le problème ou ajoutez une photo."); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch(`/api/public/assistance/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, photos, contactName: name, contactPhone: phone }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Échec de l'envoi."); return; }
      setDone(true);
    } catch { setError("Erreur réseau."); }
    finally { setSubmitting(false); }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", background: "#F3F1EC", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", fontFamily: "system-ui, sans-serif" };
  const card: React.CSSProperties = { width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden" };

  if (error && !info) {
    return <div style={wrap}><div style={{ ...card, padding: 28, textAlign: "center" }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
      <div style={{ fontWeight: 700, color: DARK, marginBottom: 6 }}>Lien indisponible</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>{error}</div>
    </div></div>;
  }

  if (done) {
    return <div style={wrap}><div style={{ ...card, padding: 28, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
      <div style={{ fontWeight: 700, color: DARK, fontSize: 16, marginBottom: 6 }}>Demande transmise</div>
      <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>Merci. Votre agence Lotier Immobilier a bien reçu votre signalement et revient vers vous rapidement.</div>
    </div></div>;
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ background: GOLD, padding: "18px 22px" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Lotier Immobilier — Assistance</div>
          <div style={{ color: "#fff", opacity: 0.85, fontSize: 12.5, marginTop: 2 }}>Signalez votre problème, ajoutez des photos</div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {info?.address && <div style={{ fontSize: 12.5, color: "#6b7280", background: GOLD_BG, borderRadius: 8, padding: "8px 12px" }}>📍 {info.address}</div>}

          <Field label="Votre nom">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom et prénom" style={inp} />
          </Field>
          <Field label="Votre téléphone">
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" style={inp} />
          </Field>
          <Field label="Décrivez le problème">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Ex. fuite d'eau sous l'évier de la cuisine depuis ce matin…" style={{ ...inp, height: "auto", resize: "none", lineHeight: 1.5 }} />
          </Field>

          <Field label="Photos du problème">
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1.5px dashed ${GOLD}`, borderRadius: 12, padding: "16px", fontSize: 14, color: GOLD, cursor: "pointer", background: "#FCFAF6", fontWeight: 600 }}>
              📷 Prendre / ajouter des photos
              <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {photos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {photos.map(p => (
                  <div key={p.id} style={{ position: "relative" }}>
                    <img src={`data:${p.mime};base64,${p.data}`} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${BORDER}` }} />
                    <button onClick={() => setPhotos(x => x.filter(y => y.id !== p.id))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#dc2626", color: "#fff", fontSize: 12, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          {error && <div style={{ fontSize: 13, color: "#dc2626" }}>{error}</div>}

          <button onClick={submit} disabled={submitting} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {submitting ? "Envoi…" : "Envoyer à mon agence"}
          </button>
          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>Vos informations sont transmises uniquement à votre agence Lotier Immobilier.</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12.5, fontWeight: 600, color: DARK, marginBottom: 6 }}>{label}</div>{children}</div>;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${BORDER}`,
  fontSize: 15, color: DARK, outline: "none", background: "#fff", boxSizing: "border-box",
};
