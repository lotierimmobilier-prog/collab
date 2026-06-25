// Chiffrement symétrique des secrets ICS (mot de passe du connecteur).
// AES-256-GCM, clé dérivée de AUTH_SECRET. Le secret n'est jamais stocké
// ni journalisé en clair.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const SALT = "collab-ics-connector-v1";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!secret) throw new Error("AUTH_SECRET manquant : impossible de chiffrer les identifiants ICS.");
  return scryptSync(secret, SALT, 32);
}

/** Chiffre une chaîne. Renvoie "iv:tag:cipher" en base64. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Déchiffre une chaîne produite par encryptSecret. Renvoie "" si invalide. */
export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return "";
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
