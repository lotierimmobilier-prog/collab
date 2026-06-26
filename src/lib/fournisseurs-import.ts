import { getAnthropic, MODELS } from "@/lib/auguste";
import { extractText, getDocumentProxy } from "unpdf";

export interface ParsedFournisseur {
  icsNum?: string;
  metier?: string;
  nom: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  modeReglement?: string;
  iban?: string;
  tel?: string;
  mobile?: string;
  email?: string;
  ca?: string;
}

const SYSTEM = "Tu extrais une liste de fournisseurs depuis le texte d'un document. Tu réponds UNIQUEMENT par un tableau JSON valide, sans texte autour.";

const INSTRUCTIONS = `Ce texte provient d'une « Liste des fournisseurs » exportée d'un logiciel immobilier (ICS).
Chaque fournisseur correspond à une ligne du tableau, avec les colonnes :
N° | Métier | Nom et adresse | Mode de règlement | Contact | C.A

Extrais TOUS les fournisseurs présents dans ce texte. Réponds par un tableau JSON, un objet par fournisseur :
[{"icsNum":"40129695","metier":"Plombier","nom":"13 TEL","adresse":"10 rue du 14 Juillet","codePostal":"34440","ville":"NISSAN LEZ ENSERUNE","modeReglement":"Virement","iban":"FR76...","tel":"0467...","mobile":"0632...","email":"x@y.fr","ca":""}]

Règles :
- "icsNum" = le numéro de la colonne N° (ex. 40129695).
- "nom" = la raison sociale, OBLIGATOIRE.
- Sépare l'adresse en "adresse" (rue), "codePostal" (5 chiffres) et "ville" quand c'est possible ; sinon mets tout dans "adresse".
- "iban" sans espaces. "tel"/"mobile"/"email" tels que présents (peut être vide).
- Normalise les numéros de téléphone français : "33632078067" → "0632078067", "+33675040342" → "0675040342".
- Si une valeur est absente, mets une chaîne vide "".
- N'invente JAMAIS de données. Ne renvoie que ce qui est dans le texte fourni.`;

// Extraction de la liste des fournisseurs depuis le PDF ICS.
// Étape 1 : on extrait le TEXTE du PDF côté serveur (unpdf/pdf.js) — instantané,
// et bien plus fiable qu'une lecture visuelle du document.
// Étape 2 : on confie ce texte au modèle « smart » (capable) pour le structurer.
//   Le texte étant léger, l'appel est rapide (pas de timeout proxy) ; on
//   découpe en blocs si la liste est longue afin de ne jamais tronquer la sortie.
export async function extractFournisseursPdf(base64: string): Promise<ParsedFournisseur[]> {
  const buf = Uint8Array.from(Buffer.from(base64, "base64"));
  let fullText = "";
  try {
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    fullText = (Array.isArray(text) ? text.join("\n") : text || "").trim();
  } catch { fullText = ""; }

  // PDF sans couche texte (scanné) → repli sur la lecture visuelle du document.
  if (fullText.length < 200) return extractViaDocument(base64);

  // Découpe en blocs ~12 000 caractères, sur des sauts de ligne, pour ne pas
  // dépasser la limite de tokens en sortie sur les longues listes.
  const chunks = chunkByLines(fullText, 12000);
  const results = await Promise.all(chunks.map(c => extractFromText(c)));
  return dedupe(results.flat());
}

async function extractFromText(text: string): Promise<ParsedFournisseur[]> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: MODELS.smart,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: `${INSTRUCTIONS}\n\n--- TEXTE DU DOCUMENT ---\n${text}` }],
  });
  return parseArray(collectText(resp));
}

// Repli : PDF scanné (pas de texte) → on envoie le document à lire visuellement.
async function extractViaDocument(base64: string): Promise<ParsedFournisseur[]> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: MODELS.smart,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: INSTRUCTIONS },
      ],
    }],
  });
  return parseArray(collectText(resp));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectText(resp: any): string {
  return (resp.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

function parseArray(text: string): ParsedFournisseur[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as ParsedFournisseur[];
    return arr
      .filter(f => f && typeof f.nom === "string" && f.nom.trim())
      .map(f => ({
        icsNum: clean(f.icsNum),
        metier: clean(f.metier),
        nom: clean(f.nom)!,
        adresse: clean(f.adresse),
        codePostal: clean(f.codePostal),
        ville: clean(f.ville),
        modeReglement: clean(f.modeReglement),
        iban: clean(f.iban)?.replace(/\s+/g, ""),
        tel: normPhone(f.tel),
        mobile: normPhone(f.mobile),
        email: clean(f.email)?.toLowerCase(),
        ca: clean(f.ca),
      }));
  } catch { return []; }
}

// Dédoublonne par icsNum (sinon par nom) — utile quand un fournisseur est à
// cheval sur deux blocs.
function dedupe(list: ParsedFournisseur[]): ParsedFournisseur[] {
  const seen = new Set<string>();
  const out: ParsedFournisseur[] = [];
  for (const f of list) {
    const key = (f.icsNum || f.nom).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

// Découpe un texte en blocs d'au plus `maxChars`, en coupant sur les sauts de
// ligne pour ne pas scinder une ligne de fournisseur.
function chunkByLines(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (cur.length + line.length + 1 > maxChars && cur) {
      chunks.push(cur);
      cur = "";
    }
    cur += (cur ? "\n" : "") + line;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function clean(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function normPhone(v: unknown): string | undefined {
  let s = clean(v);
  if (!s) return undefined;
  s = s.replace(/[^\d+]/g, "");
  if (s.startsWith("+33")) s = "0" + s.slice(3);
  else if (s.startsWith("0033")) s = "0" + s.slice(4);
  else if (s.startsWith("33") && s.length === 11) s = "0" + s.slice(2);
  return s || undefined;
}
