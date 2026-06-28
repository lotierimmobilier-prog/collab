// Authentification de l'espace client (locataires) : identification par email
// + code à usage unique (OTP), session signée cloisonnée au locataire.
// Indépendant de l'authentification interne (NextAuth) : cookie séparé, jamais
// d'accès aux données internes de l'agence.
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const CLIENT_COOKIE = process.env.NODE_ENV === "production" ? "__Secure-collab-client" : "collab-client";
const SESSION_TTL = 2 * 60 * 60;          // session : 2 h
const OTP_TTL_MS = 10 * 60 * 1000;        // code : 10 min
const OTP_MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!s) throw new Error("AUTH_SECRET manquant");
  return s;
}
function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}
function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export interface ClientIdentity { kind: "tenant"; id: string; prenom: string; nom: string; email: string }

// Résolution d'un locataire par email (insensible à la casse).
export async function resolveClientByEmail(email: string): Promise<ClientIdentity | null> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, prenom, nom, email FROM tenants WHERE lower(email) = $1 ORDER BY "updatedAt" DESC LIMIT 1`, e,
    );
    const t = rows[0];
    if (!t?.email) return null;
    return { kind: "tenant", id: t.id, prenom: t.prenom ?? "", nom: t.nom ?? "", email: t.email };
  } catch { return null; }
}

// ── OTP ──
export async function createOtp(email: string): Promise<string> {
  const e = email.trim().toLowerCase();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$executeRawUnsafe(
    `INSERT INTO client_otp (id, email, "codeHash", "expiresAt", attempts, "createdAt")
       VALUES ($1, $2, $3, $4, 0, now())`,
    randomUUID(), e, hmac(`${e}:${code}`), new Date(Date.now() + OTP_TTL_MS),
  );
  return code;
}

// Un code a-t-il été envoyé récemment (anti-spam d'envoi) ?
export async function recentOtp(email: string, withinSec: number): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM client_otp WHERE email = $1 AND "createdAt" > now() - ($2 || ' seconds')::interval LIMIT 1`,
      email.trim().toLowerCase(), String(withinSec),
    );
    return rows.length > 0;
  } catch { return false; }
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, "codeHash", attempts FROM client_otp WHERE email = $1 AND "expiresAt" > now() ORDER BY "createdAt" DESC LIMIT 1`, e,
    );
    const row = rows[0];
    if (!row || row.attempts >= OTP_MAX_ATTEMPTS) return false;
    if (safeEq(row.codeHash, hmac(`${e}:${code}`))) {
      await prisma.$executeRawUnsafe(`DELETE FROM client_otp WHERE email = $1`, e); // consommé
      return true;
    }
    await prisma.$executeRawUnsafe(`UPDATE client_otp SET attempts = attempts + 1 WHERE id = $1`, row.id);
    return false;
  } catch { return false; }
}

// ── Session signée (HMAC) ──
export function signClientSession(c: ClientIdentity): string {
  const payload = { k: c.kind, id: c.id, e: c.email, p: c.prenom, n: c.nom, exp: Math.floor(Date.now() / 1000) + SESSION_TTL };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}
export function verifyClientSession(token?: string | null): ClientIdentity | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEq(hmac(body), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return { kind: "tenant", id: p.id, email: p.e, prenom: p.p, nom: p.n };
  } catch { return null; }
}

// ── Cookie (serveur) ──
export async function setClientCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(CLIENT_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL });
}
export async function clearClientCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(CLIENT_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export async function getClientFromCookie(): Promise<ClientIdentity | null> {
  const jar = await cookies();
  return verifyClientSession(jar.get(CLIENT_COOKIE)?.value);
}
