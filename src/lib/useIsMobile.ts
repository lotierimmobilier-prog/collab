"use client";
import { useState, useEffect } from "react";

/**
 * Renvoie true quand la largeur de la fenêtre est sous le point de rupture
 * (768 px par défaut). Sert à adapter les layouts pour mobile/tablette.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}
