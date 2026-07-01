"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import UserMenu from "./UserMenu";

const GOLD   = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK   = "#1C1A17";
const BORDER = "#E6E1D9";

interface Notif {
  id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export default function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const [notifs, setNotifs]           = useState<Notif[]>([]);
  const [unread, setUnread]           = useState(0);
  const [showNotifs, setShowNotifs]   = useState(false);
  const [showNews, setShowNews]       = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const newsRef  = useRef<HTMLDivElement>(null);

  // Polling notifications toutes les 30s
  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(t);
  }, []);

  // Fermer les panneaux au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (newsRef.current  && !newsRef.current.contains(e.target as Node))  setShowNews(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function fetchNotifs() {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const data = await r.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch { /* silencieux */ }
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setNotifs(n => n.map(x => ({ ...x, read: true })));
    setUnread(0);
  }

  async function markRead(id: string, link?: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    setUnread(u => Math.max(0, u - 1));
    if (link) { setShowNotifs(false); router.push(link); }
  }

  const notifIcon = (type: string) => ({ task: "✓", message: "💬", system: "⚙" }[type] ?? "◎");
  const timeAgo = (iso: string) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <div style={{
      height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", background: "#fff", borderBottom: `1px solid ${BORDER}`,
      flexShrink: 0, position: "relative", zIndex: 20,
    }}>
      <span style={{ fontWeight: 600, fontSize: 14, color: DARK, letterSpacing: "0.01em" }}>{title}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        {/* 💡 Raccourci Idées & améliorations */}
        <button
          onClick={() => router.push("/suggestions")}
          title="Idées & améliorations"
          style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 15, color: "#78726B", display: "flex", alignItems: "center" }}
        >💡</button>

        {/* 🚀 Nouveautés */}
        <div ref={newsRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setShowNews(s => !s); setShowNotifs(false); }}
            title="Nouveautés"
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 15, color: "#78726B", display: "flex", alignItems: "center" }}
          >🚀</button>

          {showNews && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 50 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>Nouveautés</span>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {NEWS.map(n => (
                  <div key={n.version} style={{ display: "flex", gap: 10 }}>
                    <span style={{ background: GOLD_BG, color: GOLD, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, flexShrink: 0, height: "fit-content" }}>{n.version}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 2 }}>{n.title}</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                        {n.items.map(i => <li key={i}>{i}</li>)}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 🔔 Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setShowNotifs(s => !s); setShowNews(false); }}
            title="Notifications"
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 13, color: "#78726B", display: "flex", alignItems: "center", gap: 6, position: "relative" }}
          >
            ◎
            {unread > 0 && (
              <span style={{ background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center" }}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 12, color: GOLD, cursor: "pointer", fontWeight: 500 }}>
                    Tout marquer lu
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    Aucune notification
                  </div>
                ) : notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id, n.link)}
                    style={{
                      padding: "11px 16px", display: "flex", gap: 10, alignItems: "flex-start",
                      background: n.read ? "#fff" : GOLD_BG,
                      borderBottom: `1px solid #f3f4f6`, cursor: n.link ? "pointer" : "default",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = n.read ? "#f9fafb" : "#f0e6d8")}
                    onMouseLeave={e => (e.currentTarget.style.background = n.read ? "#fff" : GOLD_BG)}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: n.read ? "#f3f4f6" : GOLD_BG, border: `1.5px solid ${n.read ? "#e5e7eb" : GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                      {notifIcon(n.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: DARK, marginBottom: 2 }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>}
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 4 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 👤 Mon compte */}
        <UserMenu />
      </div>
    </div>
  );
}

const NEWS = [
  {
    version: "v1.7",
    title: "Veille juridique, parrainage & messagerie",
    items: [
      "Veille juridique : flux RSS classés en familles, analysés par Auguste toutes les 24 h",
      "Drive Parrain/Filleul : documents partagés sur toute la lignée de parrainage",
      "Formation : le parrain passe le même QCM que ses filleuls (résultats privés)",
      "Messagerie : Green Acre, Athome et les portails toujours en boîte de réception",
      "Messagerie : « Remettre en boîte de réception » mémorise l'expéditeur",
      "Messagerie : mails du domaine de l'agence marqués « Interne » ; analyse d'un contact ciblée par sujet",
      "Boîte à outils repliable + raccourci 💡 Idées & améliorations",
    ],
  },
  {
    version: "v1.6",
    title: "Direction & comptabilité",
    items: [
      "Module Direction : flotte auto, locaux, cartes professionnelles, assurances",
      "Fiche véhicule : documents (assurance, carte grise, permis), suivi km, sinistres",
      "Module Comptabilité : relevés bancaires, ventilation par service, trésorerie",
      "Présentation épurée aux couleurs de l'agence",
      "Logo Lotier en favicon",
    ],
  },
  {
    version: "v1.5",
    title: "Tableau de bord & annuaire",
    items: [
      "Classement du trimestre (ventes, mandats, mises en location)",
      "Synchronisation automatique du tableau de bord à chaque ouverture",
      "Clic sur un mail du tableau de bord → ouverture directe",
      "Annuaire cloisonné par rôle + catégories personnalisables (admin)",
      "Tâches terminées : date, heure et auteur de la complétion",
    ],
  },
  {
    version: "v1.4",
    title: "Messagerie & pièces jointes",
    items: [
      "Pièces jointes dans la messagerie interne (jusqu'à 20 Mo)",
      "Dossier « Publicité » pour les newsletters",
      "Historique des envoyés sur 6 mois",
      "Brouillon IA en fenêtre centrée avec signature",
      "Menu profil (mot de passe, téléphone, déconnexion)",
    ],
  },
  {
    version: "v1.3",
    title: "Messagerie interne & notifications",
    items: [
      "Chat interne entre collègues (individuel et groupes)",
      "Notifications en temps réel dans la barre du haut",
      "Tâches enregistrées en base de données",
    ],
  },
  {
    version: "v1.2",
    title: "Messagerie email améliorée",
    items: [
      "Décodage MIME complet (texte lisible, images inline)",
      "Pièces jointes téléchargeables",
      "Recherche IMAP côté serveur",
      "Pagination 25 mails/page + sync auto 5 min",
    ],
  },
  {
    version: "v1.1",
    title: "Interface & accès",
    items: [
      "Menu latéral rétractable",
      "Gestion des accès par utilisateur",
      "Login email/mot de passe sécurisé",
    ],
  },
];
