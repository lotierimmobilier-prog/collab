"use client";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

/**
 * Suit l'activité de l'utilisateur connecté :
 *  - journalise chaque changement de page (action),
 *  - envoie un battement toutes les 60 s tant que l'onglet est visible
 *    (alimente le temps passé sur le site).
 * Invisible, monté globalement.
 */
export default function ActivityTracker() {
  const { status } = useSession();
  const pathname = usePathname();
  const lastPath = useRef<string>("");

  useEffect(() => {
    if (status !== "authenticated") return;

    const send = (nav: boolean) => {
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname, nav }),
        keepalive: true,
      }).catch(() => { /* silencieux */ });
    };

    if (lastPath.current !== pathname) { lastPath.current = pathname; send(true); }

    const iv = setInterval(() => {
      if (document.visibilityState === "visible") send(false);
    }, 60_000);
    return () => clearInterval(iv);
  }, [status, pathname]);

  return null;
}
