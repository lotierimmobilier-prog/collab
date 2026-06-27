"use client";
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";

const GOLD    = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK    = "#1C1A17";
const BORDER  = "#E6E1D9";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "Quelles tâches sont en attente ?",
  "Crée un RDV visite demain à 14h",
  "Montre-moi l'agenda de cette semaine",
  "Qui sont les membres de l'agence ?",
  "Crée une tâche urgente : appeler le locataire Dupont",
  "Quelles sont mes notifications non lues ?",
];

const TOOL_LABELS: Record<string, string> = {
  get_tasks:             "📋 Lecture des tâches…",
  create_task:           "✅ Création d'une tâche…",
  update_task:           "✏️ Modification d'une tâche…",
  get_calendar_events:   "📅 Lecture de l'agenda…",
  create_calendar_event: "📅 Création d'un événement…",
  get_users:             "👥 Récupération des utilisateurs…",
  get_task_families:     "🗂 Lecture des familles…",
  get_notifications:     "🔔 Lecture des notifications…",
  get_channels:          "💬 Lecture des conversations…",
  send_internal_message: "💬 Envoi d'un message…",
};

export default function Auguste() {
  const { data: session } = useSession();
  const [open, setOpen]         = useState(false);
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [action, setAction]     = useState<string | null>(null);
  const [dots, setDots]         = useState(".");
  const [logoUrl, setLogoUrl]   = useState("");
  const [pos, setPos]           = useState<{ x: number; y: number } | null>(null); // coin haut-gauche de la bulle
  const [vp, setVp]             = useState<{ w: number; h: number }>({ w: 1200, h: 800 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const drag      = useRef<{ ox: number; oy: number; dx: number; dy: number; moved: boolean } | null>(null);

  // ── Voix : dictée (navigateur) + synthèse vocale (ElevenLabs, mode dialogue) ──
  const [ttsEnabled, setTtsEnabled] = useState(false);   // synthèse vocale dispo (clé serveur)
  const [sttSupported, setSttSupported] = useState(false); // dictée dispo (navigateur)
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [dialog, setDialog]       = useState(false);     // mode dialogue mains-libres
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef  = useRef<any>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const dialogRef = useRef(false);
  const loadingRef = useRef(false);
  useEffect(() => { dialogRef.current = dialog; }, [dialog]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Détection des capacités vocales au montage.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (typeof window !== "undefined") && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setSttSupported(!!SR);
    fetch("/api/voice/config").then(r => r.json()).then(d => setTtsEnabled(!!d.ttsEnabled)).catch(() => {});
  }, []);

  // Avatar configuré côté admin (photo d'un assistant réel)
  useEffect(() => {
    fetch("/api/auguste-config").then(r => r.json()).then(d => setLogoUrl(d.logoUrl || "")).catch(() => {});
  }, []);

  // Position initiale (coin bas-droit) + restauration depuis localStorage
  useEffect(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const saved = localStorage.getItem("collab_auguste_pos");
    if (saved) { try { setPos(JSON.parse(saved)); return; } catch { /* défaut */ } }
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  }, []);

  // Garde la bulle dans l'écran au redimensionnement
  useEffect(() => {
    function onResize() {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      setPos(p => p ? { x: Math.min(p.x, window.innerWidth - 64), y: Math.min(p.y, window.innerHeight - 64) } : p);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  function onPointerDown(e: React.PointerEvent) {
    if (!pos) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { ox: pos.x, oy: pos.y, dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const nx = clamp(e.clientX - d.dx, 8, window.innerWidth - 64);
    const ny = clamp(e.clientY - d.dy, 8, window.innerHeight - 64);
    if (Math.hypot(nx - d.ox, ny - d.oy) > 4) d.moved = true;
    setPos({ x: nx, y: ny });
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      setPos(p => { if (p) localStorage.setItem("collab_auguste_pos", JSON.stringify(p)); return p; });
    } else {
      setOpen(o => !o); // simple clic = ouvrir/fermer
    }
  }

  useEffect(() => {
    if (!loading) { setDots("."); return; }
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading, action]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Fermeture du panneau → on coupe micro et voix.
  useEffect(() => {
    if (!open) {
      setDialog(false); dialogRef.current = false;
      stopListening(); stopSpeaking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Synthèse vocale d'un texte via ElevenLabs (renvoie à la fin de la lecture).
  function speak(text: string): Promise<void> {
    return new Promise(resolve => {
      if (!ttsEnabled || !text.trim()) { resolve(); return; }
      // On retire le markdown (liens/gras) pour une lecture naturelle.
      const clean = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*(.+?)\*\*/g, "$1");
      fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean }) })
        .then(r => r.ok ? r.blob() : Promise.reject())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          if (audioRef.current) { audioRef.current.pause(); }
          const audio = new Audio(url);
          audioRef.current = audio;
          setSpeaking(true);
          const done = () => { setSpeaking(false); URL.revokeObjectURL(url); resolve(); };
          audio.onended = done;
          audio.onerror = done;
          audio.play().catch(done);
        })
        .catch(() => { setSpeaking(false); resolve(); });
    });
  }

  function stopSpeaking() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(false);
  }

  // Démarre la dictée. autoSend = envoyer automatiquement à la fin (mode dialogue).
  function startListening(autoSend: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || loadingRef.current) return;
    try { recogRef.current?.stop(); } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => {
      setListening(false);
      const said = finalText.trim();
      if (said && autoSend) { setInput(""); send(said); }
    };
    recogRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  function stopListening() {
    try { recogRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }

  // Active/désactive le mode dialogue mains-libres.
  function toggleDialog() {
    if (dialog) {
      setDialog(false); dialogRef.current = false;
      stopListening(); stopSpeaking();
    } else {
      setDialog(true); dialogRef.current = true;
      startListening(true);
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    stopSpeaking();
    const newMsgs: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(newMsgs);
    setLoading(true);
    setAction(null);

    try {
      const today = new Date().toISOString().split("T")[0];
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, today }),
      });
      const data = await r.json();
      const reply = data.reply ?? "Désolé, une erreur est survenue.";
      setMsgs(prev => [...prev, { role: "assistant", content: reply }]);

      // Dispatcher les side effects pour rafraîchir les modules concernés
      if (data.sideEffects?.length) {
        for (const effect of data.sideEffects) {
          window.dispatchEvent(new CustomEvent(`collab:${effect.type}`, { detail: effect }));
        }
        // Event générique pour tout module qui voudrait écouter
        window.dispatchEvent(new CustomEvent("collab:refresh", { detail: data.sideEffects }));
      }

      // Mode dialogue : Auguste lit sa réponse à voix haute puis se remet à l'écoute.
      if (ttsEnabled) {
        await speak(reply);
        if (dialogRef.current) startListening(true);
      }
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Impossible de contacter Auguste. Vérifiez votre connexion." }]);
    } finally {
      setLoading(false);
      setAction(null);
    }
  }

  function clear() { setMsgs([]); setAction(null); }

  function bold(s: string, kb: string) {
    return s.split(/\*\*(.+?)\*\*/g).map((p, j) => j % 2 === 1 ? <strong key={`${kb}b${j}`}>{p}</strong> : <span key={`${kb}s${j}`}>{p}</span>);
  }
  function inline(text: string, kb: string) {
    // Liens Markdown [label](url) cliquables, puis gras **texte**
    const out: React.ReactNode[] = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push(<span key={`${kb}t${i}`}>{bold(text.slice(last, m.index), `${kb}t${i}`)}</span>);
      out.push(<a key={`${kb}a${i}`} href={m[2]} style={{ color: "#B8966A", fontWeight: 600, textDecoration: "underline" }}>{m[1]}</a>);
      last = m.index + m[0].length; i++;
    }
    if (last < text.length) out.push(<span key={`${kb}e`}>{bold(text.slice(last), `${kb}e`)}</span>);
    return out;
  }
  function formatMsg(text: string) {
    // Rendu basique : liens, gras, sauts de ligne
    const lines = text.split("\n");
    return lines.map((line, i) => (
      <span key={i}>
        {inline(line, `l${i}`)}
        {i < lines.length - 1 && <br />}
      </span>
    ));
  }

  if (!session?.user) return null;

  // Position du panneau de chat, ancrée sur la bulle, en restant dans l'écran
  const panelW = 390, panelH = 580;
  const bx = pos?.x ?? (vp.w - 80);
  const by = pos?.y ?? (vp.h - 80);
  const panelLeft = clamp(bx + 56 - panelW, 8, Math.max(8, vp.w - panelW - 8));
  let panelTop = by - panelH - 8;                         // au-dessus de la bulle si possible
  if (panelTop < 8) panelTop = by + 64;                   // sinon en-dessous
  panelTop = clamp(panelTop, 8, Math.max(8, vp.h - panelH - 8));

  return (
    <>
      {/* Bulle flottante — déplaçable librement (drag), clic pour ouvrir */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Auguste — glissez pour déplacer, cliquez pour ouvrir"
        style={{
          position: "fixed",
          ...(pos ? { left: pos.x, top: pos.y } : { right: 24, bottom: 24 }),
          zIndex: 999,
          width: 56, height: 56, borderRadius: "50%",
          background: open ? DARK : (logoUrl ? "#fff" : GOLD),
          border: "none", cursor: "grab",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: open ? 24 : 22, padding: 0, overflow: "hidden",
          touchAction: "none", transition: "background 0.2s",
        }}
      >
        {open
          ? <span style={{ color: "#fff" }}>×</span>
          : logoUrl
            ? <img src={logoUrl} alt="Auguste" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
            : <span style={{ color: "#fff" }}>✦</span>}
      </button>

      {/* Badge "en action" sur la bulle */}
      {loading && !open && (
        <div style={{ position: "fixed", ...(pos ? { left: pos.x + 6, top: pos.y - 18 } : { right: 18, bottom: 68 }), zIndex: 1000, background: GOLD, borderRadius: 10, padding: "2px 8px", fontSize: 10, color: "#fff", fontWeight: 600 }}>
          {dots}
        </div>
      )}

      {/* Panel de chat */}
      {open && (
        <div style={{
          position: "fixed", left: panelLeft, top: panelTop, zIndex: 998,
          width: panelW, height: panelH, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100vh - 16px)",
          background: "#fff",
          borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          border: `1px solid ${BORDER}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px", background: DARK, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, overflow: "hidden" }}>
              {logoUrl ? <img src={logoUrl} alt="Auguste" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "✦"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Auguste</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {dialog ? (speaking ? "🔊 Auguste parle…" : listening ? "🎙 À l'écoute…" : "Mode dialogue actif")
                  : loading ? (action ?? "Réflexion en cours…") : "Assistant IA · Lotier Immobilier"}
              </div>
            </div>
            {ttsEnabled && sttSupported && (
              <button onClick={toggleDialog} title={dialog ? "Quitter le mode dialogue vocal" : "Mode dialogue vocal (mains-libres)"}
                style={{ background: dialog ? GOLD : "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: dialog ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 13 }}>
                {dialog ? "■" : "🎙"}
              </button>
            )}
            <button onClick={clear} title="Nouvelle conversation" style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
              ↺
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>✦</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>Bonjour ! Je suis Auguste</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
                    Je peux consulter vos tâches, créer des rendez-vous, envoyer des messages et bien plus.
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Que puis-je faire pour vous ?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: DARK, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#efe6d6")}
                      onMouseLeave={e => (e.currentTarget.style.background = GOLD_BG)}
                    >{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "assistant" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✦</div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: GOLD }}>Auguste</span>
                      {ttsEnabled && (
                        <button onClick={() => (speaking ? stopSpeaking() : speak(m.content))} title={speaking ? "Arrêter la lecture" : "Lire à voix haute"}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#c4b9a6", fontSize: 12, padding: 0, lineHeight: 1 }}>
                          {speaking ? "■" : "🔊"}
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{
                    maxWidth: "88%", padding: "9px 12px",
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: m.role === "user" ? GOLD : "#f3f4f6",
                    color: m.role === "user" ? "#fff" : DARK,
                    fontSize: 13, lineHeight: 1.6,
                  }}>
                    {formatMsg(m.content)}
                  </div>
                </div>
              ))
            )}

            {/* Indicateur d'action en cours */}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {action && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✦</div>
                    <div style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: "14px 14px 14px 4px", padding: "7px 12px", fontSize: 12, color: GOLD, fontWeight: 500 }}>
                      {action}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✦</div>
                  <div style={{ background: "#f3f4f6", borderRadius: "14px 14px 14px 4px", padding: "9px 14px", fontSize: 13, color: "#9ca3af" }}>
                    Auguste réfléchit{dots}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Saisie */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, background: "#fafaf8" }}>
            {sttSupported && (
              <button
                onClick={() => (listening ? stopListening() : startListening(dialog))}
                disabled={loading}
                title={listening ? "Arrêter la dictée" : "Dicter (saisie vocale)"}
                style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, border: `1px solid ${listening ? GOLD : BORDER}`, cursor: loading ? "default" : "pointer", background: listening ? GOLD : "#fff", color: listening ? "#fff" : "#6b7280", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
              >{listening ? "●" : "🎤"}</button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={listening ? "Parlez…" : "Demandez à Auguste…"}
              disabled={loading}
              style={{ flex: 1, height: 38, border: `1px solid ${listening ? GOLD : BORDER}`, borderRadius: 10, padding: "0 12px", fontSize: 13, outline: "none", fontFamily: "inherit", background: loading ? "#f3f4f6" : "#fff" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: 10, background: input.trim() && !loading ? GOLD : "#e5e7eb", border: "none", cursor: input.trim() && !loading ? "pointer" : "default", color: input.trim() && !loading ? "#fff" : "#9ca3af", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            >↑</button>
          </div>
          <div style={{ padding: "4px 12px 8px", fontSize: 10, color: "#d1d5db", textAlign: "center" }}>
            Auguste agit en votre nom · Vérifiez les actions importantes
          </div>
        </div>
      )}
    </>
  );
}
