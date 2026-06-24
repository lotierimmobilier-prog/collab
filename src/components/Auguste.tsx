"use client";
import { useState, useRef, useEffect } from "react";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK    = "#1C1A17";
const BORDER  = "#E6E1D9";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "Quelles sont les obligations du bailleur en matière de réparations ?",
  "Rédige un email de relance loyer impayé",
  "Quel est le délai de restitution du dépôt de garantie ?",
  "Comment calculer la révision de loyer (IRL) ?",
  "Aide-moi à rédiger un état des lieux",
];

export default function Auguste() {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [dots, setDots]       = useState(".");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const newMsgs: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const data = await r.json();
      setMsgs(prev => [...prev, { role: "assistant", content: data.reply ?? "Désolé, une erreur est survenue." }]);
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Impossible de contacter Auguste. Vérifiez votre connexion." }]);
    } finally { setLoading(false); }
  }

  function clear() { setMsgs([]); }

  function formatMsg(text: string) {
    return text.split("\n").map((line, i) => (
      <span key={i}>{line}{i < text.split("\n").length - 1 && <br />}</span>
    ));
  }

  return (
    <>
      {/* Bulle flottante */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Auguste — Assistant IA"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          width: 56, height: 56, borderRadius: "50%",
          background: open ? DARK : GOLD,
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, transition: "all 0.2s",
          transform: open ? "rotate(0deg)" : "rotate(0deg)",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {open ? "×" : "✦"}
      </button>

      {/* Panel de chat */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, zIndex: 998,
          width: 380, height: 560, background: "#fff",
          borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          border: `1px solid ${BORDER}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px", background: DARK, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Auguste</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Assistant IA · Lotier Immobilier</div>
            </div>
            <button onClick={clear} title="Nouvelle conversation" style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
              ↺ Réinitialiser
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>✦</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>Bonjour ! Je suis Auguste</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Votre assistant immobilier IA. Comment puis-je vous aider ?</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Suggestions</div>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} style={{
                    background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                    padding: "8px 12px", fontSize: 12, color: DARK, cursor: "pointer",
                    textAlign: "left", lineHeight: 1.4,
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#efe6d6")}
                    onMouseLeave={e => (e.currentTarget.style.background = GOLD_BG)}
                  >{s}</button>
                ))}
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} style={{
                  display: "flex", flexDirection: "column",
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  {m.role === "assistant" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✦</div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: GOLD }}>Auguste</span>
                    </div>
                  )}
                  <div style={{
                    maxWidth: "88%", padding: "9px 12px",
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: m.role === "user" ? GOLD : "#f3f4f6",
                    color: m.role === "user" ? "#fff" : DARK,
                    fontSize: 13, lineHeight: 1.55,
                  }}>
                    {formatMsg(m.content)}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✦</div>
                <div style={{ background: "#f3f4f6", borderRadius: "14px 14px 14px 4px", padding: "9px 14px", fontSize: 13, color: "#9ca3af" }}>Auguste réfléchit{dots}</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Saisie */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Posez votre question…"
              disabled={loading}
              style={{
                flex: 1, height: 38, border: `1px solid ${BORDER}`, borderRadius: 10,
                padding: "0 12px", fontSize: 13, outline: "none", fontFamily: "inherit",
                background: loading ? "#f9fafb" : "#fff",
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: input.trim() && !loading ? GOLD : "#e5e7eb",
                border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
                color: input.trim() && !loading ? "#fff" : "#9ca3af",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
            >↑</button>
          </div>
          <div style={{ padding: "4px 12px 8px", fontSize: 10, color: "#d1d5db", textAlign: "center" }}>
            Auguste peut faire des erreurs · Vérifiez les informations importantes
          </div>
        </div>
      )}
    </>
  );
}
